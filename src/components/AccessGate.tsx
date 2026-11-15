import React, { useState } from "react";
import { AlertCircle, ArrowRight, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";

interface AccessGateProps {
  configured: boolean;
  onAuthenticated: (token: string) => void;
}

export const AccessGate: React.FC<AccessGateProps> = ({ configured, onAuthenticated }) => {
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!code.trim()) {
      setError("Please enter the studio access code.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Invalid access code.");
      }
      onAuthenticated(data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to verify access code.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] text-slate-900">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-[1320px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            SadaStudio
          </span>
          <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
            Private Studio Access
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-200/70 flex items-center justify-center text-teal-700 mb-1">
              <KeyRound className="w-5 h-5" />
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Enter Studio Access Code
              </h1>
              <span dir="rtl" className="font-urdu-compact text-sm text-slate-600">
                صدا اسٹوڈیو
              </span>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              This Urdu voice-over workspace is restricted. Enter the secret access code to unlock
              script preparation and voice synthesis.
            </p>
          </div>

          {!configured && (
            <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 leading-relaxed">
              <strong className="font-semibold block mb-0.5">Access code not configured yet</strong>
              Add <span className="font-mono font-semibold">STUDIO_ACCESS_CODE</span> in{" "}
              <span className="font-semibold">Settings &gt; Secrets</span> to enable studio login.
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-700">Secret Access Code</span>
              <div className="relative">
                <input
                  type={showCode ? "text" : "password"}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoFocus
                  autoComplete="current-password"
                  placeholder="Enter secret code..."
                  className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
                />
                <button
                  type="button"
                  onClick={() => setShowCode((s) => !s)}
                  aria-label={showCode ? "Hide access code" : "Show access code"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 transition-colors"
                >
                  {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </label>

            <button
              type="submit"
              disabled={isSubmitting || !configured}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  Unlock Studio
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-[1320px] mx-auto px-6 py-4 flex items-center justify-between text-xs text-slate-500">
          <span>SadaStudio — Urdu Voice-Over Studio</span>
          <span>Authorized Access Only</span>
        </div>
      </footer>
    </div>
  );
};
