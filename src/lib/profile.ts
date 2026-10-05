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
}

const DEFAULTS: LearningProfile = {
  goal: "mixed",
  currentLevel: 2,
  dailyStudyMinutes: 30,
  shortcutsEnabled: true,
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
