export type ExamKind = "TOEIC" | "IELTS";

export type ToeicPart = "LC1" | "LC2" | "LC3" | "LC4" | "RC5" | "RC6" | "RC7";
export type IeltsPart =
  | "LISTEN_S1"
  | "LISTEN_S2"
  | "LISTEN_S3"
  | "LISTEN_S4"
  | "READ_P1"
  | "READ_P2"
  | "READ_P3";
export type ExamPart = ToeicPart | IeltsPart;

export type QuestionType =
  | "photo_description" // TOEIC P1
  | "question_response" // TOEIC P2
  | "conversation" // TOEIC P3
  | "short_talk" // TOEIC P4
  | "incomplete_sentence" // TOEIC P5
  | "text_completion" // TOEIC P6
  | "single_passage" // TOEIC P7
  | "multiple_passage" // TOEIC P7
  | "mcq" // IELTS
  | "true_false_ng" // IELTS Reading
  | "yes_no_ng" // IELTS Reading
  | "matching_headings"
  | "matching_information"
  | "sentence_completion"
  | "summary_completion"
  | "form_completion" // IELTS Listening S1
  | "map_labelling"; // bỏ qua ở v1 (cần hình)

export interface AudioLine {
  speaker: "M1" | "W1" | "M2" | "W2" | "NARRATOR";
  text: string;
}

export interface ExamQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  options?: string[];
  answer: string;
  acceptableAnswers?: string[];
  explanation: string;
  keyVocabulary?: string[];
  timeLimitSec?: number;
}

export interface ExamItem {
  id: string;
  kind: ExamKind;
  part: ExamPart;
  level: 1 | 2 | 3 | 4 | 5;
  topic?: string;
  passage?: string;
  script?: AudioLine[];
  imagePrompt?: string;
  questions: ExamQuestion[];
  createdAt: string;
  providerUsed?: string;
}

export interface ExamAttempt {
  id: string;
  kind: ExamKind;
  mode: "drill" | "mock";
  parts: ExamPart[];
  startedAt: string;
  finishedAt?: string;
  answers: AnswerRecord[];
  score?: ScoreResult;
}

export interface AnswerRecord {
  itemId: string;
  questionId: string;
  type: QuestionType;
  part: ExamPart;
  userAnswer: string;
  correct: boolean;
  timeSpentSec: number;
  flagged?: boolean;
}

export interface ScoreResult {
  raw: { correct: number; total: number };
  byPart: Record<string, { correct: number; total: number }>;
  byType: Record<string, { correct: number; total: number }>;
  toeic?: { listening: number; reading: number; total: number };
  ielts?: { listening?: number; reading?: number };
}

export interface MistakeEntry {
  id: string;
  questionId: string;
  itemId: string;
  type: QuestionType;
  part: ExamPart;
  prompt: string;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
  createdAt: string;
  reviewedAt?: string;
  resolved: boolean;
}

export interface ExamSettings {
  primaryExam: ExamKind;
  targetToeic?: number;
  targetIelts?: number;
  level: 1 | 2 | 3 | 4 | 5;
  listeningRate: number;
  autoAdvance: boolean;
}
