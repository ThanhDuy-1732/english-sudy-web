"use client";

import { useState } from "react";
import { type GrammarTopic, type SubRule } from "@/lib/grammar-data";
import GrammarExercise, { type Exercise } from "./GrammarExercise";

export default function GrammarContent({ topic }: { topic: GrammarTopic }) {
  const [aiExamples, setAiExamples] = useState<Record<string, string[]>>({});
  const [exercises, setExercises] = useState<Record<string, Exercise>>({});
  const [loadingExamples, setLoadingExamples] = useState<Set<string>>(new Set());
  const [loadingExercise, setLoadingExercise] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function fetchExamples(rule: SubRule) {
    if (loadingExamples.has(rule.id)) return;
    setLoadingExamples((previous) => new Set(previous).add(rule.id));
    setErrors((previous) => ({ ...previous, [`examples-${rule.id}`]: "" }));
    try {
      const response = await fetch("/api/grammar-examples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.name, subRule: rule.name }),
      });
      if (!response.ok) throw new Error("Failed to generate examples");
      const data = (await response.json()) as { examples?: string[] };
      setAiExamples((previous) => ({ ...previous, [rule.id]: data.examples ?? [] }));
    } catch {
      setErrors((previous) => ({
        ...previous,
        [`examples-${rule.id}`]: "Không thể tạo ví dụ lúc này.",
      }));
    } finally {
      setLoadingExamples((previous) => {
        const next = new Set(previous);
        next.delete(rule.id);
        return next;
      });
    }
  }

  async function fetchExercise(rule: SubRule) {
    if (loadingExercise.has(rule.id)) return;
    setLoadingExercise((previous) => new Set(previous).add(rule.id));
    setErrors((previous) => ({ ...previous, [`exercise-${rule.id}`]: "" }));
    try {
      const response = await fetch("/api/grammar-exercise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.name, subRule: rule.name }),
      });
      if (!response.ok) throw new Error("Failed to generate exercise");
      const data = (await response.json()) as Exercise;
      setExercises((previous) => ({ ...previous, [rule.id]: data }));
    } catch {
      setErrors((previous) => ({
        ...previous,
        [`exercise-${rule.id}`]: "Không thể tạo bài tập lúc này.",
      }));
    } finally {
      setLoadingExercise((previous) => {
        const next = new Set(previous);
        next.delete(rule.id);
        return next;
      });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#d9ecff]">{topic.name}</h1>
        {topic.isUserGenerated && (
          <p className="mt-1 text-sm text-purple-300">Chủ đề do AI tạo</p>
        )}
      </div>

      {topic.rules.map((rule) => (
        <section key={rule.id} className="rounded-lg border border-white/10 bg-white/5 p-5">
          <h2 className="mb-2 text-lg font-semibold text-white">{rule.name}</h2>
          <code className="mb-3 block overflow-x-auto rounded bg-black/30 px-3 py-2 font-mono text-sm text-purple-300">
            {rule.formula}
          </code>
          <p className="mb-4 text-sm leading-6 text-[#b0b0d1]">{rule.explanation}</p>

          <ul className="mb-4 space-y-1.5">
            {rule.examples.map((example) => (
              <li
                key={example}
                className="text-sm text-[#d9ecff] before:mr-2 before:text-purple-400 before:content-['>']"
              >
                {example}
              </li>
            ))}
            {(aiExamples[rule.id] ?? []).map((example) => (
              <li
                key={`ai-${example}`}
                className="text-sm italic text-[#d9ecff]/80 before:mr-2 before:text-purple-300 before:content-['>']"
              >
                {example}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void fetchExamples(rule)}
              disabled={loadingExamples.has(rule.id)}
              className="min-h-9 rounded bg-white/10 px-3 py-1.5 text-xs font-medium text-[#d9ecff] hover:bg-white/20 disabled:opacity-50"
            >
              {loadingExamples.has(rule.id) ? "Đang tạo..." : "+ Thêm ví dụ"}
            </button>
            <button
              type="button"
              onClick={() => void fetchExercise(rule)}
              disabled={loadingExercise.has(rule.id)}
              className="min-h-9 rounded bg-purple-700/50 px-3 py-1.5 text-xs font-medium text-[#d9ecff] hover:bg-purple-700/70 disabled:opacity-50"
            >
              {loadingExercise.has(rule.id) ? "Đang tạo..." : "Luyện tập"}
            </button>
          </div>

          {errors[`examples-${rule.id}`] && (
            <p className="mt-2 text-sm text-red-300">{errors[`examples-${rule.id}`]}</p>
          )}
          {errors[`exercise-${rule.id}`] && (
            <p className="mt-2 text-sm text-red-300">{errors[`exercise-${rule.id}`]}</p>
          )}
          {exercises[rule.id] && <GrammarExercise exercise={exercises[rule.id]} />}
        </section>
      ))}
    </div>
  );
}
