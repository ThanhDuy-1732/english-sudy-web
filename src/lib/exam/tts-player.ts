import type { AudioLine } from "./types";

const VOICE_ROLE: Record<AudioLine["speaker"], { gender: "male" | "female" }> = {
  M1: { gender: "male" },
  M2: { gender: "male" },
  W1: { gender: "female" },
  W2: { gender: "female" },
  NARRATOR: { gender: "female" },
};

function pickVoice(gender: "male" | "female"): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
  return (
    voices.find((v) =>
      gender === "male"
        ? /male|david|alex|google uk english male/i.test(v.name)
        : /female|zira|samantha|google us english/i.test(v.name)
    ) ?? voices[0] ?? null
  );
}

export interface PlayOptions {
  rate?: number; // 0.8–1.2, default 1.0
  onLine?: (index: number) => void; // called when each line starts
  signal?: AbortSignal;
}

export async function playScript(
  lines: AudioLine[],
  { rate = 1.0, onLine, signal }: PlayOptions = {}
): Promise<void> {
  // Ensure voices are loaded (Chrome loads them async)
  if (speechSynthesis.getVoices().length === 0) {
    await new Promise<void>((resolve) => {
      speechSynthesis.addEventListener("voiceschanged", () => resolve(), { once: true });
    });
  }

  for (let i = 0; i < lines.length; i++) {
    if (signal?.aborted) break;
    onLine?.(i);
    await new Promise<void>((resolve, reject) => {
      const u = new SpeechSynthesisUtterance(lines[i].text);
      const voice = pickVoice(VOICE_ROLE[lines[i].speaker].gender);
      if (voice) u.voice = voice;
      u.rate = rate;
      u.onend = () => resolve();
      u.onerror = (e) => reject(e);
      speechSynthesis.speak(u);
    });
    // Gap between speakers
    await new Promise<void>((r) => setTimeout(r, 250));
  }
}

export function stopPlayback() {
  speechSynthesis.cancel();
}
