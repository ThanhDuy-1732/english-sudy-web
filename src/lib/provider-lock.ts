// Server-only: providers that need OPENCODE_LOCK_PASSWORD. The browser proves it knows the password with an
// httpOnly cookie holding an HMAC of it, so every route (also those that call fetch without useApiFetch) is covered.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const LOCKED_PROVIDER_IDS = ["opencode-gpt6", "opencode-haiku"];
export const UNLOCK_COOKIE = "provider_unlock";
export const UNLOCK_MAX_AGE_S = 30 * 24 * 3600;

const password = () => process.env.OPENCODE_LOCK_PASSWORD || "";
const same = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);

/** Cookie value; changes when the password changes, which locks every browser again. */
export function unlockToken(): string {
  return createHmac("sha256", password()).update("provider-unlock-v1").digest("hex");
}

export function checkPassword(input: unknown): boolean {
  if (!password() || typeof input !== "string") return false;
  const sha = (s: string) => createHash("sha256").update(s).digest();
  return same(sha(input), sha(password()));
}

export function isUnlockToken(value: string | undefined): boolean {
  return !!password() && !!value && same(Buffer.from(value), Buffer.from(unlockToken()));
}

/** Locked provider ids this request may not use: none when no password is set (they are not registered then). */
export async function blockedProviderIds(): Promise<string[]> {
  if (!password()) return [];
  try {
    const { cookies } = await import("next/headers");
    if (isUnlockToken((await cookies()).get(UNLOCK_COOKIE)?.value)) return [];
  } catch {
    // Outside a request (scripts, tests): stay locked.
  }
  return LOCKED_PROVIDER_IDS;
}
