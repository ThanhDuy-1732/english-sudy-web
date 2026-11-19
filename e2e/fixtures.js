const { now, day } = require("./harness");

const word = (w, meaning, example) => ({ word: w, meaning, example, topic: "Daily Communication", learnedAt: now, updatedAt: now, reviewInterval: 1, mastery: 1, easiness: 2.5, repetitions: 0, nextReviewAt: now });
const feedbackW = (overall = 7, annotations = []) => ({ bands: { task: 7, coherence: 6.5, lexical: 6.5, grammar: 7 }, overall, wordCount: 162, annotations, modelAnswer: "The line graph illustrates…", nextFocus: "Paragraphing" });
const feedbackS = { transcript: "t", durationSec: 40, wordsPerMinute: 120, fillerCount: 2, bands: { fluency: 6.5, lexical: 6, grammar: 6, pronunciation: null }, overall: 6.5, strengths: ["clear"], improvements: [{ issue: "fillers", example: "um", better: "pause" }], upgradedVersion: "Better version." };
const unified = (i, skill, status) => ({ id: "m" + i, skill, category: "cat-" + i, source: skill + ":x", userAnswer: "wrong" + i, correctAnswer: "right" + i, explanation: "Because " + i, occurrenceCount: 1, status, createdAt: day(i), updatedAt: day(i) });
const examMistake = (id, resolved) => ({ id, source: "exam", skill: "reading", category: "incomplete_sentence", userAnswer: "complete", correctAnswer: "completed", explanation: "Past tense is required here.", occurrenceCount: 1, status: resolved ? "resolved" : "new", createdAt: now, updatedAt: now, exam: { part: "RC5", prompt: "The manager ___ the report.", userAnswer: "complete", correctAnswer: "completed", explanation: "Past tense is required here.", type: "incomplete_sentence" } });

/** Baseline data most scenarios start from. */
const baseSeed = () => ({
  learnedWords: [word("greet", "chào hỏi", "I greet my neighbours."), word("clarify", "làm rõ", "Could you clarify?"), word("interrupt", "ngắt lời", "Do not interrupt me."), word("respond", "phản hồi", "She did not respond."), word("suggestion", "gợi ý", "I have a suggestion.")],
  learningSessions: [0, 1, 2, 5, 8, 12].map((d, i) => ({ id: "s" + i, type: ["exam", "writing", "vocab", "grammar"][i % 4], startedAt: day(d), finishedAt: now, durationSeconds: 600 + i * 60, totalItems: 5, correctItems: 3 })),
  writingSubmissions: [{ id: "r1", taskId: "task1-line", kind: "ielts_task1", prompt: "The graph below shows…", content: "My essay text here.", wordCount: 162, feedback: feedbackW(), createdAt: now }],
  dailyChallenge: [{ date: now.slice(0, 10), words: ["greet"], completed: true }],
  studyTime: { [now.slice(0, 10)]: 1200 },
  unifiedMistakes: [examMistake("m1", false), examMistake("m2", false), examMistake("m3", true)],
});

const EXAM_ITEM = { id: "it1", kind: "TOEIC", part: "RC5", level: 3, topic: "business", createdAt: now, questions: [
  { id: "q1", type: "incomplete_sentence", prompt: "The marketing manager ______ the quarterly report before the meeting.", options: ["has completed", "had completed", "will complete", "completes"], answer: "had completed", explanation: "Past perfect shows the earlier action." },
  { id: "q2", type: "incomplete_sentence", prompt: "Please send the invoice ______ Friday.", options: ["by", "at", "on", "in"], answer: "by", explanation: "'By' marks a deadline." } ] };

const WORDS = [{ word: "greeting", meaning: "lời chào" }, { word: "small talk", meaning: "chuyện phiếm" }, { word: "exchange", meaning: "trao đổi" }, { word: "polite", meaning: "lịch sự" }, { word: "conversation", meaning: "cuộc trò chuyện" }];

const CONCEPTS = WORDS.map(({ word, meaning }, i) => ({ meaning, words: { en: { word }, zh: { word: ["问候", "闲聊", "交换", "礼貌", "对话"][i], reading: ["wènhòu", "xiánliáo", "jiāohuàn", "lǐmào", "duìhuà"][i] } } }));

/** Deterministic stand-ins for the AI endpoints used by many scenarios. Return true when a request was answered. */
function aiMocks(req, json, extra = {}) {
  const u = req.url();
  const table = {
    // Several languages ask for concepts; English-only keeps the plain word list.
    "/api/generate-words": (req) => (/"langs"/.test(req.postData() || "") ? { concepts: CONCEPTS } : WORDS),
    "/api/generate-sentence": { sentence: "She greeted everyone with a warm smile at the meeting." },
    "/api/generate-synonyms": { synonyms: ["hello", "welcome"], antonyms: ["farewell"] },
    // Chinese practice gets a Chinese sentence with its reading and translation; English is unchanged.
    "/api/generate-fillblank": (req) => (/"lang":"zh"/.test(req.postData() || "") ? { sentence: "我是_____。", reading: "wǒ shì _____.", translation: "Tôi là học sinh." } : { sentence: "I always ______ my neighbours." }),
    "/api/exam/generate-item": EXAM_ITEM,
    "/api/grammar-exercise": { type: "mcq", question: "She ______ to school every day.", options: ["go", "goes", "going", "gone"], answer: "goes" },
    ...extra,
  };
  for (const [path, body] of Object.entries(table)) if (u.endsWith(path)) return json(req, typeof body === "function" ? body(req) : body);
  return false;
}

module.exports = { word, feedbackW, feedbackS, unified, examMistake, baseSeed, EXAM_ITEM, WORDS, aiMocks };
