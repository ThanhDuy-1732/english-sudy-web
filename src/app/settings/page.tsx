"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { getThemePref, setThemePref, type ThemePref } from "@/lib/theme";
import VoiceSettingsTab from "@/components/VoiceSettingsTab";
import { useProvider } from "@/contexts/ProviderContext";
import { getProfile, saveProfile, type LearningProfile, type LearningGoal } from "@/lib/profile";
import { clearAllAudio, getAudioCount } from "@/lib/speech/audio-store";
import { backupFileName, clearAllData, exportData, importData } from "@/lib/data-transfer";

const ALL_PROVIDERS = [
  { id: "gemini", name: "Gemini Flash", model: "gemini-flash-latest", envKey: "GEMINI_API_KEY" },
  { id: "groq", name: "Groq", model: "openai/gpt-oss-120b", envKey: "GROQ_API_KEY" },
  { id: "openrouter", name: "OpenRouter", model: "nvidia/nemotron-3-nano-30b-a3b:free", envKey: "OPENROUTER_API_KEY" },
  { id: "mistral", name: "Mistral", model: "mistral-small-latest", envKey: "MISTRAL_API_KEY" },
  { id: "cohere", name: "Cohere", model: "command-r7b-12-2024", envKey: "COHERE_API_KEY" },
  { id: "opencode", name: "OpenCode Go", model: "deepseek-v4.1-flash", envKey: "OPENCODE_API_KEY" },
];

type TestResult = "loading" | { ok: boolean; latency?: number; error?: string };
type Tab = "providers" | "voice" | "data" | "profile";

const TAB_LABELS: Record<Tab, string> = {
  providers: "AI Providers",
  voice: "Voice",
  data: "Dữ liệu",
  profile: "Hồ sơ",
};

export default function SettingsPage() {
  const { currentProvider, availableProviders, setProvider, disabledProviders, toggleProvider } =
    useProvider();
  const [activeTab, setActiveTab] = useState<Tab>("providers");
  const [dataMessage, setDataMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [audioCount, setAudioCount] = useState(0);

  useEffect(() => {
    getAudioCount().then(setAudioCount);
  }, []);

  const isActive = (id: string) => availableProviders.some((provider) => provider.id === id);
  const isDisabled = (id: string) => disabledProviders.includes(id);

  function handleExport() {
    try {
      const blob = new Blob([exportData()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = backupFileName();
      link.click();
      URL.revokeObjectURL(url);
      setDataMessage({ kind: "ok", text: "Đã xuất file sao lưu." });
    } catch {
      setDataMessage({ kind: "error", text: "Không thể xuất dữ liệu." });
    }
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!window.confirm("Nhập dữ liệu sẽ ghi đè các mục trùng trong trình duyệt này. Tiếp tục?")) {
      return;
    }
    try {
      const result = importData(await file.text());
      setDataMessage({ kind: "ok", text: `Đã nhập ${result.imported} mục. Đang tải lại…` });
      setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      setDataMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "File không hợp lệ.",
      });
    }
  }

  function handleClearAll() {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    const removed = clearAllData();
    setConfirmClear(false);
    setDataMessage({ kind: "ok", text: `Đã xoá ${removed} mục. Đang tải lại…` });
    setTimeout(() => window.location.reload(), 800);
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

        <div className="mb-8 flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
          {(["providers", "voice", "data", "profile"] as Tab[]).map((tab) => (
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

      {activeTab === "data" && (
        <div>
          <h2 className="mb-2 font-display text-xl font-bold text-[#d9ecff]">Dữ liệu</h2>
          <p className="mb-6 text-sm text-[#b0b0d1]">
            Dữ liệu được lưu trong trình duyệt này. Xuất file JSON để backup hoặc chuyển sang thiết
            bị khác; nhập lại file đó trên thiết bị mới.
          </p>

          <div className="space-y-6 rounded-xl border border-white/10 p-6">
            <div>
              <p className="mb-2 text-sm font-medium text-[#d9ecff]">Xuất dữ liệu</p>
              <p className="mb-3 text-xs text-[#b0b0d1]">
                Tải toàn bộ từ vựng, lỗi sai, đề thi, bài nói, bài viết và cài đặt thành một file
                JSON.
              </p>
              <button
                type="button"
                onClick={handleExport}
                className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-[#d9ecff] hover:bg-white/20"
              >
                ⬇️ Xuất file sao lưu
              </button>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-[#d9ecff]">Nhập dữ liệu</p>
              <p className="mb-3 text-xs text-[#b0b0d1]">
                Chọn file đã xuất trước đó. Các mục trùng sẽ bị ghi đè bằng dữ liệu trong file.
              </p>
              <label className="inline-block cursor-pointer rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-[#d9ecff] hover:bg-white/20">
                ⬆️ Chọn file JSON
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </label>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-[#d9ecff]">Xoá toàn bộ dữ liệu</p>
              <p className="mb-3 text-xs text-[#b0b0d1]">
                Chỉ xoá dữ liệu của app trên trình duyệt này. Nên xuất file sao lưu trước.
              </p>
              <button
                type="button"
                onClick={handleClearAll}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  confirmClear
                    ? "bg-red-500/80 text-white hover:bg-red-500"
                    : "bg-white/10 text-[#d9ecff] hover:bg-white/20"
                }`}
              >
                {confirmClear ? "Bấm lần nữa để xoá toàn bộ" : "🗑 Xoá toàn bộ dữ liệu"}
              </button>
            </div>

            {dataMessage && (
              <p
                className={`text-sm font-medium ${
                  dataMessage.kind === "ok" ? "text-green-400" : "text-red-400"
                }`}
              >
                {dataMessage.text}
              </p>
            )}
          </div>
        </div>
      )}

      {activeTab === "profile" && (
        <div className="space-y-8">
          <ProfileSettings />
          <div>
            <h3 className="mb-3 font-semibold text-[#d9ecff]">Giao diện</h3>
            <ThemeToggle />
          </div>
        </div>
      )}
    </main>
  );
}

function ProfileSettings() {
  const [profile, setProfile] = useState<LearningProfile>(() => {
    if (typeof window === "undefined") return {
      goal: "mixed", currentLevel: 2, dailyStudyMinutes: 30, shortcutsEnabled: true,
    };
    return getProfile();
  });

  function update(partial: Partial<LearningProfile>) {
    const updated = { ...profile, ...partial };
    setProfile(updated);
    saveProfile(updated);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium text-[#d9ecff]">Mục tiêu học</p>
        <div className="flex flex-wrap gap-2">
          {([["communication","Giao tiếp"],["toeic","TOEIC"],["ielts","IELTS"],
            ["vocabulary","Từ vựng"],["mixed","Tổng hợp"]] as [LearningGoal, string][]).map(([v,l]) => (
            <button key={v} onClick={() => update({ goal: v })}
              className={`px-3 py-2 rounded-lg text-sm ${profile.goal === v ? "bg-[#7f56d9] text-white" : "bg-white/10 text-[#b0b0d1] hover:bg-white/20"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-[#d9ecff]">Trình độ hiện tại</p>
        <div className="flex flex-wrap gap-2">
          {([1,2,3,4,5] as const).map((n) => (
            <button key={n} onClick={() => update({ currentLevel: n })}
              className={`px-3 py-2 rounded-lg text-sm ${profile.currentLevel === n ? "bg-[#7f56d9] text-white" : "bg-white/10 text-[#b0b0d1] hover:bg-white/20"}`}>
              {["Sơ cấp","Tiền trung","Trung cấp","Trung cao","Nâng cao"][n-1]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-[#d9ecff]">Thời gian học mỗi ngày</p>
        <div className="flex flex-wrap gap-2">
          {[15, 30, 45, 60, 90].map((m) => (
            <button key={m} onClick={() => update({ dailyStudyMinutes: m })}
              className={`px-3 py-2 rounded-lg text-sm ${profile.dailyStudyMinutes === m ? "bg-[#7f56d9] text-white" : "bg-white/10 text-[#b0b0d1] hover:bg-white/20"}`}>
              {m} phút
            </button>
          ))}
        </div>
      </div>

      {profile.goal === "toeic" && (
        <div>
          <label className="text-sm font-medium text-[#d9ecff]">Mục tiêu TOEIC</label>
          <input type="number" min={10} max={990} step={5}
            value={profile.targetToeicScore ?? ""}
            onChange={(e) => update({ targetToeicScore: Number(e.target.value) })}
            className="mt-1 w-full max-w-xs rounded-lg bg-white/10 px-3 py-2 text-sm text-[#d9ecff] border border-white/20" />
        </div>
      )}

      {profile.goal === "ielts" && (
        <div>
          <label className="text-sm font-medium text-[#d9ecff]">Mục tiêu IELTS</label>
          <input type="number" min={1} max={9} step={0.5}
            value={profile.targetIeltsScore ?? ""}
            onChange={(e) => update({ targetIeltsScore: Number(e.target.value) })}
            className="mt-1 w-full max-w-xs rounded-lg bg-white/10 px-3 py-2 text-sm text-[#d9ecff] border border-white/20" />
        </div>
      )}

      <div className="flex items-center justify-between max-w-xs">
        <p className="text-sm text-[#d9ecff]">Phím tắt bàn phím</p>
        <button
          onClick={() => update({ shortcutsEnabled: !profile.shortcutsEnabled })}
          className={`relative w-12 h-6 rounded-full transition-colors ${profile.shortcutsEnabled ? "bg-[#7f56d9]" : "bg-white/20"}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${profile.shortcutsEnabled ? "translate-x-6" : ""}`} />
        </button>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<ThemePref>(() => (typeof window === "undefined" ? "system" : getThemePref()));

  function applyTheme(t: ThemePref) {
    setTheme(t);
    setThemePref(t);
  }

  return (
    <div className="flex gap-2">
      {(["system", "light", "dark"] as const).map((t) => (
        <button key={t} onClick={() => applyTheme(t)}
          className={`px-3 py-2 rounded-lg text-sm ${theme === t ? "bg-[#7f56d9] text-white" : "bg-white/10 text-[#b0b0d1] hover:bg-white/20"}`}>
          {t === "system" ? "Hệ thống" : t === "light" ? "Sáng" : "Tối"}
        </button>
      ))}
    </div>
  );
}
