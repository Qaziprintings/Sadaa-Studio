import React from "react";
import { Download, Play, Trash2 } from "lucide-react";
import { StudioTake } from "./WaveformPlayer";
import { formatTimecode, triggerWavDownload } from "../utils/audio";

interface TakesHistoryProps {
  takes: StudioTake[];
  activeTakeId: string | null;
  onSelectTake: (take: StudioTake) => void;
  onDeleteTake: (id: string) => void;
}

export const TakesHistory: React.FC<TakesHistoryProps> = ({
  takes,
  activeTakeId,
  onSelectTake,
  onDeleteTake,
}) => {
  return (
    <section
      id="takes"
      aria-label="Session takes library"
      className="bg-white border border-slate-200 rounded-xl overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Session Takes</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Compare generated Urdu voice-over renders and download WAV masters.
          </p>
        </div>
        <span className="text-xs font-mono tabular-nums text-slate-500">
          {takes.length} {takes.length === 1 ? "take" : "takes"}
        </span>
      </div>

      {takes.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm font-medium text-slate-700">No rendered takes in this session</p>
          <p className="text-xs text-slate-500 mt-1">
            Each generated voice-over will appear here for side-by-side playback and export.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th className="py-2.5 px-5">Script Excerpt</th>
                <th className="py-2.5 px-4 whitespace-nowrap">Voice</th>
                <th className="py-2.5 px-4 whitespace-nowrap">Style</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">Duration</th>
                <th className="py-2.5 px-5 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {takes.map((take) => {
                const isActive = take.id === activeTakeId;
                return (
                  <tr
                    key={take.id}
                    className={`transition-colors ${
                      isActive ? "bg-teal-50/50" : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="py-3 px-5 max-w-md">
                      <p
                        dir="rtl"
                        className="font-urdu-compact text-sm text-slate-900 truncate"
                      >
                        {take.scriptPreview}
                      </p>
                      <p className="text-xs text-slate-400 font-mono tabular-nums mt-0.5">
                        {take.createdAt} <span aria-hidden="true">·</span> {take.modelUsed}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-800 whitespace-nowrap">
                      {take.voiceLabel}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                      {take.styleLabel}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono tabular-nums text-slate-700 text-right whitespace-nowrap">
                      {formatTimecode(take.durationSec)}
                    </td>
                    <td className="py-3 px-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSelectTake(take)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                            isActive
                              ? "bg-teal-700 text-white border-teal-700"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          <Play className="w-3 h-3 fill-current" />
                          {isActive ? "Loaded" : "Load"}
                        </button>
                        <button
                          type="button"
                          onClick={() => triggerWavDownload(take.audioUrl, take.filename)}
                          aria-label="Download WAV"
                          title="Download WAV"
                          className="p-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteTake(take.id)}
                          aria-label="Remove take"
                          title="Remove take"
                          className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
