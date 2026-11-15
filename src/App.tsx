import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  Languages,
  Loader2,
  LogOut,
  Mic,
  Plus,
  Trash2,
  Wand2,
} from "lucide-react";
import {
  DELIVERY_PRESETS,
  PrebuiltVoiceName,
  SCRIPT_TEMPLATES,
  TtsEngineId,
  VOICE_PROFILES,
} from "./data/voices";
import { analyzeWavBuffer, createWavBlobUrl } from "./utils/audio";
import { StudioTake, WaveformPlayer } from "./components/WaveformPlayer";
import { VoiceCastPanel } from "./components/VoiceCastPanel";
import { TakesHistory } from "./components/TakesHistory";
import { AccessGate } from "./components/AccessGate";

const TOKEN_STORAGE_KEY = "sadastudio_access_token";

interface DialogueTurn {
  id: string;
  speaker: "A" | "B";
  text: string;
}

export default function App() {
  const [authStatus, setAuthStatus] = useState<"checking" | "locked" | "unlocked">("checking");
  const [accessConfigured, setAccessConfigured] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const [mode, setMode] = useState<"single" | "dialogue">("single");
  const [textDir, setTextDir] = useState<"rtl" | "auto">("rtl");

  // Single narrator state
  const [script, setScript] = useState<string>(SCRIPT_TEMPLATES[0].text ?? "");
  const [selectedVoice, setSelectedVoice] = useState<PrebuiltVoiceName>("Charon");
  const [selectedPresetId, setSelectedPresetId] = useState<string>("documentary");
  const [customStyle, setCustomStyle] = useState<string>(DELIVERY_PRESETS[0].stylePrompt);
  const [engine, setEngine] = useState<TtsEngineId>("gemini-3.8-flash-lite-tts");

  // Dual dialogue state
  const initialDialogue = SCRIPT_TEMPLATES[4].dialogue!;
  const [speakerA, setSpeakerA] = useState<string>(initialDialogue.speakerA);
  const [voiceA, setVoiceA] = useState<PrebuiltVoiceName>(initialDialogue.voiceA);
  const [styleA, setStyleA] = useState<string>(initialDialogue.styleA);
  const [speakerB, setSpeakerB] = useState<string>(initialDialogue.speakerB);
  const [voiceB, setVoiceB] = useState<PrebuiltVoiceName>(initialDialogue.voiceB);
  const [styleB, setStyleB] = useState<string>(initialDialogue.styleB);
  const [turns, setTurns] = useState<DialogueTurn[]>(
    initialDialogue.turns.map((t, idx) => ({ id: `turn-${idx + 1}`, ...t }))
  );

  // Generation & UI status
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreparingScript, setIsPreparingScript] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Voice preview playback
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewUrlCacheRef = useRef<Map<string, string>>(new Map());
  const [previewingVoice, setPreviewingVoice] = useState<PrebuiltVoiceName | null>(null);
  const [playingPreviewVoice, setPlayingPreviewVoice] = useState<PrebuiltVoiceName | null>(null);

  // Generated takes
  const [takes, setTakes] = useState<StudioTake[]>([]);
  const [activeTake, setActiveTake] = useState<StudioTake | null>(null);

  useEffect(() => {
    let active = true;
    const verifySession = async () => {
      try {
        const headers: Record<string, string> = {};
        if (authToken) {
          headers["Authorization"] = `Bearer ${authToken}`;
        }
        const res = await fetch("/api/auth/status", { headers });
        const data = await res.json();
        if (!active) return;
        setAccessConfigured(Boolean(data.configured));
        if (data.authenticated) {
          setAuthStatus("unlocked");
        } else {
          try {
            localStorage.removeItem(TOKEN_STORAGE_KEY);
          } catch {
            // ignore
          }
          setAuthToken(null);
          setAuthStatus("locked");
        }
      } catch {
        if (active) setAuthStatus("locked");
      }
    };
    verifySession();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      previewUrlCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const authHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    return headers;
  };

  const handleAuthenticated = (token: string) => {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch {
      // ignore
    }
    setAuthToken(token);
    setAuthStatus("unlocked");
    setErrorMsg(null);
  };

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // ignore
    }
    setAuthToken(null);
    setAuthStatus("locked");
  };

  const wordCount =
    mode === "single"
      ? script.trim().split(/\s+/).filter(Boolean).length
      : turns.reduce((acc, t) => acc + t.text.trim().split(/\s+/).filter(Boolean).length, 0);

  const estimatedSeconds = Math.max(0, Math.round((wordCount / 130) * 60));

  const handleSelectTemplate = (templateId: string) => {
    const tpl = SCRIPT_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    setErrorMsg(null);

    if (tpl.mode === "dialogue" && tpl.dialogue) {
      setMode("dialogue");
      setSpeakerA(tpl.dialogue.speakerA);
      setVoiceA(tpl.dialogue.voiceA);
      setStyleA(tpl.dialogue.styleA);
      setSpeakerB(tpl.dialogue.speakerB);
      setVoiceB(tpl.dialogue.voiceB);
      setStyleB(tpl.dialogue.styleB);
      setTurns(tpl.dialogue.turns.map((t, i) => ({ id: `tpl-${Date.now()}-${i}`, ...t })));
    } else if (tpl.text) {
      setMode("single");
      setScript(tpl.text);
      setSelectedVoice(tpl.recommendedVoice);
      setCustomStyle(tpl.recommendedStyle);
      const matchingPreset = DELIVERY_PRESETS.find((p) => p.stylePrompt === tpl.recommendedStyle);
      setSelectedPresetId(matchingPreset ? matchingPreset.id : "custom");
    }
  };

  const handlePrepareScript = async (action: "translate" | "polish" | "add-pauses") => {
    if (!script.trim()) {
      setErrorMsg("Enter Urdu, Roman Urdu, or English text in the editor first.");
      return;
    }
    setErrorMsg(null);
    setIsPreparingScript(action);

    try {
      const response = await fetch("/api/urdu/prepare-script", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          text: script,
          action,
          tone: customStyle,
        }),
      });
      if (response.status === 401) {
        await handleSignOut();
        return;
      }
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not prepare Urdu script.");
      }
      setScript(data.preparedText);
      setTextDir("rtl");
      if (action === "add-pauses") {
        setEngine("gemini-3.8-flash-tts");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to prepare script.");
    } finally {
      setIsPreparingScript(null);
    }
  };

  const handlePreviewVoice = async (voice: PrebuiltVoiceName) => {
    // Stop if already playing this voice
    if (playingPreviewVoice === voice && previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
      setPlayingPreviewVoice(null);
      return;
    }

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      setPlayingPreviewVoice(null);
    }

    setErrorMsg(null);
    const profile = VOICE_PROFILES.find((v) => v.id === voice);
    const cachedUrl = previewUrlCacheRef.current.get(voice);

    const playUrl = async (url: string) => {
      if (!previewAudioRef.current) {
        previewAudioRef.current = new Audio();
      }
      const audio = previewAudioRef.current;
      audio.src = url;
      audio.onended = () => setPlayingPreviewVoice(null);
      audio.onerror = () => setPlayingPreviewVoice(null);
      setPlayingPreviewVoice(voice);
      await audio.play();
    };

    if (cachedUrl) {
      try {
        await playUrl(cachedUrl);
      } catch {
        setPlayingPreviewVoice(null);
      }
      return;
    }

    setPreviewingVoice(voice);
    try {
      const response = await fetch("/api/urdu/preview-voice", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          voiceName: voice,
          text: profile?.previewText,
          style: profile?.defaultStyle,
        }),
      });
      if (response.status === 401) {
        await handleSignOut();
        return;
      }
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate voice preview.");
      }
      const { url } = createWavBlobUrl(data.audioBase64, data.mimeType);
      previewUrlCacheRef.current.set(voice, url);
      await playUrl(url);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Voice preview failed.");
      setPlayingPreviewVoice(null);
    } finally {
      setPreviewingVoice(null);
    }
  };

  const handleGenerateVoiceOver = async () => {
    setErrorMsg(null);

    if (mode === "single" && !script.trim()) {
      setErrorMsg("Please write or paste an Urdu script before generating audio.");
      return;
    }
    if (mode === "dialogue" && turns.every((t) => !t.text.trim())) {
      setErrorMsg("Please add at least one Urdu dialogue line.");
      return;
    }

    setIsGenerating(true);

    try {
      const payload =
        mode === "dialogue"
          ? {
              mode: "dialogue",
              dialogue: {
                speakerA: speakerA.trim() || "Speaker A",
                voiceA,
                styleA,
                speakerB: speakerB.trim() || "Speaker B",
                voiceB,
                styleB,
                turns: turns.map(({ speaker, text }) => ({ speaker, text })),
              },
            }
          : {
              mode: "single",
              model: engine,
              text: script,
              voiceName: selectedVoice,
              style: customStyle,
            };

      const response = await fetch("/api/urdu/tts", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      if (response.status === 401) {
        await handleSignOut();
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Voice synthesis failed.");
      }

      const { url, bytes } = createWavBlobUrl(data.audioBase64, data.mimeType || "audio/wav");
      const { peaks, durationSec } = analyzeWavBuffer(bytes, 72);

      const presetObj = DELIVERY_PRESETS.find((p) => p.id === selectedPresetId);
      const now = new Date();
      const timeLabel = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      const newTake: StudioTake = {
        id: `take-${Date.now()}`,
        createdAt: timeLabel,
        mode,
        voiceLabel:
          mode === "dialogue"
            ? `${speakerA || "A"} (${voiceA}) & ${speakerB || "B"} (${voiceB})`
            : selectedVoice,
        styleLabel:
          mode === "dialogue"
            ? "Dual Dialogue"
            : presetObj?.label ?? "Custom Direction",
        modelUsed: data.modelUsed || engine,
        scriptPreview:
          mode === "dialogue"
            ? turns.map((t) => t.text.trim()).filter(Boolean).join(" — ")
            : script.trim(),
        audioUrl: url,
        peaks,
        durationSec,
        filename: `sadastudio-${mode === "dialogue" ? "dialogue" : selectedVoice.toLowerCase()}-${Date.now()}.wav`,
      };

      setTakes((prev) => [newTake, ...prev]);
      setActiveTake(newTake);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unable to generate audio.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleInsertCue = (cue: string) => {
    setScript((prev) => {
      const trimmed = prev.trimEnd();
      return trimmed ? `${trimmed} ${cue} ` : `${cue} `;
    });
    setEngine("gemini-3.8-flash-tts");
  };

  const handleAddTurn = () => {
    const lastSpeaker = turns[turns.length - 1]?.speaker ?? "B";
    const nextSpeaker = lastSpeaker === "A" ? "B" : "A";
    setTurns((prev) => [
      ...prev,
      { id: `turn-${Date.now()}`, speaker: nextSpeaker, text: "" },
    ]);
  };

  const handleDeleteTake = (id: string) => {
    setTakes((prev) => {
      const target = prev.find((t) => t.id === id);
      if (target) URL.revokeObjectURL(target.audioUrl);
      const remaining = prev.filter((t) => t.id !== id);
      if (activeTake?.id === id) {
        setActiveTake(remaining[0] ?? null);
      }
      return remaining;
    });
  };

  if (authStatus === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] text-slate-600">
        <div className="inline-flex items-center gap-2 text-sm font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-teal-700" />
          Checking studio access...
        </div>
      </div>
    );
  }

  if (authStatus === "locked") {
    return (
      <AccessGate
        configured={accessConfigured}
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] text-slate-900">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200">
        <div className="max-w-[1320px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#studio"
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            SadaStudio
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#studio" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              Script Studio
            </a>
            <a href="#voices" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              Voice Cast
            </a>
            <a href="#takes" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              Session Takes
            </a>
            <button
              type="button"
              onClick={handleSignOut}
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Sign Out
            </button>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={handleGenerateVoiceOver}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {isGenerating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Mic className="w-3.5 h-3.5" />
              )}
              {isGenerating ? "Synthesizing..." : "Generate Voice-Over"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Studio Workspace */}
      <main id="studio" className="flex-1 max-w-[1320px] w-full mx-auto px-6 py-8 flex flex-col gap-8">
        {/* Studio Intro & Mode Toolbar */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5">
              <span>Urdu AI Voice-Over Studio</span>
              <span aria-hidden="true">·</span>
              <span dir="rtl" className="font-urdu-compact text-slate-600">
                اردو وائس اوور اسٹوڈیو
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 text-balance">
              Craft natural Urdu narration and dialogue
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Mode Switcher */}
            <div className="inline-flex items-center p-1 bg-slate-200/70 rounded-lg">
              <button
                type="button"
                onClick={() => setMode("single")}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  mode === "single"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Single Narrator
              </button>
              <button
                type="button"
                onClick={() => setMode("dialogue")}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  mode === "dialogue"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Dual Dialogue
              </button>
            </div>

            {/* Template Selector */}
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                aria-label="Load sample Urdu script"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) handleSelectTemplate(e.target.value);
                }}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-teal-700"
              >
                <option value="" disabled>
                  Load sample script...
                </option>
                {SCRIPT_TEMPLATES.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.title} ({tpl.category})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {errorMsg && (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-xs font-medium text-red-700 hover:underline whitespace-nowrap"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* 2-Column Studio Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left / Primary Script & Player Column */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {/* Editor Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200 bg-slate-50/70">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-800">
                    {mode === "single" ? "Urdu Script Editor" : "Dual-Speaker Screenplay"}
                  </span>
                  <span className="text-xs text-slate-400" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-xs font-mono tabular-nums text-slate-500">
                    {wordCount} words <span aria-hidden="true">·</span> ~{estimatedSeconds}s read
                  </span>
                </div>

                {mode === "single" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTextDir((d) => (d === "rtl" ? "auto" : "rtl"))}
                      className="px-2.5 py-1 text-xs font-medium bg-white border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                    >
                      Direction: {textDir === "rtl" ? "RTL (اردو)" : "Auto"}
                    </button>
                    <button
                      type="button"
                      disabled={isPreparingScript !== null}
                      onClick={() => handlePrepareScript("translate")}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-white border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap"
                    >
                      {isPreparingScript === "translate" ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Languages className="w-3 h-3 text-teal-700" />
                      )}
                      Roman / English → Urdu
                    </button>
                    <button
                      type="button"
                      disabled={isPreparingScript !== null}
                      onClick={() => handlePrepareScript("polish")}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-white border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap"
                    >
                      {isPreparingScript === "polish" ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Wand2 className="w-3 h-3 text-teal-700" />
                      )}
                      Polish Urdu
                    </button>
                  </div>
                )}
              </div>

              {/* Editor Body */}
              {mode === "single" ? (
                <div className="p-5 flex flex-col gap-4">
                  <textarea
                    dir={textDir}
                    value={script}
                    onChange={(e) => setScript(e.target.value)}
                    rows={7}
                    placeholder="یہاں اپنا اردو اسکرپٹ لکھیں، یا رومن اردو / انگریزی لکھ کر اوپر دیے گئے بٹن سے اردو میں تبدیل کریں..."
                    className={`w-full bg-white text-slate-900 text-lg md:text-xl focus:outline-none resize-y min-h-[210px] placeholder:text-slate-400 ${
                      textDir === "rtl" ? "font-urdu text-right" : "font-sans leading-relaxed"
                    }`}
                  />

                  <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-slate-500 mr-1">Vocal Cues:</span>
                      {["<breath>", "<laugh>", "<gasp>"].map((cue) => (
                        <button
                          key={cue}
                          type="button"
                          onClick={() => handleInsertCue(cue)}
                          className="px-2 py-1 text-xs font-mono bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors whitespace-nowrap"
                        >
                          {cue}
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={isPreparingScript !== null}
                        onClick={() => handlePrepareScript("add-pauses")}
                        className="px-2.5 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50 rounded-md transition-colors whitespace-nowrap"
                      >
                        {isPreparingScript === "add-pauses" ? "Adding pauses..." : "+ Auto Pauses"}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setScript("")}
                        className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={handleGenerateVoiceOver}
                        disabled={isGenerating}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
                      >
                        {isGenerating ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Mic className="w-3.5 h-3.5" />
                        )}
                        {isGenerating ? "Generating..." : "Generate Audio"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-5 flex flex-col gap-3">
                  {turns.map((turn, idx) => (
                    <div
                      key={turn.id}
                      className="flex flex-col sm:flex-row sm:items-start gap-3 pb-3 border-b border-slate-100 last:border-b-0 last:pb-0"
                    >
                      <div className="flex items-center gap-2 shrink-0 sm:w-36 pt-1">
                        <select
                          aria-label={`Speaker for line ${idx + 1}`}
                          value={turn.speaker}
                          onChange={(e) => {
                            const val = e.target.value as "A" | "B";
                            setTurns((prev) =>
                              prev.map((item) =>
                                item.id === turn.id ? { ...item, speaker: val } : item
                              )
                            );
                          }}
                          className="w-full px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:border-teal-700"
                        >
                          <option value="A">{speakerA || "Speaker 1"}</option>
                          <option value="B">{speakerB || "Speaker 2"}</option>
                        </select>
                      </div>

                      <textarea
                        dir="rtl"
                        rows={2}
                        value={turn.text}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTurns((prev) =>
                            prev.map((item) =>
                              item.id === turn.id ? { ...item, text: val } : item
                            )
                          );
                        }}
                        placeholder="مکالمہ یہاں اردو میں لکھیں..."
                        className="flex-1 font-urdu text-right text-base bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-slate-900 focus:outline-none focus:border-teal-700 resize-y"
                      />

                      {turns.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setTurns((prev) => prev.filter((item) => item.id !== turn.id))
                          }
                          aria-label="Delete line"
                          className="p-2 text-slate-400 hover:text-red-600 transition-colors self-end sm:self-start"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}

                  <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={handleAddTurn}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Dialogue Line
                    </button>

                    <button
                      type="button"
                      onClick={handleGenerateVoiceOver}
                      disabled={isGenerating}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
                    >
                      {isGenerating ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Mic className="w-3.5 h-3.5" />
                      )}
                      {isGenerating ? "Synthesizing Dialogue..." : "Generate Dialogue"}
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Audio Output Waveform Player */}
            <WaveformPlayer take={activeTake} isGenerating={isGenerating} />
          </div>

          {/* Right / Voice & Delivery Inspector */}
          <div className="lg:col-span-5 xl:col-span-4">
            <VoiceCastPanel
              mode={mode}
              selectedVoice={selectedVoice}
              onSelectVoice={(voice) => {
                setSelectedVoice(voice);
              }}
              selectedPresetId={selectedPresetId}
              onSelectPreset={(id, prompt) => {
                setSelectedPresetId(id);
                setCustomStyle(prompt);
              }}
              customStyle={customStyle}
              onChangeCustomStyle={(val) => {
                setCustomStyle(val);
                const match = DELIVERY_PRESETS.find((p) => p.stylePrompt === val);
                setSelectedPresetId(match ? match.id : "custom");
              }}
              engine={engine}
              onChangeEngine={setEngine}
              previewingVoice={previewingVoice}
              playingPreviewVoice={playingPreviewVoice}
              onPreviewVoice={handlePreviewVoice}
              speakerA={speakerA}
              onChangeSpeakerA={setSpeakerA}
              voiceA={voiceA}
              onChangeVoiceA={setVoiceA}
              styleA={styleA}
              onChangeStyleA={setStyleA}
              speakerB={speakerB}
              onChangeSpeakerB={setSpeakerB}
              voiceB={voiceB}
              onChangeVoiceB={setVoiceB}
              styleB={styleB}
              onChangeStyleB={setStyleB}
            />
          </div>
        </div>

        {/* Session Takes Table */}
        <TakesHistory
          takes={takes}
          activeTakeId={activeTake?.id ?? null}
          onSelectTake={(take) => setActiveTake(take)}
          onDeleteTake={handleDeleteTake}
        />
      </main>

      <footer className="border-t border-slate-200 bg-white mt-8">
        <div className="max-w-[1320px] mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>SadaStudio — Urdu Voice-Over &amp; Script Synthesis</span>
          <div className="flex items-center gap-4">
            <span>24 kHz 16-bit Mono WAV Export</span>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap"
            >
              <LogOut className="w-3 h-3" />
              Lock Studio
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
