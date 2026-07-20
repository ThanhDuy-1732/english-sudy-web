import { getProviderById } from "@/lib/providers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { providerId } = (await req.json()) as { providerId?: string };

  if (!providerId) {
    return NextResponse.json({ error: "providerId is required" }, { status: 400 });
  }

  const provider = getProviderById(providerId);
  if (!provider) {
    return NextResponse.json({ error: "Provider not found or not configured" }, { status: 404 });
  }

  const start = Date.now();
  try {
    await Promise.race([
      provider.generateContent("Reply with just: OK"),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 10_000)
      ),
    ]);
    return NextResponse.json({ ok: true, latency: Date.now() - start });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message, latency: Date.now() - start });
  }
}
