"use client";

import { useEffect, useState } from "react";
import { addMistakeWord, wordsForMistake } from "@/lib/mistake-words";
import type { UnifiedMistake } from "@/lib/mistakes";

/** "Thêm vào ôn tập" buttons for the words in a mistake; a word turns into a confirmation once saved. */
export default function MistakeWords({ mistake }: { mistake: UnifiedMistake }) {
  const [words, setWords] = useState<string[]>([]);
  const [added, setAdded] = useState<string[]>([]);
  useEffect(() => setWords(wordsForMistake(mistake)), [mistake]);

  if (words.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted">Thêm vào ôn tập:</span>
      {words.map((word) =>
        added.includes(word) ? (
          <span key={word} className="rounded-md bg-ok-soft px-2 py-1 text-ink">
            <span className="font-en">{word}</span> đã thêm
          </span>
        ) : (
          <button
            key={word}
            type="button"
            onClick={() => {
              addMistakeWord(word, mistake);
              setAdded((current) => [...current, word]);
            }}
            className="min-h-9 rounded-md border border-rule bg-card px-2.5 font-en text-ink transition-colors hover:border-primary hover:text-primary"
          >
            + {word}
          </button>
        ),
      )}
    </div>
  );
}
