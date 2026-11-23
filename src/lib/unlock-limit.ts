// Server-only: caps wrong passwords on /api/providers/unlock, counted in Neon (`unlock_attempts`, db/schema.sql)
// because serverless instances share no memory.
import { db } from "./db-events";

export const WINDOW_MIN = 15;
export const MAX_PER_IP = 5;
// Caps a spread-out guesser too. ponytail: it can also lock the owner out for one window; browsers that already
// hold the 30-day cookie are not affected.
export const MAX_GLOBAL = 50;

/** Vercel sets x-real-ip / x-forwarded-for itself, so the client cannot spoof the first hop. */
export function clientIp(req: Request): string {
  return req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/**
 * Seconds to wait before trying again, or 0. No DATABASE_URL (local dev) → no limit;
 * a database error → blocked (fail closed), since the password guards paid usage.
 */
export async function retryAfter(ip: string): Promise<number> {
  const sql = await db();
  if (!sql) return 0;
  try {
    const rows = (await sql`SELECT key, fails, since FROM unlock_attempts
      WHERE key IN (${"ip:" + ip}, 'global') AND since > now() - make_interval(mins => ${WINDOW_MIN})`) as {
      key: string;
      fails: number;
      since: string;
    }[];
    const over = rows.filter((row) => row.fails >= (row.key === "global" ? MAX_GLOBAL : MAX_PER_IP));
    if (!over.length) return 0;
    const ends = Math.max(...over.map((row) => new Date(row.since).getTime() + WINDOW_MIN * 60_000));
    return Math.max(1, Math.ceil((ends - Date.now()) / 1000));
  } catch (err) {
    console.error("unlock limit check failed", err);
    return WINDOW_MIN * 60;
  }
}

/** Counts one wrong password for this IP and globally; a window that has ended starts again at 1. */
export async function recordFailure(ip: string): Promise<void> {
  const sql = await db();
  if (!sql) return;
  for (const key of ["ip:" + ip, "global"]) {
    await sql`INSERT INTO unlock_attempts (key, fails, since) VALUES (${key}, 1, now())
      ON CONFLICT (key) DO UPDATE SET
        fails = CASE WHEN unlock_attempts.since <= now() - make_interval(mins => ${WINDOW_MIN}) THEN 1 ELSE unlock_attempts.fails + 1 END,
        since = CASE WHEN unlock_attempts.since <= now() - make_interval(mins => ${WINDOW_MIN}) THEN now() ELSE unlock_attempts.since END`;
  }
}

/** A right password clears this IP's count (the global one keeps counting other guessers). */
export async function clearFailures(ip: string): Promise<void> {
  const sql = await db();
  if (!sql) return;
  await sql`DELETE FROM unlock_attempts WHERE key = ${"ip:" + ip}`;
}
