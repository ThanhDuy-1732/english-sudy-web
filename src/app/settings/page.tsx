"use client";

import Segmented from "@/components/Segmented";

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
  providers: "Mô hình AI",
  voice: "Giọng đọc",
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
    if (result === "loading") return <span className="text-sm text-muted">Đang kiểm tra…</span>;
    if (result.ok) return <span className="text-sm text-ok">Phản hồi sau {result.latency} ms</span>;
    return <span className="break-words text-sm text-margin">{result.error ?? "Không kết nối được"}</span>;
  }

  return (
    <main className="page">
      <div>
        <h1 className="page-title mb-6">Cài đặt</h1>

        <div className="mb-8">
          <Segmented label="Mục cài đặt" value={activeTab} onChange={setActiveTab}
            options={(["providers", "voice", "data", "profile"] as Tab[]).map((tab) => ({ value: tab, label: TAB_LABELS[tab] }))} />
        </div>
      </div>

      {activeTab === "providers" && (
        <div>
          <p className="mb-6 text-sm leading-6 text-muted">
            Mỗi mô hình được bật khi có API key tương ứng trong <code className="rounded bg-ink/[0.06] px-1">.env.local</code>. Mô hình đang dùng được thử trước; nếu lỗi, app chuyển sang mô hình bật tiếp theo.
          </p>

          <ul className="panel divide-y divide-rule">
            {ALL_PROVIDERS.map((provider) => {
              const active = isActive(provider.id);
              const disabled = isDisabled(provider.id);
              const isCurrent = provider.id === currentProvider;
              const testResult = testResults[provider.id];
              const model = active ? availableProviders.find((available) => available.id === provider.id)?.model ?? provider.model : provider.model;

              return (
                <li key={provider.id} className="flex flex-col gap-3 px-4 py-4 sm:px-5">
                  <div className="flex items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                        {provider.name}
                        {isCurrent && active && !disabled && <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">Đang dùng</span>}
                      </p>
                      <p className="mt-0.5 break-all font-mono text-xs text-muted">{model}</p>
                      {!active && <p className="mt-1 text-sm text-muted">Chưa cấu hình: thêm <code className="rounded bg-ink/[0.06] px-1">{provider.envKey}</code></p>}
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={active && !disabled}
                      aria-label={`Bật ${provider.name}`}
                      onClick={() => active && toggleProvider(provider.id)}
                      disabled={!active}
                      className="group -m-2 flex size-11 shrink-0 items-center justify-center disabled:cursor-not-allowed"
                    >
                      <span className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${!active ? "bg-rule opacity-50" : disabled ? "bg-rule" : "bg-primary"}`}>
                        <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${active && !disabled ? "translate-x-[1.125rem]" : "translate-x-0.5"}`} />
                      </span>
                    </button>
                  </div>
                  {active && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      {!testResult && (
                        <button type="button" onClick={() => void handleTest(provider.id)} className="btn btn-secondary min-h-9 px-3 text-sm">
                          Test
                        </button>
                      )}
                      {renderTestResult(provider.id)}
                      {!disabled && !isCurrent && (
                        <button type="button" onClick={() => setProvider(provider.id)} className="text-sm font-medium text-primary hover:underline">
                          Dùng mô hình này trước
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {activeTab === "voice" && (
        <div>
          <p className="mb-8 text-sm text-muted">
            Chọn giọng đọc và điều chỉnh thông số phát âm.
          </p>
          <div className="rounded-xl border border-white/10 p-6">
            <VoiceSettingsTab />
          </div>
          <div className="mt-6 rounded-xl border border-white/10 p-6">
            <p className="mb-2 text-sm font-medium text-ink">Bản ghi âm</p>
            <p className="mb-4 text-xs text-muted">
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
          <h2 className="mb-2 text-lg font-semibold text-ink">Dữ liệu</h2>
          <p className="mb-6 text-sm text-muted">
            Dữ liệu được lưu trong trình duyệt này. Xuất file JSON để backup hoặc chuyển sang thiết
            bị khác; nhập lại file đó trên thiết bị mới.
          </p>

          <div className="space-y-6 rounded-xl border border-white/10 p-6">
            <div>
              <p className="mb-2 text-sm font-medium text-ink">Xuất dữ liệu</p>
              <p className="mb-3 text-xs text-muted">
                Tải toàn bộ từ vựng, lỗi sai, đề thi, bài nói, bài viết và cài đặt thành một file
                JSON.
              </p>
              <button
                type="button"
                onClick={handleExport}
                className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-ink hover:bg-white/20"
              >
                ⬇️ Xuất file sao lưu
              </button>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-ink">Nhập dữ liệu</p>
              <p className="mb-3 text-xs text-muted">
                Chọn file đã xuất trước đó. Các mục trùng sẽ bị ghi đè bằng dữ liệu trong file.
              </p>
              <label className="inline-block cursor-pointer rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-ink hover:bg-white/20">
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
              <p className="mb-2 text-sm font-medium text-ink">Xoá toàn bộ dữ liệu</p>
              <p className="mb-3 text-xs text-muted">
                Chỉ xoá dữ liệu của app trên trình duyệt này. Nên xuất file sao lưu trước.
              </p>
              <button
                type="button"
                onClick={handleClearAll}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  confirmClear
                    ? "bg-red-500/80 text-white hover:bg-red-500"
                    : "bg-white/10 text-ink hover:bg-white/20"
                }`}
              >
                {confirmClear ? "Bấm lần nữa để xoá toàn bộ" : "Xoá dữ liệu"}
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
            <h3 className="mb-3 font-semibold text-ink">Giao diện</h3>
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
        <p className="mb-2 text-sm font-medium text-ink">Mục tiêu học</p>
        <div className="flex flex-wrap gap-2">
          {([["communication","Giao tiếp"],["toeic","TOEIC"],["ielts","IELTS"],
            ["vocabulary","Từ vựng"],["mixed","Tổng hợp"]] as [LearningGoal, string][]).map(([v,l]) => (
            <button key={v} onClick={() => update({ goal: v })}
              className={`px-3 py-2 rounded-lg text-sm ${profile.goal === v ? "bg-primary text-white" : "bg-white/10 text-muted hover:bg-white/20"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-ink">Trình độ hiện tại</p>
        <div className="flex flex-wrap gap-2">
          {([1,2,3,4,5] as const).map((n) => (
            <button key={n} onClick={() => update({ currentLevel: n })}
              className={`px-3 py-2 rounded-lg text-sm ${profile.currentLevel === n ? "bg-primary text-white" : "bg-white/10 text-muted hover:bg-white/20"}`}>
              {["Sơ cấp","Tiền trung","Trung cấp","Trung cao","Nâng cao"][n-1]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-ink">Thời gian học mỗi ngày</p>
        <div className="flex flex-wrap gap-2">
          {[15, 30, 45, 60, 90].map((m) => (
            <button key={m} onClick={() => update({ dailyStudyMinutes: m })}
              className={`px-3 py-2 rounded-lg text-sm ${profile.dailyStudyMinutes === m ? "bg-primary text-white" : "bg-white/10 text-muted hover:bg-white/20"}`}>
              {m} phút
            </button>
          ))}
        </div>
      </div>

      {profile.goal === "toeic" && (
        <div>
          <label className="text-sm font-medium text-ink">Mục tiêu TOEIC</label>
          <input type="number" min={10} max={990} step={5}
            value={profile.targetToeicScore ?? ""}
            onChange={(e) => update({ targetToeicScore: Number(e.target.value) })}
            className="mt-1 w-full max-w-xs rounded-lg bg-white/10 px-3 py-2 text-sm text-ink border border-white/20" />
        </div>
      )}

      {profile.goal === "ielts" && (
        <div>
          <label className="text-sm font-medium text-ink">Mục tiêu IELTS</label>
          <input type="number" min={1} max={9} step={0.5}
            value={profile.targetIeltsScore ?? ""}
            onChange={(e) => update({ targetIeltsScore: Number(e.target.value) })}
            className="mt-1 w-full max-w-xs rounded-lg bg-white/10 px-3 py-2 text-sm text-ink border border-white/20" />
        </div>
      )}

      <div className="flex items-center justify-between max-w-xs">
        <p className="text-sm text-ink">Phím tắt bàn phím</p>
        <button
          onClick={() => update({ shortcutsEnabled: !profile.shortcutsEnabled })}
          className={`relative w-12 h-6 rounded-full transition-colors ${profile.shortcutsEnabled ? "bg-primary" : "bg-white/20"}`}
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
          className={`px-3 py-2 rounded-lg text-sm ${theme === t ? "bg-primary text-white" : "bg-white/10 text-muted hover:bg-white/20"}`}>
          {t === "system" ? "Hệ thống" : t === "light" ? "Sáng" : "Tối"}
        </button>
      ))}
    </div>
  );
}
