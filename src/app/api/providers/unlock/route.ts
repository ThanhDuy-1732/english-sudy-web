import { NextResponse } from "next/server";
import { clearAttempts, clientKey, countAttempt } from "@/lib/unlock-limit";
import { UNLOCK_COOKIE, UNLOCK_MAX_AGE_S, blockedProviderIds, checkPassword, unlockToken } from "@/lib/provider-lock";

const NO_STORE = { "Cache-Control": "no-store" };

/** Whether this browser may use the locked providers. */
export async function GET() {
  return NextResponse.json({ unlocked: (await blockedProviderIds()).length === 0 }, { headers: NO_STORE });
}

/** `{ password }` → sets the httpOnly unlock cookie. */
export async function POST(req: Request) {
  if (!process.env.OPENCODE_LOCK_PASSWORD) {
    return NextResponse.json({ error: "Chưa cấu hình OPENCODE_LOCK_PASSWORD." }, { status: 503, headers: NO_STORE });
  }
  // Counted before the password is checked, so a burst of parallel guesses cannot slip past the cap.
  const key = clientKey(req);
  const wait = await countAttempt(key);
  if (wait > 0) {
    return NextResponse.json(
      { error: `Thử sai quá nhiều lần. Thử lại sau ${Math.ceil(wait / 60)} phút.` },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(wait) } }
    );
  }
  const body = (await req.json().catch(() => null)) as { password?: unknown } | null;
  if (!checkPassword(body?.password)) {
    return NextResponse.json({ error: "Sai mật khẩu." }, { status: 401, headers: NO_STORE });
  }
  await clearAttempts(key).catch(() => {});
  const res = NextResponse.json({ unlocked: true }, { headers: NO_STORE });
  res.cookies.set(UNLOCK_COOKIE, unlockToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: UNLOCK_MAX_AGE_S,
  });
  return res;
}

/** Locks this browser again. */
export async function DELETE() {
  const res = NextResponse.json({ unlocked: false }, { headers: NO_STORE });
  res.cookies.delete(UNLOCK_COOKIE);
  return res;
}
