import "dotenv/config";
import crypto from "crypto";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_VOICES = new Set(["Kore", "Charon", "Puck", "Fenrir", "Zephyr"]);
const CACHE_DIR = path.resolve(__dirname, ".tts-cache");
const memoryAudioCache = new Map<string, { audioBase64: string; mimeType: string; modelUsed: string }>();

// Track when gemini-3.8-flash-lite-tts hits daily free-tier quota so we route straight to fallback
let liteTtsCooldownUntil = 0;

function ensureCacheDir() {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
  } catch {
    // Non-fatal if filesystem is read-only
  }
}

function getCacheKey(payload: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 24);
}

function readCachedAudio(key: string): { audioBase64: string; mimeType: string; modelUsed: string } | null {
  const mem = memoryAudioCache.get(key);
  if (mem) return mem;

  try {
    const filePath = path.join(CACHE_DIR, `${key}.json`);
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
        audioBase64: string;
        mimeType: string;
        modelUsed: string;
      };
      if (parsed?.audioBase64) {
        memoryAudioCache.set(key, parsed);
        return parsed;
      }
    }
  } catch {
    // Ignore cache read failures
  }
  return null;
}

function writeCachedAudio(
  key: string,
  value: { audioBase64: string; mimeType: string; modelUsed: string }
) {
  memoryAudioCache.set(key, value);
  try {
    ensureCacheDir();
    const filePath = path.join(CACHE_DIR, `${key}.json`);
    fs.writeFileSync(filePath, JSON.stringify(value), "utf8");
  } catch {
    // Ignore cache write failures
  }
}

function getGeminiClient(apiVersion = "v1beta"): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in environment secrets.");
  }
  return new GoogleGenAI({
    apiKey,
    apiVersion,
    httpOptions: {
      apiVersion,
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function isQuotaExhaustedError(err: unknown): boolean {
  const rawMessage = err instanceof Error ? err.message : String(err);
  return (
    rawMessage.includes("RESOURCE_EXHAUSTED") ||
    rawMessage.includes("429") ||
    rawMessage.toLowerCase().includes("quota")
  );
}

function extractErrorDetails(err: unknown): { status: number; message: string } {
  const rawMessage = err instanceof Error ? err.message : String(err);
  const statusMatch = rawMessage.match(/\b(400|401|403|404|429|500|503)\b/);
  const status = statusMatch ? Number(statusMatch[1]) : 500;

  if (rawMessage.includes("API_KEY_INVALID") || rawMessage.includes("PERMISSION_DENIED") || status === 403) {
    return {
      status: 403,
      message: "API key is missing or unauthorized. Please verify GEMINI_API_KEY in Settings > Secrets.",
    };
  }
  if (isQuotaExhaustedError(err)) {
    const retryMatch = rawMessage.match(/Please retry in ([^."\\]+)/i);
    const retryHint = retryMatch ? ` Retry available in ${retryMatch[1].trim()}.` : "";
    return {
      status: 429,
      message:
        "Gemini TTS free-tier daily quota reached (limit: 10 requests/day per model)." +
        retryHint +
        " You can increase your quota by selecting a billing-enabled API key in Settings > Secrets.",
    };
  }
  if (rawMessage.includes("NOT_FOUND") || status === 404) {
    return {
      status: 404,
      message: "Requested Gemini TTS model is unavailable. Check model configuration.",
    };
  }
  return {
    status: status >= 400 && status < 600 ? status : 500,
    message: rawMessage || "Failed to process Gemini API request.",
  };
}

async function generateSingleTtsWithFallback(
  ai: GoogleGenAI,
  preferredModel: "gemini-3.8-flash-lite-tts" | "gemini-3.8-flash-tts",
  text: string,
  voiceName: string,
  style: string
): Promise<{ audioBase64: string; modelUsed: string }> {
  const now = Date.now();
  const initialModel =
    preferredModel === "gemini-3.8-flash-lite-tts" && now < liteTtsCooldownUntil
      ? "gemini-3.8-flash-tts"
      : preferredModel;

  const callModel = async (modelId: "gemini-3.8-flash-lite-tts" | "gemini-3.8-flash-tts") => {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: [
        {
          role: "user",
          parts: [
            {
              text,
              speechMetadata: { style },
            },
          ],
        },
      ],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("Gemini TTS returned no audio output.");
    }
    return { audioBase64: base64Audio, modelUsed: modelId };
  };

  try {
    return await callModel(initialModel);
  } catch (err) {
    if (initialModel === "gemini-3.8-flash-lite-tts" && isQuotaExhaustedError(err)) {
      // Remember lite quota exhaustion for 10 minutes and fall back to flash-tts bucket
      liteTtsCooldownUntil = Date.now() + 10 * 60 * 1000;
      return await callModel("gemini-3.8-flash-tts");
    }
    throw err;
  }
}

const FALLBACK_BOOT_SECRET = crypto.randomBytes(32).toString("hex");
const SESSION_COOKIE_NAME = "sada_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function getConfiguredAccessCode(): string {
  return (process.env.STUDIO_ACCESS_CODE || process.env.ACCESS_CODE || "").trim();
}

function getSigningSecret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const code = getConfiguredAccessCode();
  const key = process.env.GEMINI_API_KEY || "";
  if (code || key) {
    return crypto.createHash("sha256").update(`sada-session:${code}:${key}`).digest("hex");
  }
  return FALLBACK_BOOT_SECRET;
}

function verifySecretCode(input: string, expected: string): boolean {
  const inputHash = crypto.createHash("sha256").update(input).digest();
  const expectedHash = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(inputHash, expectedHash);
}

function createSessionToken(): string {
  const payload = Buffer.from(
    JSON.stringify({ iat: Date.now(), exp: Date.now() + SESSION_TTL_MS }),
    "utf8"
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", getSigningSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifySessionToken(token: string | undefined | null): boolean {
  if (!token || !getConfiguredAccessCode()) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return false;

  const expectedSig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(payloadB64)
    .digest("base64url");

  const sigBuf = Buffer.from(sigB64, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return false;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as {
      exp?: number;
    };
    return typeof parsed.exp === "number" && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const eqIndex = part.indexOf("=");
    if (eqIndex > 0) {
      const name = part.slice(0, eqIndex).trim();
      const value = part.slice(eqIndex + 1).trim();
      result[name] = decodeURIComponent(value);
    }
  }
  return result;
}

function extractSessionToken(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies[SESSION_COOKIE_NAME] || null;
}

function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const token = extractSessionToken(req);
  if (!verifySessionToken(token)) {
    res.status(401).json({ error: "Studio access required. Please enter your secret code." });
    return;
  }
  next();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/auth/status", (req, res) => {
    const configured = getConfiguredAccessCode().length > 0;
    const token = extractSessionToken(req);
    const authenticated = configured && verifySessionToken(token);
    res.json({ configured, authenticated });
  });

  app.post("/api/auth/login", (req, res) => {
    const expectedCode = getConfiguredAccessCode();
    if (!expectedCode) {
      res.status(503).json({
        error: "Access code is not configured. Add STUDIO_ACCESS_CODE in Settings > Secrets.",
      });
      return;
    }

    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const record = loginAttempts.get(clientIp);
    if (record && now < record.resetAt && record.count >= 10) {
      res.status(429).json({ error: "Too many failed attempts. Please wait a few minutes and try again." });
      return;
    }

    const { code } = req.body as { code?: string };
    if (!code || typeof code !== "string" || !verifySecretCode(code.trim(), expectedCode)) {
      const nextCount = record && now < record.resetAt ? record.count + 1 : 1;
      loginAttempts.set(clientIp, {
        count: nextCount,
        resetAt: record && now < record.resetAt ? record.resetAt : now + 5 * 60 * 1000,
      });
      res.status(401).json({ error: "Incorrect access code. Please check your code and try again." });
      return;
    }

    loginAttempts.delete(clientIp);
    const token = createSessionToken();
    const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: isHttps ? "none" : "lax",
      secure: isHttps,
      maxAge: SESSION_TTL_MS,
      path: "/",
    });
    res.json({ authenticated: true, token });
  });

  app.post("/api/auth/logout", (req, res) => {
    const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      sameSite: isHttps ? "none" : "lax",
      secure: isHttps,
      path: "/",
    });
    res.json({ authenticated: false });
  });

  app.use("/api/urdu", requireAuth);

  app.post("/api/urdu/prepare-script", async (req, res) => {
    try {
      const { text, action, tone } = req.body as {
        text?: string;
        action?: "translate" | "polish" | "add-pauses";
        tone?: string;
      };

      if (!text || !text.trim()) {
        res.status(400).json({ error: "Please enter text before preparing the script." });
        return;
      }

      const ai = getGeminiClient();

      let taskPrompt = "";
      if (action === "translate") {
        taskPrompt =
          "Convert the following English or Roman Urdu text into natural, eloquent, broadcast-ready Urdu script (اردو رسم الخط). " +
          "Use proper Urdu punctuation (، ۔ ؟) so a voice-over artist reads it with natural pauses. " +
          "Do not include transliteration, explanations, or quotes—return ONLY the pure Urdu script.";
      } else if (action === "add-pauses") {
        taskPrompt =
          "Refine the following Urdu voice-over script for expressive studio delivery. " +
          "Add natural Urdu punctuation (، ۔ ؟) and subtle studio breath cues (<breath>) ONLY where a human narrator would naturally pause for emphasis. " +
          "Keep all Urdu words authentic and return ONLY the refined Urdu script.";
      } else {
        taskPrompt =
          "Proofread and polish the following Urdu voice-over script for smooth pronunciation and broadcast clarity. " +
          "Fix awkward phrasing, normalize Urdu punctuation (، ۔ ؟), and ensure it reads naturally aloud. " +
          "Return ONLY the polished Urdu script without explanations or extra formatting.";
      }

      const toneLine = tone?.trim() ? `\nTarget voice-over tone: ${tone.trim()}` : "";

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: `${taskPrompt}${toneLine}\n\nInput text:\n${text.trim()}`,
        config: {
          systemInstruction:
            "You are an expert Urdu broadcast scriptwriter and voice-over director. Output only clean Urdu script text ready for voice synthesis.",
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const preparedText = (response.text ?? "").trim();
      if (!preparedText) {
        res.status(502).json({ error: "No script text was returned by Gemini." });
        return;
      }

      res.json({ preparedText });
    } catch (err) {
      const { status, message } = extractErrorDetails(err);
      console.warn(`/api/urdu/prepare-script (${status}): ${message}`);
      res.status(status).json({ error: message });
    }
  });

  app.post("/api/urdu/preview-voice", async (req, res) => {
    try {
      const { voiceName, text, style } = req.body as {
        voiceName?: string;
        text?: string;
        style?: string;
      };

      const selectedVoice = voiceName && ALLOWED_VOICES.has(voiceName) ? voiceName : "Kore";
      const sampleText =
        text?.trim() ||
        "آداب! صدا اسٹوڈیو میں خوش آمدید۔ آپ اپنی اردو کہانی کے لیے یہ آواز منتخب کر سکتے ہیں۔";
      const styleText = style?.trim() || "Natural, clear Urdu voice-over narration";

      const cacheKey = getCacheKey({
        kind: "preview",
        selectedVoice,
        sampleText,
        styleText,
      });

      const cached = readCachedAudio(cacheKey);
      if (cached) {
        res.json({ ...cached, cached: true });
        return;
      }

      const ai = getGeminiClient();
      const { audioBase64, modelUsed } = await generateSingleTtsWithFallback(
        ai,
        "gemini-3.8-flash-lite-tts",
        sampleText,
        selectedVoice,
        styleText
      );

      const payload = { audioBase64, mimeType: "audio/wav", modelUsed };
      writeCachedAudio(cacheKey, payload);
      res.json(payload);
    } catch (err) {
      const { status, message } = extractErrorDetails(err);
      console.warn(`/api/urdu/preview-voice (${status}): ${message}`);
      res.status(status).json({ error: message });
    }
  });

  app.post("/api/urdu/tts", async (req, res) => {
    try {
      const {
        mode,
        model,
        text,
        voiceName,
        style,
        dialogue,
      } = req.body as {
        mode?: "single" | "dialogue";
        model?: "gemini-3.8-flash-lite-tts" | "gemini-3.8-flash-tts";
        text?: string;
        voiceName?: string;
        style?: string;
        dialogue?: {
          speakerA: string;
          voiceA: string;
          styleA: string;
          speakerB: string;
          voiceB: string;
          styleB: string;
          turns: Array<{ speaker: "A" | "B"; text: string }>;
        };
      };

      const ai = getGeminiClient();

      if (mode === "dialogue") {
        if (!dialogue || !dialogue.turns || dialogue.turns.length === 0) {
          res.status(400).json({ error: "Please add at least one dialogue line." });
          return;
        }

        const speakerA = (dialogue.speakerA || "Speaker A").trim();
        const speakerB = (dialogue.speakerB || "Speaker B").trim();
        const voiceA = ALLOWED_VOICES.has(dialogue.voiceA) ? dialogue.voiceA : "Puck";
        const voiceB = ALLOWED_VOICES.has(dialogue.voiceB) ? dialogue.voiceB : "Kore";

        if (speakerA === speakerB) {
          res.status(400).json({ error: "Speaker A and Speaker B must have distinct names." });
          return;
        }

        const validTurns = dialogue.turns.filter((t) => t.text && t.text.trim().length > 0);
        if (validTurns.length === 0) {
          res.status(400).json({ error: "Dialogue lines cannot be empty." });
          return;
        }

        const cacheKey = getCacheKey({
          kind: "dialogue",
          speakerA,
          voiceA,
          styleA: dialogue.styleA,
          speakerB,
          voiceB,
          styleB: dialogue.styleB,
          validTurns,
        });
        const cached = readCachedAudio(cacheKey);
        if (cached) {
          res.json({ ...cached, cached: true });
          return;
        }

        const parts = validTurns.map((turn) => {
          const isA = turn.speaker === "A";
          const speakerLabel = isA ? speakerA : speakerB;
          const speakerStyle = (isA ? dialogue.styleA : dialogue.styleB)?.trim() || "Natural conversational Urdu";
          return {
            text: `${speakerLabel}: ${turn.text.trim()}`,
            speechMetadata: {
              speaker: speakerLabel,
              style: speakerStyle,
            },
          };
        });

        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash-tts",
          contents: [
            {
              role: "user",
              parts,
            },
          ],
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              multiSpeakerVoiceConfig: {
                speakerVoiceConfigs: [
                  {
                    speaker: speakerA,
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: voiceA },
                    },
                  },
                  {
                    speaker: speakerB,
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: voiceB },
                    },
                  },
                ],
              },
            },
          },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
          res.status(502).json({ error: "Gemini returned an empty audio response for this dialogue." });
          return;
        }

        const payload = {
          audioBase64: base64Audio,
          mimeType: "audio/wav",
          modelUsed: "gemini-3.8-flash-tts",
        };
        writeCachedAudio(cacheKey, payload);
        res.json(payload);
        return;
      }

      // Single-speaker narration mode
      if (!text || !text.trim()) {
        res.status(400).json({ error: "Please enter an Urdu script to generate voice-over." });
        return;
      }

      const selectedVoice = voiceName && ALLOWED_VOICES.has(voiceName) ? voiceName : "Kore";
      const hasExpressiveTags = /<(breath|laugh|gasp|sigh|cough)>|\|[^|]+\|/i.test(text);
      const preferredModel =
        model === "gemini-3.8-flash-tts" || hasExpressiveTags
          ? "gemini-3.8-flash-tts"
          : "gemini-3.8-flash-lite-tts";
      const styleText =
        style?.trim() ||
        "Clear, natural, expressive Urdu voice-over narration with authentic pronunciation";

      const cacheKey = getCacheKey({
        kind: "single",
        text: text.trim(),
        selectedVoice,
        styleText,
        preferredModel,
      });
      const cached = readCachedAudio(cacheKey);
      if (cached) {
        res.json({ ...cached, cached: true });
        return;
      }

      const { audioBase64, modelUsed } = await generateSingleTtsWithFallback(
        ai,
        preferredModel,
        text.trim(),
        selectedVoice,
        styleText
      );

      const payload = {
        audioBase64,
        mimeType: "audio/wav",
        modelUsed,
      };
      writeCachedAudio(cacheKey, payload);
      res.json(payload);
    } catch (err) {
      const { status, message } = extractErrorDetails(err);
      console.warn(`/api/urdu/tts (${status}): ${message}`);
      res.status(status).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("/{*path}", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, "0.0.0.0", () => {
    console.log(`SadaStudio server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
