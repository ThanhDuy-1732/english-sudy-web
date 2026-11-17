import { NextResponse, type NextRequest } from "next/server";
import { checkApiRequest, clientIp } from "@/lib/api-limits";

export function middleware(req: NextRequest) {
  if (req.method !== "POST") return NextResponse.next();
  const result = checkApiRequest({ path: req.nextUrl.pathname, ip: clientIp(req.headers), contentLength: req.headers.get("content-length") });
  if (result.ok) return NextResponse.next();
  return NextResponse.json(
    { error: result.error },
    { status: result.status, headers: { "Cache-Control": "no-store", ...(result.retryAfterSec ? { "Retry-After": String(result.retryAfterSec) } : {}) } },
  );
}

export const config = { matcher: "/api/:path*" };
