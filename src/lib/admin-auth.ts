import { timingSafeEqual } from "crypto";
import { type NextRequest, NextResponse } from "next/server";

/** Returns an error response unless `x-admin-secret` matches ADMIN_SECRET; null when allowed. */
export function checkAdmin(req: NextRequest): NextResponse | null {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return new NextResponse("Admin endpoint not configured", { status: 503 });
  const a = Buffer.from(req.headers.get("x-admin-secret") ?? "");
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  return null;
}
