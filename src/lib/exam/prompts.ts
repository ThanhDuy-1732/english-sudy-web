import type { ExamKind, ExamPart } from "./types";

interface PromptParams {
  kind: ExamKind;
  part: ExamPart;
  level: 1 | 2 | 3 | 4 | 5;
  topic?: string;
}

function levelToScore(level: number, kind: ExamKind): string {
  if (kind === "TOEIC") {
    const map = { 1: "400", 2: "500", 3: "650", 4: "780", 5: "900+" };
    return map[level as keyof typeof map] ?? "650";
  } else {
    const map = { 1: "4.5", 2: "5.0", 3: "6.0", 4: "7.0", 5: "8.0" };
    return map[level as keyof typeof map] ?? "6.0";
  }
}

const BASE_JSON_INSTRUCTION = `Return ONLY valid JSON. No markdown fences, no explanations before or after.`;

export function buildItemPrompt(params: PromptParams): string {
  const { kind, part, level, topic } = params;
  const topicStr = topic ?? "business";
  const score = levelToScore(level, kind);

  const builders: Partial<Record<ExamPart, () => string>> = {
    RC5: () => `You are an ETS-style TOEIC item writer.
Produce ONE Part 5 (Incomplete Sentences) set of exactly 6 questions.

Constraints:
- Each question is a single sentence with one blank (_____).
- 4 options per question (A, B, C, D), labelled exactly as option text.
- Difficulty: TOEIC ${score} band — control via grammar complexity and part-of-speech traps, NOT rare vocabulary.
- Topics: ${topicStr} (office, meetings, HR, finance, travel).
- answer must match exactly one of the 4 options.
- explanation: 1 sentence explaining the grammar rule.
- keyVocabulary: 1-3 business B2+ words from the question.

${BASE_JSON_INSTRUCTION}

{"kind":"TOEIC","part":"RC5","level":${level},"topic":"${topicStr}","questions":[{"type":"incomplete_sentence","prompt":"sentence with _____","options":["A","B","C","D"],"answer":"exact option text","explanation":"grammar reason","keyVocabulary":["word"]}]}`,

    RC6: () => `You are an ETS-style TOEIC item writer.
Produce ONE Part 6 (Text Completion) passage with 4 blanks.

Constraints:
- A coherent business text (email, memo, or announcement) with 4 fill-in-the-blank items.
- Each blank has 4 options. One blank should require a full sentence insertion.
- Difficulty: TOEIC ${score} band.
- Topic: ${topicStr}.
- Each answer must be one of its options exactly.
- explanation: 1-2 sentences, cite textual evidence.

${BASE_JSON_INSTRUCTION}

{"kind":"TOEIC","part":"RC6","level":${level},"topic":"${topicStr}","passage":"Full passage text with [BLANK_1] markers","questions":[{"type":"text_completion","prompt":"Choose the best word/phrase for blank 1.","options":["A","B","C","D"],"answer":"exact option","explanation":"reason"}]}`,

    RC7: () => `You are an ETS-style TOEIC item writer.
Produce ONE Part 7 single-passage reading set.

Constraints:
- One informational passage (article, email, notice, or advertisement), 150-250 words.
- Exactly 4 questions about the passage.
- Difficulty: TOEIC ${score} band.
- Topic: ${topicStr}.
- At least one question must require inference (answer not stated verbatim).
- Each distractor must be plausible; use passage words in wrong relations.
- explanation: cite the specific sentence/line that proves the answer.
- keyVocabulary: 2-4 B2+ words from the passage.

${BASE_JSON_INSTRUCTION}

{"kind":"TOEIC","part":"RC7","level":${level},"topic":"${topicStr}","passage":"passage text here","questions":[{"type":"single_passage","prompt":"question","options":["A","B","C","D"],"answer":"exact option","explanation":"reason citing passage","keyVocabulary":["word"]}]}`,

    LC3: () => `You are an ETS-style TOEIC item writer.
Produce ONE Part 3 conversation set.

Constraints:
- 2 or 3 speakers, labelled M1/W1/M2. 12-16 turns total, 130-180 words.
- Register: workplace American English. Topic: ${topicStr}.
- Difficulty: TOEIC ${score} band — control by sentence length, idiom density and paraphrase distance, NOT by rare vocabulary.
- Exactly 3 questions. At least ONE must require paraphrase (answer must NOT appear verbatim in the script).
- Each distractor must be plausible: use a real word from the script in a wrong relation.
- explanation: 1-2 sentences, name the exact line that proves the answer.
- keyVocabulary: 2-4 items, B2+ only, lemma form.

${BASE_JSON_INSTRUCTION}

{"kind":"TOEIC","part":"LC3","level":${level},"topic":"${topicStr}","script":[{"speaker":"M1","text":"..."}],"questions":[{"type":"conversation","prompt":"...","options":["A","B","C","D"],"answer":"exact option text","explanation":"...","keyVocabulary":["..."]}]}`,

    LC4: () => `You are an ETS-style TOEIC item writer.
Produce ONE Part 4 short talk set.

Constraints:
- One monologue speaker (NARRATOR). 100-150 words, 8-12 sentences.
- Register: formal announcements, voicemail, weather, tour guide. Topic: ${topicStr}.
- Difficulty: TOEIC ${score} band.
- Exactly 3 questions. At least one must require inference.
- explanation: cite specific sentence in the talk.
- keyVocabulary: 2-3 B2+ words.

${BASE_JSON_INSTRUCTION}

{"kind":"TOEIC","part":"LC4","level":${level},"topic":"${topicStr}","script":[{"speaker":"NARRATOR","text":"..."}],"questions":[{"type":"short_talk","prompt":"...","options":["A","B","C","D"],"answer":"exact option","explanation":"...","keyVocabulary":["..."]}]}`,

    LC2: () => `You are an ETS-style TOEIC item writer.
Produce 5 Part 2 question-response items.

Constraints:
- Each item: one question (W1 or M1), then 3 short response options (A, B, C).
- Only one response makes sense in context; others are plausible-sounding distractors.
- Difficulty: TOEIC ${score} band.
- explanation: why the correct response fits and why others don't.

${BASE_JSON_INSTRUCTION}

{"kind":"TOEIC","part":"LC2","level":${level},"topic":"${topicStr}","questions":[{"type":"question_response","prompt":"spoken question text","options":["A. response","B. response","C. response"],"answer":"A. response","explanation":"reason"}]}`,

    READ_P3: () => `You are an IELTS Academic Reading item writer.
Produce ONE IELTS Reading passage set.

Constraints:
- Academic passage, 250-350 words, formal register. Topic: ${topicStr}.
- 5 questions mixing at least 2 question types: True/False/Not Given, sentence completion, or MCQ.
- Difficulty: IELTS band ${score}.
- For T/F/NG: answer must be "True", "False", or "Not Given".
- For completion: short phrase answer (1-4 words), provide acceptableAnswers for variants.
- explanation: cite passage sentence for each answer.
- keyVocabulary: 3-5 academic words (B2-C1).

${BASE_JSON_INSTRUCTION}

{"kind":"IELTS","part":"READ_P3","level":${level},"topic":"${topicStr}","passage":"passage text","questions":[{"type":"true_false_ng","prompt":"statement","answer":"True","explanation":"The passage states..."}]}`,

    LISTEN_S1: () => `You are an IELTS Listening item writer.
Produce ONE Section 1 form-completion set.

Constraints:
- Conversation between 2 people filling in a form (booking, registration, enquiry).
- 6-8 form completion questions. Answers are short (1-3 words or numbers).
- Script: 2 speakers (M1 and W1), 15-20 turns, natural everyday English.
- Difficulty: IELTS band ${score}.
- Each answer spelled exactly as spoken; provide acceptableAnswers for abbreviations.
- explanation: quote the exact spoken phrase.

${BASE_JSON_INSTRUCTION}

{"kind":"IELTS","part":"LISTEN_S1","level":${level},"topic":"${topicStr}","script":[{"speaker":"W1","text":"Good morning, how can I help?"}],"questions":[{"type":"form_completion","prompt":"Customer's surname:","answer":"Smith","explanation":"W1 says 'My name is Smith'"}]}`,
  };

  const builder = builders[part];
  if (builder) return builder();

  // Fallback for unimplemented parts
  return `You are an expert ${kind} item writer.
Produce ONE ${kind} ${part} practice item at level ${level} (score ${score}).
Topic: ${topicStr}.
Include questions with options, answers, and explanations.
${BASE_JSON_INSTRUCTION}
{"kind":"${kind}","part":"${part}","level":${level},"topic":"${topicStr}","questions":[]}`;
}
