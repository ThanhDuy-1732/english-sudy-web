"use client";

import Flashcard from "./Flashcard";

interface FlashcardGridProps {
  words: Array<{ word: string; meaning: string }>;
  topic: string;
  onFlip?: () => void;
}

export default function FlashcardGrid({ words, topic, onFlip }: FlashcardGridProps) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {words.map(({ word, meaning }) => (
        <Flashcard key={word} word={word} meaning={meaning} topic={topic} onFlip={onFlip} />
      ))}
    </div>
  );
}
