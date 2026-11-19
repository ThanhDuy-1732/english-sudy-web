"use client";

import { useCallback, useEffect, useState } from "react";
import { LEARNING_LANGUAGES_EVENT, LEARNING_LANGUAGES_KEY, getLearningLanguages, setLearningLanguages, type LearnLang } from "./languages";

/** The learner's languages, kept in sync across components and tabs. Starts as English until mounted. */
export function useLearningLanguages(): [LearnLang[], (langs: LearnLang[]) => void] {
  const [langs, setLangs] = useState<LearnLang[]>(["en"]);

  useEffect(() => {
    const sync = () => setLangs(getLearningLanguages());
    const onStorage = (event: StorageEvent) => { if (event.key === LEARNING_LANGUAGES_KEY) sync(); };
    sync();
    window.addEventListener(LEARNING_LANGUAGES_EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(LEARNING_LANGUAGES_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const update = useCallback((next: LearnLang[]) => { setLearningLanguages(next); }, []);
  return [langs, update];
}
