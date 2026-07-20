"use client";

import { createContext, useContext, useEffect, useState } from "react";

export interface ProviderInfo {
  id: string;
  name: string;
  model: string;
}

interface ProviderContextValue {
  currentProvider: string;
  availableProviders: ProviderInfo[];
  setProvider: (id: string) => void;
  disabledProviders: string[];
  toggleProvider: (id: string) => void;
}

const ProviderContext = createContext<ProviderContextValue>({
  currentProvider: "",
  availableProviders: [],
  setProvider: () => {},
  disabledProviders: [],
  toggleProvider: () => {},
});

export function ProviderContextProvider({ children }: { children: React.ReactNode }) {
  const [availableProviders, setAvailableProviders] = useState<ProviderInfo[]>([]);
  const [currentProvider, setCurrentProvider] = useState("");
  const [disabledProviders, setDisabledProviders] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("disabledProviders");
      if (stored) setDisabledProviders(JSON.parse(stored) as string[]);
    } catch {}
  }, []);

  useEffect(() => {
    fetch("/api/providers")
      .then((res) => res.json())
      .then((providers: ProviderInfo[]) => {
        setAvailableProviders(providers);
        const saved = localStorage.getItem("preferredProvider");
        const disabledRaw = localStorage.getItem("disabledProviders");
        const disabled: string[] = disabledRaw ? (JSON.parse(disabledRaw) as string[]) : [];
        const valid = providers.find((p) => p.id === saved && !disabled.includes(p.id));
        const fallback = providers.find((p) => !disabled.includes(p.id));
        setCurrentProvider(valid ? saved! : (fallback?.id ?? providers[0]?.id ?? ""));
      })
      .catch(() => {});
  }, []);

  const setProvider = (id: string) => {
    setCurrentProvider(id);
    localStorage.setItem("preferredProvider", id);
  };

  const toggleProvider = (id: string) => {
    const isDisabling = !disabledProviders.includes(id);
    const next = isDisabling
      ? [...disabledProviders, id]
      : disabledProviders.filter((d) => d !== id);

    setDisabledProviders(next);
    localStorage.setItem("disabledProviders", JSON.stringify(next));

    if (isDisabling && currentProvider === id) {
      const firstAvailable = availableProviders.find((p) => !next.includes(p.id));
      if (firstAvailable) {
        setCurrentProvider(firstAvailable.id);
        localStorage.setItem("preferredProvider", firstAvailable.id);
      }
    }
  };

  return (
    <ProviderContext.Provider
      value={{ currentProvider, availableProviders, setProvider, disabledProviders, toggleProvider }}
    >
      {children}
    </ProviderContext.Provider>
  );
}

export function useProvider() {
  return useContext(ProviderContext);
}
