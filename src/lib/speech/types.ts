export interface SpeakingTask {
  id: string;
  mode:
    | "ielts_p1"
    | "ielts_p2"
    | "ielts_p3"
    | "toeic_speaking"
    | "roleplay"
    | "shadowing";
  prompt: string;
  cueCard?: { topic: string; bullets: string[] };
  prepSec: number;
  speakSec: number;
  targetBand?: number;
}

export interface SpeakingFeedback {
  transcript: string;
  durationSec: number;
  wordsPerMinute: number;
  fillerCount: number;
  bands: {
    fluency: number;
    lexical: number;
    grammar: number;
    pronunciation: number | null; // null = cannot score from transcript
  };
  overall: number;
  strengths: string[];
  improvements: { issue: string; example: string; better: string }[];
  upgradedVersion: string;
  newVocabulary: string[];
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptResult {
  text: string;
  durationSec: number;
  segments: TranscriptSegment[];
}

export interface Scenario {
  id: string;
  title: string;
  level: 1 | 2 | 3 | 4 | 5;
  aiRole: string;
  userRole: string;
  goal: string;
  mustUse?: string[];
  maxTurns: number;
}

export interface ConversationTurn {
  role: "user" | "ai";
  text: string;
  reading?: string;            // AI reply's pinyin / kana / romanization
  audioId?: string;
  correction?: { original: string; fixed: string; note: string } | null;
}
