"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { type GrammarTopic, type SubRule } from "@/lib/grammar-data";
import GrammarExercise, { type Exercise } from "./GrammarExercise";
import { isBookmarked, toggleBookmark } from "@/lib/grammar-bookmarks";

export default function GrammarContent({ topic }: { topic: GrammarTopic }) {
  const [aiExamples, setAiExamples] = useState<Record<string, string[]>>({});
  const [exercises, setExercises] = useState<Record<string, Exercise>>({});
  const [loadingExamples, setLoadingExamples] = useState<Set<string>>(new Set());
  const [loadingExercise, setLoadingExercise] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [bookmarks, setBookmarks] = useState<Set<string>>(
    () => new Set(topic.rules.filter((r) => isBookmarked(topic.id, r.id)).map((r) => r.id))
  );

  const handleToggleBookmark = useCallback((ruleId: string) => {
    const now = toggleBookmark(topic.id, ruleId);
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (now) next.add(ruleId); else next.delete(ruleId);
      return next;
    });
  }, [topic.id]);

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
        <h1 className="text-2xl font-bold text-ink">{topic.name}</h1>
        {topic.isUserGenerated && (
          <p className="mt-1 text-sm text-primary-text">Chủ đề do AI tạo</p>
        )}
      </div>

      {topic.rules.map((rule) => (
        <section key={rule.id} className="rounded-xl border border-rule bg-card p-5">
          <h2 className="mb-2 text-lg font-semibold text-ink">{rule.name}</h2>
          <code className="mb-3 block overflow-x-auto rounded-md bg-primary-soft px-3 py-2 font-en text-[15px] text-ink">
            {rule.formula}
          </code>
          <p className="mb-4 text-sm leading-6 text-muted">{rule.explanation}</p>

          <ul className="mb-4 space-y-1.5">
            {rule.examples.map((example) => (
              <li
                key={example}
                className="font-en text-[15px] leading-7 text-ink before:mr-2 before:text-primary before:content-['–']"
              >
                {example}
              </li>
            ))}
            {(aiExamples[rule.id] ?? []).map((example) => (
              <li
                key={`ai-${example}`}
                className="text-sm italic text-ink/80 before:mr-2 before:text-primary-text before:content-['>']"
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
              className="min-h-9 rounded bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink hover:bg-ink/5 disabled:opacity-50"
            >
              {loadingExamples.has(rule.id) ? "Đang tạo..." : "+ Thêm ví dụ"}
            </button>
            <button
              type="button"
              onClick={() => void fetchExercise(rule)}
              disabled={loadingExercise.has(rule.id)}
              className="min-h-9 rounded bg-primary-soft px-3 py-1.5 text-xs font-medium text-primary-text hover:bg-primary-soft/70 disabled:opacity-50"
            >
              {loadingExercise.has(rule.id) ? "Đang tạo..." : "Luyện tập"}
            </button>
            <Link
              href={`/exam/drill/RC5?topic=${encodeURIComponent(rule.name)}&grammarSlug=${encodeURIComponent(rule.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}`}
              className="flex items-center min-h-9 rounded px-3 py-1.5 text-xs font-medium text-primary-text underline hover:text-primary-text"
            >
              Luyện TOEIC Part 5
            </Link>
            <button
              type="button"
              onClick={() => handleToggleBookmark(rule.id)}
              title={bookmarks.has(rule.id) ? "Bỏ lưu" : "Lưu sub-rule"}
              className={`min-h-9 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                bookmarks.has(rule.id)
                  ? "bg-warn-soft text-warn hover:bg-warn-soft/70"
                  : "bg-ink/5 text-muted hover:text-warn hover:bg-ink/5"
              }`}
            >
              {bookmarks.has(rule.id) ? "★ Đã lưu" : "☆ Lưu"}
            </button>
          </div>

          {errors[`examples-${rule.id}`] && (
            <p className="mt-2 text-sm text-margin">{errors[`examples-${rule.id}`]}</p>
          )}
          {errors[`exercise-${rule.id}`] && (
            <p className="mt-2 text-sm text-margin">{errors[`exercise-${rule.id}`]}</p>
          )}
          {exercises[rule.id] && <GrammarExercise exercise={exercises[rule.id]} />}
        </section>
      ))}
    </div>
  );
}
