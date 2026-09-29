import type { AITaskName } from "./ai-tasks";

export interface PromptDefinition {
  task: AITaskName;
  version: string;
  description: string;
  buildPrompt: (input: Record<string, unknown>) => string;
  outputDescription: string;
}

export const PROMPTS: Partial<Record<AITaskName, PromptDefinition>> = {
  "word-generation": {
    task: "word-generation",
    version: "1.0",
    description: "Generate vocabulary words for a given topic",
    buildPrompt: ({ topic, count = 10 }) =>
      `Generate ${count as number} English vocabulary words for the topic: "${topic as string}".
Return a JSON array: [{"word": "...", "meaning": "Vietnamese meaning"}].
Only the JSON array, no explanation.`,
    outputDescription: '{"word": string, "meaning": string}[]',
  },
  "sentence-generation": {
    task: "sentence-generation",
    version: "1.0",
    description: "Generate an example sentence for a word",
    buildPrompt: ({ word }) =>
      `Write one natural English example sentence using the word "${word as string}".
Return only the sentence, no explanation.`,
    outputDescription: "string",
  },
  "grammar-generation": {
    task: "grammar-generation",
    version: "1.0",
    description: "Generate a grammar topic with rules and examples",
    buildPrompt: ({ request }) =>
      `Create a grammar topic about: "${request as string}".
Return structured JSON with title, description, and subRules array.`,
    outputDescription: "GrammarTopic JSON",
  },
  "exam-generation": {
    task: "exam-generation",
    version: "1.0",
    description: "Generate an exam question item",
    buildPrompt: ({ kind, part, level, topic }) =>
      `Generate a ${kind as string} ${part as string} Level ${level as number} exam question${topic ? ` about "${topic as string}"` : ""}.
Return valid ExamItem JSON.`,
    outputDescription: "ExamItem JSON",
  },
  "speaking-grade": {
    task: "speaking-grade",
    version: "1.0",
    description: "Grade a speaking transcript on IELTS band criteria",
    buildPrompt: ({ task, durationSec }) =>
      `Grade this ${task as string} speaking attempt (${durationSec as number}s) on IELTS criteria.
Transcript: [not logged for privacy]
Return SpeakingFeedback JSON with bands (fluency, lexical, grammar, pronunciation), overall, strengths, improvements.`,
    outputDescription: "SpeakingFeedback JSON",
  },
  "writing-grade": {
    task: "writing-grade",
    version: "1.0",
    description: "Grade a writing submission on IELTS/TOEIC criteria",
    buildPrompt: ({ kind, prompt: writingPrompt }) =>
      `Grade this ${kind as string} writing submission.
Task: "${writingPrompt as string}"
Content: [not logged for privacy]
Return WritingFeedback JSON with bands (task, coherence, lexical, grammar), overall, annotations, modelAnswer, nextFocus.`,
    outputDescription: "WritingFeedback JSON",
  },
  "vocab-context": {
    task: "vocab-context",
    version: "1.0",
    description: "Generate context text using target vocabulary words",
    buildPrompt: ({ words, format }) =>
      `Create a ${format as string} in English that uses ALL of these words: ${(words as string[]).join(", ")}.
Mark each target word with **bold**. Return only the text.`,
    outputDescription: "string",
  },
};

export function getPrompt(task: AITaskName): PromptDefinition | undefined {
  return PROMPTS[task];
}
