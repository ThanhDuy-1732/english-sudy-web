import { NextResponse } from "next/server";
import { getAggregatedMetrics } from "@/lib/ai-metrics";

export function GET() {
  return NextResponse.json(getAggregatedMetrics());
}
