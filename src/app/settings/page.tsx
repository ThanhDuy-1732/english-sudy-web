"use client";

import { useEffect, useState } from "react";
import VoiceSettingsTab from "@/components/VoiceSettingsTab";
import { useProvider } from "@/contexts/ProviderContext";
import { getLastSyncedAt, getSyncKey, pullFromKey } from "@/lib/sync";
import { SyncStatusBadge } from "@/components/SyncStatusBadge";
import { clearAllAudio, getAudioCount } from "@/lib/speech/audio-store";

const ALL_PROVIDERS = [
  { id: "gemini", name: "Gemini Flash", model: "gemini-flash-latest", envKey: "GEMINI_API_KEY" },
  { id: "groq", name: "Groq", model: "llama-3.3-70b-versatile", envKey: "GROQ_API_KEY" },
  { id: "openrouter", name: "OpenRouter", model: "nvidia/nemotron-3-nano-30b-a3b:free", envKey: "OPENROUTER_API_KEY" },
  { id: "mistral", name: "Mistral", model: "mistral-small-latest", envKey: "MISTRAL_API_KEY" },
  { id: "cohere", name: "Cohere", model: "command-r7b-12-2024", envKey: "COHERE_API_KEY" },
  { id: "huggingface", name: "HuggingFace", model: "meta-llama/Llama-3.2-1B-Instruct", envKey: "HUGGINGFACE_API_KEY" },
];

type TestResult = "loading" | { ok: boolean; latency?: number; error?: string };
type Tab = "providers" | "voice" | "sync";

const TAB_LABELS: Record<Tab, string> = {
  providers: "AI Providers",
  voice: "Voice",
  sync: "Sync",
};

export default function SettingsPage() {
  const { currentProvider, availableProviders, setProvider, disabledProviders, toggleProvider } =
    useProvider();
  const [activeTab, setActiveTab] = useState<Tab>("providers");
  const [syncKey, setSyncKey] = useState("");
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [pullInput, setPullInput] = useState("");
  const [pulling, setPulling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pullSuccess, setPullSuccess] = useState<string | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [audioCount, setAudioCount] = useState(0);

  useEffect(() => {
    setSyncKey(getSyncKey());
    setLastSynced(getLastSyncedAt());
    getAudioCount().then(setAudioCount);
  }, []);

  const isActive = (id: string) => availableProviders.some((provider) => provider.id === id);
  const isDisabled = (id: string) => disabledProviders.includes(id);

  function handleCopy() {
    navigator.clipboard
      .writeText(syncKey)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }

  async function handlePull() {
    const trimmed = pullInput.trim();
    if (!trimmed) return;
    setPulling(true);
    setPullSuccess(null);
    setPullError(null);
    try {
      const count = await pullFromKey(trimmed);
      setPullSuccess(
        count > 0 ? `${count} từ mới được thêm vào thiết bị này.` : "Đồng bộ xong. Không có từ mới."
      );
      setPullInput("");
    } catch {
      setPullError("Không thể kết nối. Kiểm tra kết nối mạng và thử lại.");
    } finally {
      setPulling(false);
    }
  }

  async function handleTest(id: string) {
    setTestResults((prev) => ({ ...prev, [id]: "loading" }));
    try {
      const res = await fetch("/api/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId: id }),
      });
      const data = (await res.json()) as { ok: boolean; latency: number; error?: string };
      setTestResults((prev) => ({ ...prev, [id]: data }));
    } catch {
      setTestResults((prev) => ({ ...prev, [id]: { ok: false, error: "Network error" } }));
    }
    setTimeout(() => {
      setTestResults((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }, 5000);
  }

  function formatSynced(iso: string | null) {
    if (!iso) return "Chưa đồng bộ";
    const date = new Date(iso);
    return `Đã đồng bộ lúc ${date.getHours().toString().padStart(2, "0")}:${date
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
  }

  function renderTestResult(id: string) {
    const result = testResults[id];
    if (!result) return null;
    if (result === "loading") return <span className="text-xs text-[#b0b0d1]">Testing…</span>;
    if (result.ok) return <span className="text-xs text-green-400">✅ {result.latency}ms</span>;
    return <span className="text-xs text-red-400">❌ {result.error ?? "Error"}</span>;
  }

  return (
    <main className="mx-auto w-full min-w-0 max-w-4xl space-y-8 px-4 py-10">
      <div>
        <h1 className="mb-6 font-display text-3xl font-bold text-[#d9ecff]">Cài đặt</h1>

        <div className="mb-8 flex w-fit gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
          {(["providers", "voice", "sync"] as Tab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-white/15 text-[#d9ecff]"
                  : "text-[#b0b0d1] hover:text-[#d9ecff]"
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "providers" && (
        <div>
          <p className="mb-8 text-sm text-[#b0b0d1]">
            Quản lý AI provider. Provider được kích hoạt khi có API key trong{" "}
            <code className="rounded bg-white/10 px-1">.env.local</code>.
          </p>

          <div className="max-w-full overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-[36rem] w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-left">
                  <th className="px-4 py-3 font-semibold text-[#d9ecff]">Provider</th>
                  <th className="px-4 py-3 font-semibold text-[#d9ecff]">Model</th>
                  <th className="px-4 py-3 font-semibold text-[#d9ecff]">Trạng thái</th>
                  <th className="px-4 py-3 font-semibold text-[#d9ecff]">Bật/Tắt</th>
                  <th className="px-4 py-3 font-semibold text-[#d9ecff]">Test</th>
                  <th className="px-4 py-3 font-semibold text-[#d9ecff]">Ưu tiên</th>
                </tr>
              </thead>
              <tbody>
                {ALL_PROVIDERS.map((provider) => {
                  const active = isActive(provider.id);
                  const disabled = isDisabled(provider.id);
                  const isCurrent = provider.id === currentProvider;
                  const testResult = testResults[provider.id];

                  return (
                    <tr key={provider.id} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-4 font-medium text-white">{provider.name}</td>
                      <td className="px-4 py-4 font-mono text-xs text-[#b0b0d1]">
                        {active
                          ? availableProviders.find((available) => available.id === provider.id)?.model ??
                            provider.model
                          : provider.model}
                      </td>
                      <td className="px-4 py-4">
                        {active ? (
                          <span className="inline-flex items-center gap-1 text-green-400">
                            ✅ Active
                          </span>
                        ) : (
                          <span className="text-xs text-[#b0b0d1]">
                            <code className="rounded bg-white/5 px-1">{provider.envKey}</code>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => active && toggleProvider(provider.id)}
                          disabled={!active}
                          title={active ? (disabled ? "Bật provider này" : "Tắt provider này") : "Chưa cấu hình"}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                            !active
                              ? "cursor-not-allowed bg-white/10 opacity-30"
                              : disabled
                                ? "bg-white/20"
                                : "bg-green-600 hover:bg-green-500"
                          }`}
                        >
                          <span
                            className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                              !disabled ? "translate-x-5" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          {active && !testResult && (
                            <button
                              type="button"
                              onClick={() => void handleTest(provider.id)}
                              className="rounded-lg bg-white/10 px-2 py-1 text-xs font-medium text-[#d9ecff] hover:bg-white/20"
                            >
                              Test
                            </button>
                          )}
                          {renderTestResult(provider.id)}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {active && !disabled ? (
                          isCurrent ? (
                            <span className="text-[#d9ecff]">✓ Đang dùng</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setProvider(provider.id)}
                              className="rounded-lg bg-white/10 px-3 py-1 text-xs font-medium text-[#d9ecff] hover:bg-white/20"
                            >
                              Dùng cái này
                            </button>
                          )
                        ) : (
                          <span className="text-xs text-[#b0b0d1]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "voice" && (
        <div>
          <p className="mb-8 text-sm text-[#b0b0d1]">
            Chọn giọng đọc và điều chỉnh thông số phát âm.
          </p>
          <div className="rounded-xl border border-white/10 p-6">
            <VoiceSettingsTab />
          </div>
          <div className="mt-6 rounded-xl border border-white/10 p-6">
            <p className="mb-2 text-sm font-medium text-[#d9ecff]">Bản ghi âm</p>
            <p className="mb-4 text-xs text-[#b0b0d1]">
              Bản ghi âm được lưu cục bộ (tối đa 20). Không đồng bộ lên server.
            </p>
            <button
              type="button"
              onClick={async () => {
                await clearAllAudio();
                setAudioCount(0);
              }}
              className="text-sm text-red-400 underline hover:text-red-300"
            >
              Xoá bản ghi âm ({audioCount})
            </button>
          </div>
        </div>
      )}

      {activeTab === "sync" && (
        <div>
          <div className="mb-2 flex items-center gap-3">
            <h2 className="font-display text-xl font-bold text-[#d9ecff]">Đồng bộ dữ liệu</h2>
            <SyncStatusBadge />
          </div>
          <p className="mb-6 text-sm text-[#b0b0d1]">
            Dùng sync key để backup và đồng bộ dữ liệu giữa các thiết bị. Không cần đăng nhập.
          </p>

          <div className="space-y-6 rounded-xl border border-white/10 p-6">
            <div>
              <p className="mb-2 text-sm font-medium text-[#d9ecff]">Sync Key của thiết bị này</p>
              <div className="flex items-center gap-3">
                <code className="flex-1 overflow-hidden rounded-lg bg-white/5 px-3 py-2 font-mono text-sm text-[#b0b0d1]">
                  {syncKey ? `${syncKey.slice(0, 8)}••••••••••••••••••••••••••••` : "Đang tải..."}
                </code>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-[#d9ecff] hover:bg-white/20"
                >
                  {copied ? "Đã copy!" : "Copy full key"}
                </button>
              </div>
              <p className="mt-1 text-xs text-[#b0b0d1]">{formatSynced(lastSynced)}</p>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-[#d9ecff]">Lấy dữ liệu từ thiết bị khác</p>
              <p className="mb-3 text-xs text-[#b0b0d1]">
                Nhập sync key của thiết bị khác để thêm từ vựng của thiết bị đó vào đây. Dữ liệu
                hiện tại trên thiết bị này sẽ không bị mất.
              </p>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={pullInput}
                  onChange={(event) => setPullInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void handlePull();
                  }}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx hoặc ThankZ"
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white placeholder-[#b0b0d1] focus:border-white/30 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void handlePull()}
                  disabled={pulling || !pullInput.trim()}
                  className="shrink-0 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-[#d9ecff] hover:bg-white/20 disabled:opacity-50"
                >
                  {pulling ? "Đang lấy..." : "Pull data"}
                </button>
              </div>
              {pullSuccess && (
                <p className="mt-2 text-sm font-medium text-green-400">{pullSuccess}</p>
              )}
              {pullError && <p className="mt-2 text-sm font-medium text-red-400">{pullError}</p>}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
