import { NextResponse } from "next/server";

/** The request body as a JSON object, or null when it is not one: `req.json()` throws on bad JSON, which became a bare 500. */
export async function readJson<T>(req: { json(): Promise<unknown> }): Promise<T | null> {
  const body = await req.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? (body as T) : null;
}

export const badJson = () => NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
