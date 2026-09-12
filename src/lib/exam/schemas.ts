import { z } from "zod";

export const AudioLineSchema = z.object({
  speaker: z.enum(["M1", "W1", "M2", "W2", "NARRATOR"]),
  text: z.string().min(1),
});

export const ExamQuestionSchema = z
  .object({
    id: z.string().optional().default(() => crypto.randomUUID()),
    type: z.string(),
    prompt: z.string().min(5),
    options: z.array(z.string()).min(3).max(4).optional(),
    answer: z.string().min(1),
    acceptableAnswers: z.array(z.string()).optional(),
    explanation: z.string().min(10),
    keyVocabulary: z.array(z.string()).max(6).optional(),
    timeLimitSec: z.number().optional(),
  })
  .refine((q) => !q.options || q.options.includes(q.answer), {
    message: "answer phải trùng đúng một option",
  });

export const ExamItemSchema = z.object({
  id: z.string().optional().default(() => crypto.randomUUID()),
  kind: z.enum(["TOEIC", "IELTS"]),
  part: z.string(),
  level: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  topic: z.string().optional(),
  passage: z.string().optional(),
  script: z.array(AudioLineSchema).optional(),
  imagePrompt: z.string().optional(),
  questions: z.array(ExamQuestionSchema).min(1),
  createdAt: z.string().optional().default(() => new Date().toISOString()),
  providerUsed: z.string().optional(),
});

export type ExamItemInput = z.infer<typeof ExamItemSchema>;
export type ExamQuestionInput = z.infer<typeof ExamQuestionSchema>;
