/** @jest-environment node */
import { NextRequest } from "next/server";
import { POST } from "../speech/transcribe/route";

test("forwards MP4 audio with the matching filename and rejects non-audio files", async () => {
  const previousKey = process.env.GROQ_API_KEY;
  const previousFetch = global.fetch;
  process.env.GROQ_API_KEY = "test-key";
  const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ text: "Hello", duration: 1, segments: [] }) });
  global.fetch = fetcher;
  try {
    const form = new FormData();
    form.append("audio", new Blob(["audio"], { type: "audio/mp4" }), "recording.m4a");
    const response = await POST(new NextRequest("http://localhost/api/speech/transcribe", { method: "POST", body: form }));
    expect(response.status).toBe(200);
    const sent = fetcher.mock.calls[0][1].body.get("file") as File;
    expect(sent.name).toBe("speech.m4a");
    expect(sent.type).toBe("audio/mp4");
    const invalid = new FormData();
    invalid.append("audio", new Blob(["not audio"], { type: "text/plain" }), "test.txt");
    const rejected = await POST(new NextRequest("http://localhost/api/speech/transcribe", { method: "POST", body: invalid }));
    expect(rejected.status).toBe(415);
    expect(fetcher).toHaveBeenCalledTimes(1);
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = previousKey;
  }
});

test("rejects an oversized upload from Content-Length before reading the body", async () => {
  const previousKey = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = "test-key";
  const req = new NextRequest("http://localhost/api/speech/transcribe", {
    method: "POST",
    headers: { "content-length": String(60 * 1024 * 1024) },
    body: "x",
  });
  const formData = jest.spyOn(req, "formData");
  try {
    const response = await POST(req);
    expect(response.status).toBe(413);
    expect(formData).not.toHaveBeenCalled();
  } finally {
    if (previousKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = previousKey;
  }
});

test("returns 400 when the body is not multipart form data", async () => {
  const response = await POST(new NextRequest("http://localhost/api/speech/transcribe", { method: "POST" }));
  expect(response.status).toBe(400);
});
