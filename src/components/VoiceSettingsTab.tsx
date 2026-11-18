"use client";

import { useEffect, useRef, useState } from "react";
import { useVoiceSettings } from "@/lib/useVoiceSettings";
import { DEFAULT_VOICE_SETTINGS, type VoiceSettings } from "@/lib/voiceSettings";

const SLIDERS = [
  { field: "rate" as const, label: "Tốc độ (Rate)", min: 0.5, max: 2.0, step: 0.1 },
  { field: "pitch" as const, label: "Cao độ (Pitch)", min: 0.5, max: 2.0, step: 0.1 },
  { field: "volume" as const, label: "Âm lượng (Volume)", min: 0.0, max: 1.0, step: 0.1 },
];

type SliderField = (typeof SLIDERS)[number]["field"];

export default function VoiceSettingsTab() {
  const { settings, update } = useVoiceSettings();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [sliders, setSliders] = useState({
    rate: settings.rate,
    pitch: settings.pitch,
    volume: settings.volume,
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSliders({
      rate: settings.rate,
      pitch: settings.pitch,
      volume: settings.volume,
    });
  }, [settings.rate, settings.pitch, settings.volume]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    function loadVoices() {
      setVoices(window.speechSynthesis.getVoices().filter((voice) => voice.lang.startsWith("en")));
    }

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleSlider(field: SliderField, value: number) {
    setSliders((current) => ({ ...current, [field]: value }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => update({ [field]: value }), 300);
  }

  function handleTest() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance("Hello, this is a test.");
    const voice = voices.find((item) => item.voiceURI === settings.voiceURI) ?? null;
    if (voice) utterance.voice = voice;
    utterance.lang = "en-US";
    utterance.rate = sliders.rate;
    utterance.pitch = sliders.pitch;
    utterance.volume = sliders.volume;
    window.speechSynthesis.speak(utterance);
  }

  function handleReset() {
    const defaults: VoiceSettings = { ...DEFAULT_VOICE_SETTINGS };
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSliders({
      rate: defaults.rate,
      pitch: defaults.pitch,
      volume: defaults.volume,
    });
    update(defaults);
  }

  return (
    <div className="space-y-8">
      <div>
        <label className="mb-2 block text-sm font-medium text-ink" htmlFor="voice-select">
          Giọng đọc
        </label>
        <div className="flex gap-3">
          <select
            id="voice-select"
            value={settings.voiceURI ?? ""}
            onChange={(event) => update({ voiceURI: event.target.value || null })}
            className="field flex-1 text-sm"
          >
            <option value="">Mặc định hệ thống</option>
            {voices.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name} · {voice.localService ? "Offline" : "Online"}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleTest}
            className="shrink-0 rounded-full bg-ink/5 px-3 py-2 text-sm font-medium text-ink hover:bg-ink/5"
          >
            Thử nghe
          </button>
        </div>
      </div>

      {SLIDERS.map(({ field, label, min, max, step }) => (
        <div key={field}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-ink">{label}</span>
            <span className="text-sm text-muted">{sliders[field].toFixed(1)}</span>
          </div>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={sliders[field]}
            onChange={(event) => handleSlider(field, parseFloat(event.target.value))}
            className="w-full accent-blue-500"
          />
        </div>
      ))}

      <button
        type="button"
        onClick={handleReset}
        className="rounded-full border border-rule px-4 py-2 text-sm text-muted hover:bg-ink/5"
      >
        Reset về mặc định
      </button>
    </div>
  );
}
