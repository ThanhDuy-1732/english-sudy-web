"use client";

import { useRef, useState } from "react";
import { type VoiceSettings, getVoiceSettings, saveVoiceSettings } from "./voiceSettings";

export function useVoiceSettings() {
  const [settings, setSettings] = useState<VoiceSettings>(() => getVoiceSettings());
  const settingsRef = useRef(settings);

  function update(partial: Partial<VoiceSettings>) {
    const next = { ...settingsRef.current, ...partial };
    settingsRef.current = next;
    setSettings(next);
    saveVoiceSettings(next);
  }

  return { settings, update };
}
