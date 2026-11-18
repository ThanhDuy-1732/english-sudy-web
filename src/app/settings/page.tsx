"use client";

import Segmented from "@/components/Segmented";
import { buildReminderIcs } from "@/lib/reminders";

import { useEffect, useState, type ChangeEvent } from "react";
import { getThemePref, setThemePref, type ThemePref } from "@/lib/theme";
import VoiceSettingsTab from "@/components/VoiceSettingsTab";
import { useProvider } from "@/contexts/ProviderContext";
import { getProfile, saveProfile, type LearningProfile, type LearningGoal } from "@/lib/profile";
import { clearAllAudio, getAudioCount } from "@/lib/speech/audio-store";
import { LOCAL_STORAGE_LIMIT, clearAllData, downloadBackup, exportData, importData, mergeData, storageUsage } from "@/lib/data-transfer";

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
      downloadBackup(exportData());
      setDataMessage({ kind: "ok", text: "Đã xuất file sao lưu." });
    } catch {
      setDataMessage({ kind: "error", text: "Không thể xuất dữ liệu." });
    }
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>, mode: "merge" | "replace") {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (mode === "replace" && !window.confirm("Thay thế sẽ ghi đè từ vựng, lỗi sai, bài làm… trên máy này bằng dữ liệu trong file. Tiếp tục?")) {
      return;
    }
    try {
      const text = await file.text();
      const result = mode === "merge" ? mergeData(text) : importData(text);
      setDataMessage({ kind: "ok", text: `${mode === "merge" ? "Đã gộp" : "Đã thay thế"} ${result.imported} mục. Đang tải lại…` });
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
                        <span className={`inline-block size-5 rounded-full bg-card shadow transition-transform ${active && !disabled ? "translate-x-[1.125rem]" : "translate-x-0.5"}`} />
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
          <div className="rounded-xl border border-rule p-6">
            <VoiceSettingsTab />
          </div>
          <div className="mt-6 rounded-xl border border-rule p-6">
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
              className="text-sm text-margin underline hover:text-margin"
            >
              Xoá bản ghi âm ({audioCount})
            </button>
          </div>
        </div>
      )}

      {activeTab === "data" && (
        <div>
          <p className="mb-6 text-sm leading-6 text-muted">
            Dữ liệu học chỉ nằm trong trình duyệt này. Xoá dữ liệu trình duyệt hay đổi máy là mất, nên hãy xuất file sao lưu thường xuyên.
          </p>

          <div className="panel divide-y divide-rule">
            <section className="p-5 sm:p-6">
              <h2 className="section-title">Xuất dữ liệu</h2>
              <p className="mt-1 text-sm text-muted">Tải toàn bộ từ vựng, lỗi sai, đề thi, bài nói, bài viết và cài đặt thành một file JSON.</p>
              <button type="button" onClick={handleExport} className="btn btn-primary mt-4">Xuất file sao lưu</button>
            </section>

            <section className="p-5 sm:p-6">
              <h2 className="section-title">Nhập dữ liệu</h2>
              <p className="mt-1 text-sm text-muted">
                Chọn file đã xuất trước đó. <strong className="font-medium text-ink">Gộp</strong> giữ dữ liệu trên máy này và thêm những gì có trong file; mục nào sửa ở cả hai nơi thì lấy bản mới hơn. <strong className="font-medium text-ink">Thay thế</strong> ghi đè bằng dữ liệu trong file.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <label className="btn btn-primary cursor-pointer">
                  Gộp từ file
                  <input type="file" accept="application/json,.json" onChange={(event) => void handleImportFile(event, "merge")} className="sr-only" />
                </label>
                <label className="btn btn-secondary cursor-pointer">
                  Thay thế bằng file
                  <input type="file" accept="application/json,.json" onChange={(event) => void handleImportFile(event, "replace")} className="sr-only" />
                </label>
              </div>
            </section>

            <StorageUsage />

            <section className="p-5 sm:p-6">
              <h2 className="section-title">Xoá toàn bộ dữ liệu</h2>
              <p className="mt-1 text-sm text-muted">Chỉ xoá dữ liệu của app trên trình duyệt này. Nên xuất file sao lưu trước.</p>
              <button
                type="button"
                onClick={handleClearAll}
                className={`btn mt-4 ${confirmClear ? "bg-margin text-white" : "btn-secondary text-margin"}`}
              >
                {confirmClear ? "Bấm lần nữa để xoá toàn bộ" : "Xoá dữ liệu"}
              </button>
            </section>
          </div>

          {dataMessage && (
            <p role="status" className={`mt-4 text-sm font-medium ${dataMessage.kind === "ok" ? "text-ok" : "text-margin"}`}>
              {dataMessage.text}
            </p>
          )}
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

// Friendly names for the keys that usually take the most space.
const STORAGE_NAMES: Record<string, string> = {
  examBank: "Đề thi đã tạo",
  learnedWords: "Từ vựng",
  writingSubmissions: "Bài viết",
  speakingSessions: "Bài nói",
  unifiedMistakes: "Sổ lỗi",
  learningSessions: "Lịch sử học",
  examAttempts: "Bài thi đã làm",
  grammarAttempts: "Bài ngữ pháp",
  dailyPlan: "Kế hoạch hôm nay",
  studyTime: "Thời gian học",
  masteryTimeline: "Tiến độ kỹ năng",
  skillMasteryCache: "Điểm kỹ năng",
  grammarTopics: "Chủ đề ngữ pháp tự tạo",
  examTagAccuracies: "Độ chính xác theo dạng câu",
  dailyChallenge: "Thử thách hằng ngày",
  reportedQuestions: "Câu hỏi đã báo lỗi",
};

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function StorageUsage() {
  const [usage, setUsage] = useState<ReturnType<typeof storageUsage> | null>(null);
  useEffect(() => setUsage(storageUsage()), []);
  if (!usage) return null;
  const percent = Math.min(100, Math.round((usage.bytes / LOCAL_STORAGE_LIMIT) * 100));
  const high = percent >= 80;
  const top = usage.keys.slice(0, 3);

  return (
    <section className="p-5 sm:p-6">
      <h2 className="section-title">Dung lượng</h2>
      <p className="mt-1 text-sm text-muted">
        Đang dùng <span className="font-semibold tabular-nums text-ink">{formatBytes(usage.bytes)}</span> trên khoảng 5 MB trình duyệt cho phép.
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-rule" role="progressbar" aria-label="Dung lượng đã dùng" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <div className={`h-full rounded-full ${high ? "bg-margin" : "bg-primary"}`} style={{ width: `${Math.max(percent, 1)}%` }} />
      </div>
      {high && (
        <p role="alert" className="mt-3 rounded-lg bg-margin-soft px-3 py-2 text-sm text-ink">
          Sắp đầy ({percent}%). Khi đầy, app không lưu thêm được từ hay bài làm mới. Hãy xuất file sao lưu; đề thi đã tạo chiếm nhiều chỗ nhất và sẽ được tạo lại khi cần.
        </p>
      )}
      {top.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-muted">
          {top.map((k) => (
            <li key={k.key} className="flex justify-between gap-4">
              <span>{STORAGE_NAMES[k.key] ?? "Cài đặt và dữ liệu khác"}</span>
              <span className="tabular-nums">{formatBytes(k.bytes)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function downloadReminder(time: string) {
  const ics = buildReminderIcs(time, `${window.location.origin}/today`);
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "english-study-nhac-hoc.ics";
  link.click();
  URL.revokeObjectURL(url);
}

function ProfileSettings() {
  // getProfile() returns the defaults during server rendering.
  const [profile, setProfile] = useState<LearningProfile>(getProfile);

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
              aria-pressed={profile.goal === v} className={`chip ${profile.goal === v ? "chip-on" : ""}`}>
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
              aria-pressed={profile.currentLevel === n} className={`chip ${profile.currentLevel === n ? "chip-on" : ""}`}>
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
              aria-pressed={profile.dailyStudyMinutes === m} className={`chip ${profile.dailyStudyMinutes === m ? "chip-on" : ""}`}>
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
            className="field mt-1 block w-full max-w-xs text-sm" />
        </div>
      )}

      {profile.goal === "ielts" && (
        <div>
          <label className="text-sm font-medium text-ink">Mục tiêu IELTS</label>
          <input type="number" min={1} max={9} step={0.5}
            value={profile.targetIeltsScore ?? ""}
            onChange={(e) => update({ targetIeltsScore: Number(e.target.value) })}
            className="field mt-1 block w-full max-w-xs text-sm" />
        </div>
      )}

      {(profile.goal === "toeic" || profile.goal === "ielts") && (
        <div>
          <label htmlFor="target-date" className="text-sm font-medium text-ink">Ngày thi</label>
          <input id="target-date" type="date"
            value={profile.targetDate ?? ""}
            onChange={(e) => update({ targetDate: e.target.value || undefined })}
            className="field mt-1 block w-full max-w-xs text-sm" />
        </div>
      )}

      <div>
        <label htmlFor="reminder-time" className="text-sm font-medium text-ink">Nhắc học hằng ngày</label>
        <p className="mt-0.5 text-sm text-muted">Sau giờ này, nếu hôm nay chưa học, app hiện lời nhắc khi bạn mở. Tải file lịch để điện thoại tự nhắc cả khi không mở app.</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <input id="reminder-time" type="time" value={profile.reminderTime}
            onChange={(e) => e.target.value && update({ reminderTime: e.target.value })}
            className="field w-36 text-sm" />
          <button type="button" onClick={() => downloadReminder(profile.reminderTime)} className="btn btn-secondary text-sm">
            Tải file lịch nhắc học (.ics)
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">Mở file vừa tải để thêm vào Lịch (iPhone) hoặc Google Calendar. Đổi giờ thì tải lại file và xoá sự kiện cũ.</p>
      </div>

      <div className="flex items-center justify-between max-w-xs">
        <p className="text-sm text-ink">Phím tắt bàn phím</p>
        <button
          onClick={() => update({ shortcutsEnabled: !profile.shortcutsEnabled })}
          className={`relative w-12 h-6 rounded-full transition-colors ${profile.shortcutsEnabled ? "bg-primary" : "bg-ink/5"}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-card rounded-full shadow transition-transform ${profile.shortcutsEnabled ? "translate-x-6" : ""}`} />
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
          aria-pressed={theme === t} className={`chip ${theme === t ? "chip-on" : ""}`}>
          {t === "system" ? "Hệ thống" : t === "light" ? "Sáng" : "Tối"}
        </button>
      ))}
    </div>
  );
}
