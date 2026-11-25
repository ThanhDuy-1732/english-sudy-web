import { getProviderById } from "@/lib/providers";
import { blockedProviderIds } from "@/lib/provider-lock";
import { NextRequest, NextResponse } from "next/server";

// Vercel: AI providers are tried in turn (25 s each) plus a JSON repair call; 300 s is the Hobby maximum with Fluid compute.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let providerId: string | undefined;
  try {
    const body = (await req.json()) as { providerId?: string };
    providerId = body.providerId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!providerId) {
    return NextResponse.json({ error: "providerId is required" }, { status: 400 });
  }

  if ((await blockedProviderIds()).includes(providerId)) {
    return NextResponse.json({ error: "Cần mật khẩu để dùng mô hình này." }, { status: 403 });
  }

  const provider = getProviderById(providerId);
  if (!provider) {
    return NextResponse.json({ error: "Provider not found or not configured" }, { status: 404 });
  }

  const start = Date.now();
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutMs = Number(process.env.AI_PROVIDER_TIMEOUT_MS) || 25_000;
  try {
    await Promise.race([
      provider.generateContent("Reply with just: OK"),
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error("timeout")), timeoutMs);
      }),
    ]);
    clearTimeout(timeoutHandle);
    return NextResponse.json({ ok: true, latency: Date.now() - start });
  } catch (error) {
    clearTimeout(timeoutHandle);
    console.error(`provider test failed: ${providerId}`, error);
    const status = (error as { status?: number }).status;
    const message =
      error instanceof Error && error.message === "timeout" ? "Hết thời gian chờ"
        : status === 429 ? "Hết hạn mức hoặc gửi quá nhanh (429)"
        : status === 401 || status === 403 ? `Khoá API bị từ chối (${status})`
        : status ? `Nhà cung cấp báo lỗi (${status})` : "Không kết nối được tới nhà cung cấp";
    return NextResponse.json({ ok: false, error: message, latency: Date.now() - start });
  }
}
