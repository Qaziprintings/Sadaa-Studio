import React from "react";
import { Loader2, Play, Square, Volume2 } from "lucide-react";
import {
  DELIVERY_PRESETS,
  PrebuiltVoiceName,
  TtsEngineId,
  VOICE_PROFILES,
} from "../data/voices";

interface VoiceCastPanelProps {
  mode: "single" | "dialogue";
  selectedVoice: PrebuiltVoiceName;
  onSelectVoice: (voice: PrebuiltVoiceName) => void;
  selectedPresetId: string;
  onSelectPreset: (presetId: string, stylePrompt: string) => void;
  customStyle: string;
  onChangeCustomStyle: (val: string) => void;
  engine: TtsEngineId;
  onChangeEngine: (engine: TtsEngineId) => void;
  previewingVoice: PrebuiltVoiceName | null;
  playingPreviewVoice: PrebuiltVoiceName | null;
  onPreviewVoice: (voice: PrebuiltVoiceName) => void;
  // Dual dialogue settings
  speakerA: string;
  onChangeSpeakerA: (val: string) => void;
  voiceA: PrebuiltVoiceName;
  onChangeVoiceA: (val: PrebuiltVoiceName) => void;
  styleA: string;
  onChangeStyleA: (val: string) => void;
  speakerB: string;
  onChangeSpeakerB: (val: string) => void;
  voiceB: PrebuiltVoiceName;
  onChangeVoiceB: (val: PrebuiltVoiceName) => void;
  styleB: string;
  onChangeStyleB: (val: string) => void;
}

export const VoiceCastPanel: React.FC<VoiceCastPanelProps> = ({
  mode,
  selectedVoice,
  onSelectVoice,
  selectedPresetId,
  onSelectPreset,
  customStyle,
  onChangeCustomStyle,
  engine,
  onChangeEngine,
  previewingVoice,
  playingPreviewVoice,
  onPreviewVoice,
  speakerA,
  onChangeSpeakerA,
  voiceA,
  onChangeVoiceA,
  styleA,
  onChangeStyleA,
  speakerB,
  onChangeSpeakerB,
  voiceB,
  onChangeVoiceB,
  styleB,
  onChangeStyleB,
}) => {
  if (mode === "dialogue") {
    return (
      <aside id="voices" className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-6">
        <div className="border-b border-slate-200 pb-4">
          <h2 className="text-base font-semibold text-slate-900">Dual-Speaker Cast</h2>
          <p className="text-xs text-slate-500 mt-1">
            Assign distinct voices and delivery notes for two Urdu speakers using{" "}
            <span className="font-mono text-slate-700">gemini-3.8-flash-tts</span>.
          </p>
        </div>

        {/* Speaker A */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800">Speaker 1</span>
            <button
              type="button"
              onClick={() => onPreviewVoice(voiceA)}
              disabled={previewingVoice === voiceA}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap"
            >
              {previewingVoice === voiceA ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : playingPreviewVoice === voiceA ? (
                <Square className="w-3 h-3 fill-current" />
              ) : (
                <Play className="w-3 h-3 fill-current" />
              )}
              {playingPreviewVoice === voiceA ? "Stop Sample" : `Preview ${voiceA}`}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Speaker Name</span>
              <input
                type="text"
                value={speakerA}
                onChange={(e) => onChangeSpeakerA(e.target.value)}
                placeholder="Bilal"
                className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Voice</span>
              <select
                value={voiceA}
                onChange={(e) => onChangeVoiceA(e.target.value as PrebuiltVoiceName)}
                className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
              >
                {VOICE_PROFILES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.displayName} ({v.gender})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Delivery Style</span>
            <input
              type="text"
              value={styleA}
              onChange={(e) => onChangeStyleA(e.target.value)}
              placeholder="Warm, engaging podcast host"
              className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
            />
          </label>
        </div>

        <hr className="border-slate-200" />

        {/* Speaker B */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800">Speaker 2</span>
            <button
              type="button"
              onClick={() => onPreviewVoice(voiceB)}
              disabled={previewingVoice === voiceB}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap"
            >
              {previewingVoice === voiceB ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : playingPreviewVoice === voiceB ? (
                <Square className="w-3 h-3 fill-current" />
              ) : (
                <Play className="w-3 h-3 fill-current" />
              )}
              {playingPreviewVoice === voiceB ? "Stop Sample" : `Preview ${voiceB}`}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Speaker Name</span>
              <input
                type="text"
                value={speakerB}
                onChange={(e) => onChangeSpeakerB(e.target.value)}
                placeholder="Ayesha"
                className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Voice</span>
              <select
                value={voiceB}
                onChange={(e) => onChangeVoiceB(e.target.value as PrebuiltVoiceName)}
                className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
              >
                {VOICE_PROFILES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.displayName} ({v.gender})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Delivery Style</span>
            <input
              type="text"
              value={styleB}
              onChange={(e) => onChangeStyleB(e.target.value)}
              placeholder="Thoughtful, articulate guest"
              className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
            />
          </label>
        </div>

        <div className="pt-2 border-t border-slate-200 text-xs text-slate-500 leading-relaxed">
          Tip: Insert <span className="font-mono text-slate-700">&lt;breath&gt;</span>,{" "}
          <span className="font-mono text-slate-700">&lt;laugh&gt;</span>, or{" "}
          <span className="font-mono text-slate-700">|yeah|</span> inside dialogue lines for
          natural conversational pacing.
        </div>
      </aside>
    );
  }

  return (
    <aside id="voices" className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Voice &amp; Delivery</h2>
          <p className="text-xs text-slate-500 mt-1">
            Choose a studio narrator voice and tone for Urdu synthesis.
          </p>
        </div>
        <Volume2 className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
      </div>

      {/* Voice Cast List */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-slate-700">Voice Cast</span>
        <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
          {VOICE_PROFILES.map((voice) => {
            const isSelected = selectedVoice === voice.id;
            const isLoadingPreview = previewingVoice === voice.id;
            const isPlayingPreview = playingPreviewVoice === voice.id;

            return (
              <div
                key={voice.id}
                className={`flex items-center justify-between gap-3 px-3.5 py-3 transition-colors ${
                  isSelected ? "bg-teal-50/70" : "bg-white hover:bg-slate-50"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectVoice(voice.id)}
                  className="flex-1 text-left min-w-0 focus:outline-none"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={`text-sm font-semibold ${
                        isSelected ? "text-teal-800" : "text-slate-900"
                      }`}
                    >
                      {voice.displayName}
                    </span>
                    <span dir="rtl" className="font-urdu-compact text-xs text-slate-600 truncate">
                      {voice.urduTitle}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 truncate">
                    {voice.gender} <span aria-hidden="true">·</span> {voice.timbre}{" "}
                    <span aria-hidden="true">·</span> {voice.bestFor}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onPreviewVoice(voice.id)}
                  disabled={isLoadingPreview}
                  aria-label={`Preview ${voice.displayName} Urdu sample`}
                  className={`px-2.5 py-1.5 rounded-md border text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                    isPlayingPreview
                      ? "bg-teal-700 text-white border-teal-700"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {isLoadingPreview ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : isPlayingPreview ? (
                    <Square className="w-3 h-3 fill-current" />
                  ) : (
                    <Play className="w-3 h-3 fill-current" />
                  )}
                  {isPlayingPreview ? "Stop" : "Preview"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Delivery Style Presets */}
      <div className="flex flex-col gap-2.5">
        <span className="text-xs font-semibold text-slate-700">Delivery Style</span>
        <div className="flex flex-wrap gap-1.5">
          {DELIVERY_PRESETS.map((preset) => {
            const active = selectedPresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectPreset(preset.id, preset.stylePrompt)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <label className="flex flex-col gap-1 mt-1">
          <span className="text-xs text-slate-500">Custom Voice Direction</span>
          <textarea
            rows={2}
            value={customStyle}
            onChange={(e) => onChangeCustomStyle(e.target.value)}
            placeholder="Describe pacing, warmth, or broadcast tone..."
            className="w-full px-3 py-2 text-xs leading-relaxed bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-teal-700 resize-none"
          />
        </label>
      </div>

      {/* Engine Model Selection */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-200">
        <span className="text-xs font-semibold text-slate-700">Voice Engine</span>
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => onChangeEngine("gemini-3.8-flash-lite-tts")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              engine === "gemini-3.8-flash-lite-tts"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Standard Fast
          </button>
          <button
            type="button"
            onClick={() => onChangeEngine("gemini-3.8-flash-tts")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              engine === "gemini-3.8-flash-tts"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Expressive Studio
          </button>
        </div>
        <p className="text-xs text-slate-500">
          {engine === "gemini-3.8-flash-lite-tts"
            ? "Low-latency synthesis ideal for articles, news, and narration."
            : "Supports custom voice design and vocal cues like <breath> or <laugh>."}
        </p>
      </div>
    </aside>
  );
};
