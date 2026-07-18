"use client";

import { useState, useEffect } from "react";
import { useProvider } from "@/contexts/ProviderContext";
import { getSyncKey, getLastSyncedAt, pullFromKey } from "@/lib/sync";

const ALL_PROVIDERS = [
  { id: "gemini", name: "Gemini Flash", model: "gemini-flash-latest", envKey: "GEMINI_API_KEY" },
  { id: "groq", name: "Groq", model: "llama-3.3-70b-versatile", envKey: "GROQ_API_KEY" },
  { id: "huggingface", name: "HuggingFace", model: "mistralai/Mistral-7B-v0.1", envKey: "HUGGINGFACE_API_KEY" },
];

export default function SettingsPage() {
  const { currentProvider, availableProviders, setProvider } = useProvider();
  const [syncKey, setSyncKey] = useState("");
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [pullInput, setPullInput] = useState("");
  const [pulling, setPulling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pullSuccess, setPullSuccess] = useState<string | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);

  useEffect(() => {
    setSyncKey(getSyncKey());
    setLastSynced(getLastSyncedAt());
  }, []);

  const isActive = (id: string) => availableProviders.some((p) => p.id === id);

  function handleCopy() {
    navigator.clipboard.writeText(syncKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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

  function formatSynced(iso: string | null) {
    if (!iso) return "Chưa đồng bộ";
    const d = new Date(iso);
    return `Đã đồng bộ lúc ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-10">
      <div>
        <h1 className="mb-2 font-display text-3xl font-bold text-[#d9ecff]">Cài đặt</h1>
        <p className="mb-8 text-sm text-[#b0b0d1]">
          Quản lý AI provider. Provider được kích hoạt khi có API key trong{" "}
          <code className="rounded bg-white/10 px-1">.env.local</code>.
        </p>

        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-left">
                <th className="px-4 py-3 font-semibold text-[#d9ecff]">Provider</th>
                <th className="px-4 py-3 font-semibold text-[#d9ecff]">Model</th>
                <th className="px-4 py-3 font-semibold text-[#d9ecff]">Trạng thái</th>
                <th className="px-4 py-3 font-semibold text-[#d9ecff]">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {ALL_PROVIDERS.map((p) => {
                const active = isActive(p.id);
                const isCurrent = p.id === currentProvider;
                return (
                  <tr key={p.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-4 font-medium text-white">{p.name}</td>
                    <td className="px-4 py-4 font-mono text-xs text-[#b0b0d1]">
                      {active ? (availableProviders.find((ap) => ap.id === p.id)?.model ?? p.model) : p.model}
                    </td>
                    <td className="px-4 py-4">
                      {active ? (
                        <span className="inline-flex items-center gap-1 text-green-400">✅ Active</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-yellow-400">⚠️ Chưa cấu hình</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {active ? (
                        isCurrent ? (
                          <span className="text-[#d9ecff]">✓ Đang dùng</span>
                        ) : (
                          <button
                            onClick={() => setProvider(p.id)}
                            className="rounded-lg bg-white/10 px-3 py-1 text-xs font-medium text-[#d9ecff] hover:bg-white/20"
                          >
                            Dùng cái này
                          </button>
                        )
                      ) : (
                        <span className="text-xs text-[#b0b0d1]">
                          Thêm <code className="rounded bg-white/5 px-1">{p.envKey}</code> vào .env.local
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sync section */}
      <div>
        <h2 className="mb-2 font-display text-xl font-bold text-[#d9ecff]">Đồng bộ dữ liệu</h2>
        <p className="mb-6 text-sm text-[#b0b0d1]">
          Dùng sync key để backup và đồng bộ dữ liệu giữa các thiết bị. Không cần đăng nhập.
        </p>

        <div className="space-y-6 rounded-xl border border-white/10 p-6">
          {/* Home key display */}
          <div>
            <p className="mb-2 text-sm font-medium text-[#d9ecff]">Sync Key của thiết bị này</p>
            <div className="flex items-center gap-3">
              <code className="flex-1 rounded-lg bg-white/5 px-3 py-2 font-mono text-sm text-[#b0b0d1] overflow-hidden text-ellipsis">
                {syncKey ? `${syncKey.slice(0, 8)}••••••••••••••••••••••••••••` : "Đang tải..."}
              </code>
              <button
                onClick={handleCopy}
                className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-[#d9ecff] hover:bg-white/20"
              >
                {copied ? "Đã copy!" : "Copy full key"}
              </button>
            </div>
            <p className="mt-1 text-xs text-[#b0b0d1]">{formatSynced(lastSynced)}</p>
          </div>

          {/* Pull from another device */}
          <div>
            <p className="mb-2 text-sm font-medium text-[#d9ecff]">Lấy dữ liệu từ thiết bị khác</p>
            <p className="mb-3 text-xs text-[#b0b0d1]">
              Nhập sync key của thiết bị khác để thêm từ vựng của thiết bị đó vào đây.
              Dữ liệu hiện tại trên thiết bị này sẽ không bị mất.
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={pullInput}
                onChange={(e) => setPullInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handlePull(); }}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx hoặc ThankZ"
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white placeholder-[#b0b0d1] focus:border-white/30 focus:outline-none"
              />
              <button
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
            {pullError && (
              <p className="mt-2 text-sm font-medium text-red-400">{pullError}</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
