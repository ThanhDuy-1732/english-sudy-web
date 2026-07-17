import { getRegisteredProviders } from "@/lib/providers";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(getRegisteredProviders(), {
    headers: { "Cache-Control": "no-store" },
  });
}
