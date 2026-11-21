import { type NextRequest, NextResponse } from "next/server";
import { getAggregatedMetrics } from "@/lib/ai-metrics";
import { checkAdmin } from "@/lib/admin-auth";

export function GET(req: NextRequest) {
  return checkAdmin(req) ?? NextResponse.json(getAggregatedMetrics());
}
