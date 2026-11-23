"use client";

import { createContext, useContext, useEffect, useState } from "react";

export interface ProviderInfo {
  id: string;
  name: string;
  model: string;
  /** Needs the password (POST /api/providers/unlock) before the server lets requests use it. */
  locked?: boolean;
}

interface ProviderContextValue {
  currentProvider: string;
  availableProviders: ProviderInfo[];
  setProvider: (id: string) => void;
  disabledProviders: string[];
  toggleProvider: (id: string) => void;
  /** This browser holds the unlock cookie for the locked providers. */
  unlocked: boolean;
  /** Sends the password; resolves to an error message, or null when unlocked. */
  unlock: (password: string) => Promise<string | null>;
  lock: () => Promise<void>;
}

// OpenCode Go is the preferred default when configured; anything else keeps the old order.
const DEFAULT_PROVIDER_ID = "opencode";

const ProviderContext = createContext<ProviderContextValue>({
  currentProvider: "",
  availableProviders: [],
  setProvider: () => {},
  disabledProviders: [],
  toggleProvider: () => {},
  unlocked: false,
  unlock: async () => null,
  lock: async () => {},
});

export function ProviderContextProvider({ children }: { children: React.ReactNode }) {
  const [availableProviders, setAvailableProviders] = useState<ProviderInfo[]>([]);
  const [currentProvider, setCurrentProvider] = useState("");
  const [disabledProviders, setDisabledProviders] = useState<string[]>([]);
  const [unlocked, setUnlocked] = useState(false);

  const unlock = async (password: string) => {
    try {
      const res = await fetch("/api/providers/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setUnlocked(true);
        return null;
      }
      return ((await res.json()) as { error?: string }).error ?? "Không mở khoá được.";
    } catch {
      return "Lỗi mạng.";
    }
  };

  const lock = async () => {
    await fetch("/api/providers/unlock", { method: "DELETE" }).catch(() => {});
    setUnlocked(false);
    // The server would fall back anyway; switching now keeps the badge honest.
    if (availableProviders.find((p) => p.id === currentProvider)?.locked) {
      const next = availableProviders.find((p) => !p.locked && !disabledProviders.includes(p.id));
      if (next) setProvider(next.id);
    }
  };

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
        // Only ask about the unlock cookie when some provider is locked at all.
        if (providers.some((p) => p.locked)) {
          fetch("/api/providers/unlock")
            .then((res) => res.json())
            .then((data: { unlocked?: boolean }) => setUnlocked(data.unlocked === true))
            .catch(() => {});
        }
        const saved = localStorage.getItem("preferredProvider");
        const disabledRaw = localStorage.getItem("disabledProviders");
        const disabled: string[] = disabledRaw ? (JSON.parse(disabledRaw) as string[]) : [];
        const valid = providers.find((p) => p.id === saved && !disabled.includes(p.id));
        const preferredDefault = providers.find(
          (p) => p.id === DEFAULT_PROVIDER_ID && !disabled.includes(p.id)
        );
        const fallback = preferredDefault ?? providers.find((p) => !disabled.includes(p.id));
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
      value={{ currentProvider, availableProviders, setProvider, disabledProviders, toggleProvider, unlocked, unlock, lock }}
    >
      {children}
    </ProviderContext.Provider>
  );
}

export function useProvider() {
  return useContext(ProviderContext);
}
