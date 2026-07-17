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
}

const ProviderContext = createContext<ProviderContextValue>({
  currentProvider: "",
  availableProviders: [],
  setProvider: () => {},
});

export function ProviderContextProvider({ children }: { children: React.ReactNode }) {
  const [availableProviders, setAvailableProviders] = useState<ProviderInfo[]>([]);
  const [currentProvider, setCurrentProvider] = useState("");

  useEffect(() => {
    fetch("/api/providers")
      .then((res) => res.json())
      .then((providers: ProviderInfo[]) => {
        setAvailableProviders(providers);
        const saved = localStorage.getItem("preferredProvider");
        const valid = providers.find((p) => p.id === saved);
        setCurrentProvider(valid ? saved! : (providers[0]?.id ?? ""));
      })
      .catch(() => {});
  }, []);

  const setProvider = (id: string) => {
    setCurrentProvider(id);
    localStorage.setItem("preferredProvider", id);
  };

  return (
    <ProviderContext.Provider value={{ currentProvider, availableProviders, setProvider }}>
      {children}
    </ProviderContext.Provider>
  );
}

export function useProvider() {
  return useContext(ProviderContext);
}
