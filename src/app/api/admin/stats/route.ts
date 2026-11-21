import { type NextRequest, NextResponse } from "next/server";
import { checkAdmin } from "@/lib/admin-auth";
import { getStats } from "@/lib/db-events";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = checkAdmin(req);
  if (denied) return denied;
  const param = req.nextUrl.searchParams.get("days");
  const raw = param === null ? 7 : Number(param);
  const days = Number.isFinite(raw) ? Math.min(90, Math.max(1, Math.round(raw))) : 7;
  try {
    return NextResponse.json(await getStats(days));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
