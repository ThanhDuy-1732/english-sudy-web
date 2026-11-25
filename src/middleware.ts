import { NextResponse, type NextRequest } from "next/server";
import { checkApiRequest, clientIp, RATE_LIMIT_MESSAGE } from "@/lib/api-limits";
import { countSharedRequest } from "@/lib/shared-rate-limit";

// Usage beacons spend no AI quota, so they are not worth a database write each.
const NOT_SHARED = new Set(["/api/track"]);

export async function middleware(req: NextRequest) {
  if (req.method !== "POST") return NextResponse.next();
  const path = req.nextUrl.pathname;
  const ip = clientIp(req.headers);
  const result = checkApiRequest({ path, ip, contentLength: req.headers.get("content-length") });
  if (!result.ok) return refuse(result.status, result.error, result.retryAfterSec);
  const wait = NOT_SHARED.has(path) ? 0 : await countSharedRequest(ip);
  return wait ? refuse(429, RATE_LIMIT_MESSAGE, wait) : NextResponse.next();
}

function refuse(status: number, error: string, retryAfterSec?: number) {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store", ...(retryAfterSec ? { "Retry-After": String(retryAfterSec) } : {}) } },
  );
}

export const config = { matcher: "/api/:path*" };
