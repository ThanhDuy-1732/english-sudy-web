import { asObject } from "./safe-json";
const KEY = "learningProfile";

export type LearningGoal = "communication" | "toeic" | "ielts" | "vocabulary" | "mixed";

export interface LearningProfile {
  goal: LearningGoal;
  currentLevel: 1 | 2 | 3 | 4 | 5;
  dailyStudyMinutes: number;
  targetToeicScore?: number;
  targetIeltsScore?: number;
  targetDate?: string;
  shortcutsEnabled: boolean;
  /** Daily study reminder time "HH:MM" (in-app banner after this time, and the .ics calendar event). */
  reminderTime: string;
}

const DEFAULTS: LearningProfile = {
  goal: "mixed",
  currentLevel: 2,
  dailyStudyMinutes: 30,
  shortcutsEnabled: true,
  reminderTime: "20:00",
};

export function getProfile(): LearningProfile {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...asObject<Partial<LearningProfile>>(JSON.parse(raw), {}) } : DEFAULTS;
  } catch { return DEFAULTS; }
}

export function saveProfile(profile: LearningProfile): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(profile));
}

export function updateProfile(partial: Partial<LearningProfile>): void {
  saveProfile({ ...getProfile(), ...partial });
}
