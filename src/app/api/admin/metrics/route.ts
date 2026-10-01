import { timingSafeEqual } from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import { getAggregatedMetrics } from "@/lib/ai-metrics";

export function GET(req: NextRequest) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return new NextResponse("Admin endpoint not configured", { status: 503 });
  }
  const a = Buffer.from(req.headers.get("x-admin-secret") ?? "");
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  return NextResponse.json(getAggregatedMetrics());
}
