export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function createWavBlobUrl(base64: string, mimeType = "audio/wav"): { url: string; bytes: Uint8Array } {
  const bytes = base64ToUint8Array(base64);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  return { url, bytes };
}

/**
 * Extracts normalized amplitude peaks (0..1) and exact duration from a 24kHz 16-bit mono WAV file.
 */
export function analyzeWavBuffer(wavBytes: Uint8Array, barCount = 72): { peaks: number[]; durationSec: number } {
  const headerOffset = 44;
  if (wavBytes.length <= headerOffset) {
    return { peaks: new Array(barCount).fill(0.15), durationSec: 0 };
  }

  const view = new DataView(wavBytes.buffer, wavBytes.byteOffset, wavBytes.byteLength);
  let sampleRate = 24000;
  try {
    const sr = view.getUint32(24, true);
    if (sr >= 8000 && sr <= 96000) {
      sampleRate = sr;
    }
  } catch {
    sampleRate = 24000;
  }

  const pcmByteLength = wavBytes.length - headerOffset;
  const totalSamples = Math.floor(pcmByteLength / 2);
  const durationSec = totalSamples / sampleRate;

  const samplesPerBar = Math.max(1, Math.floor(totalSamples / barCount));
  const rawPeaks: number[] = [];

  for (let b = 0; b < barCount; b++) {
    const startSample = b * samplesPerBar;
    const endSample = Math.min(totalSamples, startSample + samplesPerBar);
    let maxAmp = 0;
    const step = Math.max(1, Math.floor((endSample - startSample) / 40));

    for (let s = startSample; s < endSample; s += step) {
      const byteIndex = headerOffset + s * 2;
      if (byteIndex + 1 < wavBytes.length) {
        const sample = Math.abs(view.getInt16(byteIndex, true)) / 32768;
        if (sample > maxAmp) maxAmp = sample;
      }
    }
    rawPeaks.push(maxAmp);
  }

  const highest = Math.max(...rawPeaks, 0.08);
  const peaks = rawPeaks.map((p) => Math.max(0.08, Math.min(1, p / highest)));
  return { peaks, durationSec };
}

export function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function triggerWavDownload(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".wav") ? filename : `${filename}.wav`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
