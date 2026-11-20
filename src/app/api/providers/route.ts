import { getRegisteredProviders } from "@/lib/providers";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(getRegisteredProviders(), {
    headers: { // The list only changes with env vars, i.e. on deploy, which purges the Vercel CDN cache.
    "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400" },
  });
}
