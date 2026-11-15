import React, { useEffect, useRef, useState } from "react";
import { Download, Pause, Play, RotateCcw, Volume2 } from "lucide-react";
import { formatTimecode, triggerWavDownload } from "../utils/audio";

export interface StudioTake {
  id: string;
  createdAt: string;
  mode: "single" | "dialogue";
  voiceLabel: string;
  styleLabel: string;
  modelUsed: string;
  scriptPreview: string;
  audioUrl: string;
  peaks: number[];
  durationSec: number;
  filename: string;
}

interface WaveformPlayerProps {
  take: StudioTake | null;
  isGenerating: boolean;
}

const SPEED_OPTIONS = [0.85, 1, 1.15, 1.25] as const;

export const WaveformPlayer: React.FC<WaveformPlayerProps> = ({ take, isGenerating }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(take?.durationSec ?? 0);

    const audio = audioRef.current;
    if (!audio || !take) return;
    audio.pause();
    audio.src = take.audioUrl;
    audio.playbackRate = playbackRate;
    audio.load();
  }, [take?.id, take?.audioUrl]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !take) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    }
  };

  const handleRestart = () => {
    const audio = audioRef.current;
    if (!audio || !take) return;
    audio.currentTime = 0;
    setCurrentTime(0);
  };

  const handleBarSeek = (index: number, total: number) => {
    const audio = audioRef.current;
    if (!audio || !take) return;
    const effectiveDuration = duration || take.durationSec;
    if (!effectiveDuration) return;
    const targetTime = ((index + 0.5) / total) * effectiveDuration;
    audio.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const effectiveDuration = duration || take?.durationSec || 0;
  const progressRatio = effectiveDuration > 0 ? Math.min(1, currentTime / effectiveDuration) : 0;

  return (
    <section
      aria-label="Audio output player"
      className="bg-white border border-slate-200 rounded-xl p-5"
    >
      <audio
        ref={audioRef}
        onTimeUpdate={() => {
          if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
        }}
        onLoadedMetadata={() => {
          if (audioRef.current && Number.isFinite(audioRef.current.duration)) {
            setDuration(audioRef.current.duration);
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
      />

      {isGenerating ? (
        <div className="flex flex-col gap-3 py-2">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span className="font-medium text-slate-900">Synthesizing Urdu audio master...</span>
            <span className="font-mono tabular-nums">24 kHz · WAV</span>
          </div>
          <div className="h-14 flex items-center gap-1 px-2 bg-slate-50 rounded-lg border border-slate-200">
            {Array.from({ length: 48 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm bg-slate-200 animate-pulse"
                style={{ height: `${24 + ((i * 19) % 55)}%` }}
              />
            ))}
          </div>
        </div>
      ) : !take ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2 text-slate-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
              <Volume2 className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">No audio take generated yet</p>
              <p className="text-xs text-slate-500">
                Select a voice profile and click Generate Voice-Over to render a 24 kHz WAV master.
              </p>
            </div>
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-400 whitespace-nowrap">
            00:00 / 00:00
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={togglePlay}
                aria-label={isPlaying ? "Pause audio" : "Play audio"}
                className="w-10 h-10 rounded-lg bg-teal-700 hover:bg-teal-800 text-white flex items-center justify-center transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>
              <button
                type="button"
                onClick={handleRestart}
                aria-label="Restart audio"
                title="Restart from beginning"
                className="w-9 h-9 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 flex items-center justify-center transition-colors shrink-0"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{take.voiceLabel}</p>
                <p className="text-xs text-slate-500 truncate">
                  {take.styleLabel} <span aria-hidden="true">·</span> {take.modelUsed}{" "}
                  <span aria-hidden="true">·</span> 24 kHz WAV
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                {SPEED_OPTIONS.map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setPlaybackRate(rate)}
                    className={`px-2 py-1 text-xs font-mono tabular-nums rounded-md transition-colors whitespace-nowrap ${
                      playbackRate === rate
                        ? "bg-white text-slate-900 font-semibold shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>

              <span className="text-xs font-mono tabular-nums text-slate-700 whitespace-nowrap">
                {formatTimecode(currentTime)} / {formatTimecode(effectiveDuration)}
              </span>

              <button
                type="button"
                onClick={() => triggerWavDownload(take.audioUrl, take.filename)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                Download WAV
              </button>
            </div>
          </div>

          <div
            role="slider"
            aria-label="Audio waveform progress"
            aria-valuemin={0}
            aria-valuemax={Math.round(effectiveDuration)}
            aria-valuenow={Math.round(currentTime)}
            tabIndex={0}
            className="h-14 flex items-center gap-[3px] px-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer select-none"
          >
            {take.peaks.map((peak, idx) => {
              const barRatio = (idx + 0.5) / take.peaks.length;
              const isPlayed = barRatio <= progressRatio;
              return (
                <button
                  key={idx}
                  type="button"
                  aria-label={`Seek to ${Math.round(barRatio * 100)}%`}
                  onClick={() => handleBarSeek(idx, take.peaks.length)}
                  className="flex-1 h-full flex items-center justify-center group focus:outline-none"
                >
                  <span
                    className={`w-full rounded-sm transition-colors ${
                      isPlayed
                        ? "bg-teal-700"
                        : "bg-slate-300 group-hover:bg-slate-400"
                    }`}
                    style={{ height: `${Math.max(14, Math.round(peak * 86))}%` }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
