import { type NextRequest } from "next/server";
import { logEvent } from "@/lib/db-events";

// Anonymous usage beacon from the client: page views and finished sessions.
// ponytail: unauthenticated, so counts can be spammed; add rate limiting if that happens.

const KINDS = new Set(["page", "done"]);
const DEVICE_RE = /^[0-9a-f-]{8,64}$/i;

export async function POST(req: NextRequest) {
  let body: { kind?: unknown; name?: unknown; device?: unknown };
  try {
    body = JSON.parse(await req.text());
  } catch {
    return new Response(null, { status: 400 });
  }
  const { kind, name, device } = body ?? {};
  if (
    typeof kind !== "string" || !KINDS.has(kind) ||
    typeof name !== "string" || name.length === 0 || name.length > 120 ||
    typeof device !== "string" || !DEVICE_RE.test(device)
  ) {
    return new Response(null, { status: 400 });
  }
  await logEvent({ kind: kind as "page" | "done", name, device });
  return new Response(null, { status: 204 });
}
