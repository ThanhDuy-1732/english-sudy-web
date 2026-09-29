import { type NextRequest, NextResponse } from "next/server";
import { getAggregatedMetrics } from "@/lib/ai-metrics";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

export function GET(req: NextRequest) {
  if (ADMIN_SECRET) {
    const token = req.headers.get("x-admin-secret") ?? req.nextUrl.searchParams.get("secret");
    if (token !== ADMIN_SECRET) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }
  return NextResponse.json(getAggregatedMetrics());
}
