"use client";

import { useCallback, useEffect, useState } from "react";
import type { Stats } from "@/lib/db-events";

const SECRET_KEY = "adminSecret";
const RANGES = [1, 7, 30];

const TASK_LABEL: Record<string, string> = {
  vocabulary: "Từ vựng", review: "Ôn tập", grammar: "Ngữ pháp", exam: "Đề thi", speaking: "Nói", writing: "Viết",
};

function ms(v: number | null) {
  if (v == null) return "—";
  return v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${v} ms`;
}

function Bar({ value, max, warn }: { value: number; max: number; warn?: boolean }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-rule/60">
      <div className={`h-full rounded-full ${warn ? "bg-warn" : "bg-ink/70"}`} style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%` }} />
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-rule bg-card p-4 sm:p-5">
      <h2 className="mb-3 font-display text-lg font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

const Empty = () => <p className="text-sm text-muted">Chưa có dữ liệu.</p>;

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [input, setInput] = useState("");
  const [days, setDays] = useState(7);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try { setSecret(sessionStorage.getItem(SECRET_KEY) ?? ""); } catch { /* ignore */ }
  }, []);

  const load = useCallback(async () => {
    if (!secret) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/stats?days=${days}`, { headers: { "x-admin-secret": secret }, cache: "no-store" });
      if (res.status === 401) {
        try { sessionStorage.removeItem(SECRET_KEY); } catch { /* ignore */ }
        setSecret("");
        setError("Sai mật khẩu admin.");
        return;
      }
      if (!res.ok) {
        setError(res.status === 503 ? "Server chưa cấu hình ADMIN_SECRET." : `Lỗi ${res.status}: ${(await res.text()).slice(0, 200)}`);
        return;
      }
      setStats(await res.json());
    } catch {
      setError("Không kết nối được server.");
    } finally {
      setLoading(false);
    }
  }, [secret, days]);

  useEffect(() => { void load(); }, [load]);

  if (!secret) {
    return (
      <main className="mx-auto max-w-sm px-4 py-16">
        <h1 className="mb-4 font-display text-2xl font-extrabold text-ink">Admin</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try { sessionStorage.setItem(SECRET_KEY, input); } catch { /* ignore */ }
            setSecret(input);
          }}
          className="space-y-3"
        >
          <label className="block text-sm text-muted" htmlFor="admin-secret">Mật khẩu admin (ADMIN_SECRET)</label>
          <input id="admin-secret" type="password" autoComplete="current-password" value={input} onChange={(e) => setInput(e.target.value)}
            className="w-full rounded-xl border border-rule bg-card px-3 py-2 text-ink" />
          <button type="submit" disabled={!input} className="w-full rounded-xl bg-ink px-3 py-2 font-semibold text-paper disabled:opacity-50">Vào</button>
          {error && <p role="alert" className="text-sm text-warn">{error}</p>}
        </form>
      </main>
    );
  }

  const totalAi = stats?.tasks.reduce((s, t) => s + t.count, 0) ?? 0;
  const aiErrors = stats?.daily.reduce((s, d) => s + d.aiErrors, 0) ?? 0;
  const pageViews = stats?.daily.reduce((s, d) => s + d.pageViews, 0) ?? 0;
  const maxP95 = Math.max(0, ...(stats?.tasks.map((t) => t.p95 ?? 0) ?? []));
  const maxDaily = Math.max(0, ...(stats?.daily.map((d) => d.devices) ?? []));
  const maxPage = stats?.pages[0]?.views ?? 0;

  return (
    <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold text-ink">Giám sát ứng dụng</h1>
        <div className="flex items-center gap-2">
          {RANGES.map((d) => (
            <button key={d} onClick={() => setDays(d)} aria-pressed={days === d}
              className={`rounded-full border px-3 py-1 text-sm ${days === d ? "border-ink bg-ink text-paper" : "border-rule text-ink"}`}>
              {d === 1 ? "24 giờ" : `${d} ngày`}
            </button>
          ))}
          <button onClick={() => void load()} disabled={loading} className="rounded-full border border-rule px-3 py-1 text-sm text-ink disabled:opacity-50">
            {loading ? "Đang tải…" : "Làm mới"}
          </button>
        </div>
      </header>

      {error && <p role="alert" className="rounded-xl border border-warn p-3 text-sm text-warn">{error}</p>}

      {stats && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Người dùng (thiết bị)", stats.devices],
              ["Lượt xem trang", pageViews],
              ["Lời gọi AI", totalAi],
              ["Lỗi AI", totalAi ? `${aiErrors} (${Math.round((aiErrors / totalAi) * 100)}%)` : 0],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-3xl border border-rule bg-card p-4">
                <p className="text-sm text-muted">{label}</p>
                <p className="mt-1 font-display text-3xl font-extrabold tabular-nums text-ink">{value}</p>
              </div>
            ))}
          </div>

          <Card title="Thời gian phản hồi AI theo tính năng">
            {stats.tasks.length === 0 ? <Empty /> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-sm tabular-nums">
                  <thead className="text-left text-muted">
                    <tr><th className="py-1 pr-3 font-normal">Task</th><th className="font-normal">Lượt</th><th className="font-normal">p50</th><th className="font-normal">p95</th><th className="w-40 font-normal" /><th className="font-normal">Lỗi</th><th className="font-normal">Fallback</th><th className="font-normal">Sửa JSON</th></tr>
                  </thead>
                  <tbody>
                    {stats.tasks.map((t) => (
                      <tr key={t.name} className="border-t border-rule/60">
                        <td className="py-1.5 pr-3 font-medium text-ink">{t.name}</td>
                        <td>{t.count}</td><td>{ms(t.p50)}</td><td>{ms(t.p95)}</td>
                        <td className="pr-3"><Bar value={t.p95 ?? 0} max={maxP95} warn={(t.p95 ?? 0) > 8000} /></td>
                        <td className={t.errorPct > 5 ? "font-semibold text-warn" : ""}>{t.errorPct}%</td>
                        <td>{t.fallbackPct}%</td><td>{t.repairPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card title="Theo nhà cung cấp AI">
              {stats.providers.length === 0 ? <Empty /> : (
                <table className="w-full text-sm tabular-nums">
                  <thead className="text-left text-muted"><tr><th className="py-1 font-normal">Provider</th><th className="font-normal">Lượt</th><th className="font-normal">p50</th><th className="font-normal">p95</th><th className="font-normal">Lỗi</th></tr></thead>
                  <tbody>
                    {stats.providers.map((p) => (
                      <tr key={p.provider} className="border-t border-rule/60">
                        <td className="py-1.5 font-medium text-ink">{p.provider}</td><td>{p.count}</td><td>{ms(p.p50)}</td><td>{ms(p.p95)}</td>
                        <td className={p.errorPct > 5 ? "font-semibold text-warn" : ""}>{p.errorPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            <Card title="Theo ngày">
              {stats.daily.length === 0 ? <Empty /> : (
                <table className="w-full text-sm tabular-nums">
                  <thead className="text-left text-muted"><tr><th className="py-1 font-normal">Ngày</th><th className="font-normal">Thiết bị</th><th className="w-24 font-normal" /><th className="font-normal">Trang</th><th className="font-normal">AI</th><th className="font-normal">Lỗi</th></tr></thead>
                  <tbody>
                    {stats.daily.map((d) => (
                      <tr key={d.day} className="border-t border-rule/60">
                        <td className="py-1.5 text-ink">{d.day.slice(5)}</td><td>{d.devices}</td>
                        <td className="pr-3"><Bar value={d.devices} max={maxDaily} /></td>
                        <td>{d.pageViews}</td><td>{d.aiCalls}</td>
                        <td className={d.aiErrors ? "text-warn" : ""}>{d.aiErrors}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            <Card title="Trang được mở nhiều nhất">
              {stats.pages.length === 0 ? <Empty /> : (
                <ul className="space-y-2 text-sm">
                  {stats.pages.map((p) => (
                    <li key={p.name}>
                      <div className="flex justify-between gap-2"><span className="truncate text-ink">{p.name}</span><span className="shrink-0 tabular-nums text-muted">{p.views} lượt · {p.devices} máy</span></div>
                      <Bar value={p.views} max={maxPage} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Bài học đã hoàn thành">
              {stats.done.length === 0 ? <Empty /> : (
                <table className="w-full text-sm tabular-nums">
                  <thead className="text-left text-muted"><tr><th className="py-1 font-normal">Hoạt động</th><th className="font-normal">Lượt</th><th className="font-normal">Thiết bị</th></tr></thead>
                  <tbody>
                    {stats.done.map((d) => (
                      <tr key={d.name} className="border-t border-rule/60">
                        <td className="py-1.5 text-ink">{TASK_LABEL[d.name] ?? d.name}</td><td>{d.count}</td><td>{d.devices}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        </>
      )}
    </main>
  );
}
