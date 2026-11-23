// Server-only: caps wrong passwords on /api/providers/unlock, counted in Neon (`unlock_attempts`, db/schema.sql)
// because serverless instances share no memory.
import { db } from "./db-events";

export const WINDOW_MIN = 15;
export const MAX_PER_IP = 5;
// No global cap: anyone could then lock the owner out by failing on purpose. A guesser with many addresses gets
// MAX_PER_IP tries per address per window, so OPENCODE_LOCK_PASSWORD must be long and random.

/**
 * The address to count against. Vercel sets x-real-ip / x-forwarded-for itself, so the client cannot spoof it.
 * IPv6 is cut to its /64: one host can switch addresses inside that prefix for free.
 */
export function clientKey(req: Request): string {
  const ip = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return ip.includes(":") && !ip.includes(".") ? "ip6:" + ip.split(":").slice(0, 4).join(":") : "ip:" + ip;
}

/**
 * Counts this attempt and returns the seconds to wait when it is over the cap, else 0. The count goes up in one
 * atomic statement before the password is checked, so parallel guesses cannot all read the same old value.
 * No DATABASE_URL (local dev) → no limit; a database error → blocked (fail closed), since the password guards paid usage.
 */
export async function countAttempt(key: string): Promise<number> {
  const sql = await db();
  if (!sql) return 0;
  try {
    const [row] = (await sql`INSERT INTO unlock_attempts (key, fails, since) VALUES (${key}, 1, now())
      ON CONFLICT (key) DO UPDATE SET
        fails = CASE WHEN unlock_attempts.since <= now() - make_interval(mins => ${WINDOW_MIN}) THEN 1 ELSE unlock_attempts.fails + 1 END,
        since = CASE WHEN unlock_attempts.since <= now() - make_interval(mins => ${WINDOW_MIN}) THEN now() ELSE unlock_attempts.since END
      RETURNING fails, since`) as { fails: number; since: string }[];
    if (row.fails <= MAX_PER_IP) return 0;
    const ends = new Date(row.since).getTime() + WINDOW_MIN * 60_000;
    return Math.max(1, Math.ceil((ends - Date.now()) / 1000));
  } catch (err) {
    console.error("unlock limit failed", err);
    return WINDOW_MIN * 60;
  }
}

/** A right password clears the count, so the owner's own attempts never pile up. */
export async function clearAttempts(key: string): Promise<void> {
  const sql = await db();
  if (!sql) return;
  await sql`DELETE FROM unlock_attempts WHERE key = ${key}`;
}
