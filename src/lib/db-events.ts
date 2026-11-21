
// Server-only: monitoring events in Neon (table `events`, see db/schema.sql).

export type EventKind = "ai" | "page" | "done";

export interface EventInput {
  kind: EventKind;
  name: string;
  device?: string | null;
  ms?: number | null;
  ok?: boolean | null;
  provider?: string | null;
  fallback?: boolean | null;
  repair?: boolean | null;
}

// Lazy import: the driver needs Node/edge globals and must not load in jsdom tests or client bundles.
async function db() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const { neon } = await import("@neondatabase/serverless");
  return neon(url);
}

/** Inserts one event. No-op without DATABASE_URL; never throws. */
export async function logEvent(e: EventInput): Promise<void> {
  try {
    const sql = await db();
    if (!sql) return;
    await sql`INSERT INTO events (kind, name, device, ms, ok, provider, fallback, repair)
      VALUES (${e.kind}, ${e.name}, ${e.device ?? null}, ${e.ms ?? null}, ${e.ok ?? null},
              ${e.provider ?? null}, ${e.fallback ?? null}, ${e.repair ?? null})`;
  } catch (err) {
    console.warn("logEvent failed", (err as Error).message);
  }
}

/** Logs after the response is sent (Next `after`); falls back to fire-and-forget outside a request. */
export function logEventAfter(e: EventInput): void {
  if (!process.env.DATABASE_URL) return;
  // Lazy import keeps next/server (needs web globals) out of jsdom tests.
  void import("next/server")
    .then(({ after }) => after(() => logEvent(e)))
    .catch(() => logEvent(e));
}

export interface Stats {
  days: number;
  devices: number;
  tasks: { name: string; count: number; p50: number; p95: number; errorPct: number; fallbackPct: number; repairPct: number }[];
  providers: { provider: string; count: number; p50: number; p95: number; errorPct: number }[];
  daily: { day: string; aiCalls: number; aiErrors: number; devices: number; pageViews: number }[];
  pages: { name: string; views: number; devices: number }[];
  done: { name: string; count: number; devices: number }[];
}

const TZ = "Asia/Ho_Chi_Minh";

/** Aggregates the last `days` days. Throws if the DB is not configured. */
export async function getStats(days: number): Promise<Stats> {
  const sql = await db();
  if (!sql) throw new Error("DATABASE_URL not set");
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const [devices, tasks, providers, daily, pages, done] = await Promise.all([
    sql`SELECT count(DISTINCT device)::int AS n FROM events WHERE at >= ${since} AND device IS NOT NULL`,
    sql`SELECT name, count(*)::int AS count,
          round(percentile_cont(0.5) WITHIN GROUP (ORDER BY ms))::int AS p50,
          round(percentile_cont(0.95) WITHIN GROUP (ORDER BY ms))::int AS p95,
          round(100.0 * count(*) FILTER (WHERE NOT ok) / count(*))::int AS "errorPct",
          round(100.0 * count(*) FILTER (WHERE fallback) / count(*))::int AS "fallbackPct",
          round(100.0 * count(*) FILTER (WHERE repair) / count(*))::int AS "repairPct"
        FROM events WHERE kind = 'ai' AND at >= ${since} GROUP BY name ORDER BY count DESC`,
    sql`SELECT provider, count(*)::int AS count,
          round(percentile_cont(0.5) WITHIN GROUP (ORDER BY ms))::int AS p50,
          round(percentile_cont(0.95) WITHIN GROUP (ORDER BY ms))::int AS p95,
          round(100.0 * count(*) FILTER (WHERE NOT ok) / count(*))::int AS "errorPct"
        FROM events WHERE kind = 'ai' AND provider IS NOT NULL AND at >= ${since}
        GROUP BY provider ORDER BY count DESC`,
    sql`SELECT to_char(date_trunc('day', at AT TIME ZONE ${TZ}), 'YYYY-MM-DD') AS day,
          count(*) FILTER (WHERE kind = 'ai')::int AS "aiCalls",
          count(*) FILTER (WHERE kind = 'ai' AND NOT ok)::int AS "aiErrors",
          count(DISTINCT device)::int AS devices,
          count(*) FILTER (WHERE kind = 'page')::int AS "pageViews"
        FROM events WHERE at >= ${since} GROUP BY 1 ORDER BY 1`,
    sql`SELECT name, count(*)::int AS views, count(DISTINCT device)::int AS devices
        FROM events WHERE kind = 'page' AND at >= ${since} GROUP BY name ORDER BY views DESC LIMIT 20`,
    sql`SELECT name, count(*)::int AS count, count(DISTINCT device)::int AS devices
        FROM events WHERE kind = 'done' AND at >= ${since} GROUP BY name ORDER BY count DESC`,
  ]);

  return {
    days,
    devices: (devices[0]?.n as number) ?? 0,
    tasks: tasks as Stats["tasks"],
    providers: providers as Stats["providers"],
    daily: daily as Stats["daily"],
    pages: pages as Stats["pages"],
    done: done as Stats["done"],
  };
}
