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

async function transcribeWith(language?: string) {
  const previousKey = process.env.GROQ_API_KEY;
  const previousFetch = global.fetch;
  process.env.GROQ_API_KEY = "test-key";
  const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ text: "我是学生", language: "chinese", duration: 1, segments: [] }) });
  global.fetch = fetcher;
  try {
    const form = new FormData();
    form.append("audio", new Blob(["audio"], { type: "audio/webm" }), "r.webm");
    if (language) form.append("language", language);
    const response = await POST(new NextRequest("http://localhost/api/speech/transcribe", { method: "POST", body: form }));
    const upstream = fetcher.mock.calls[0][1].body as FormData;
    return { sent: upstream.get("language"), prompt: upstream.get("prompt"), body: await response.json() };
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = previousKey;
  }
}

test("transcribe forwards language=zh to Whisper", async () => {
  const { sent, body } = await transcribeWith("zh");
  expect(sent).toBe("zh");
  expect(body.language).toBe("chinese");
});

test("transcribe without language keeps en, and rejects unknown codes to en", async () => {
  expect((await transcribeWith()).sent).toBe("en");
  expect((await transcribeWith("fr")).sent).toBe("en");
});

test("Chinese asks Whisper for simplified characters; other languages send no prompt", async () => {
  expect((await transcribeWith("zh")).prompt).toBe("以下是普通话的句子。");
  expect((await transcribeWith("ja")).prompt).toBeNull();
  expect((await transcribeWith()).prompt).toBeNull();
});

test("language=vi is passed to Whisper", async () => {
  expect((await transcribeWith("vi")).sent).toBe("vi");
});

test("language=auto omits language so Whisper detects it", async () => {
  expect((await transcribeWith("auto")).sent).toBeNull();
});

test("response carries lang as a code", async () => {
  expect((await transcribeWith("auto")).body.lang).toBe("zh");
});

async function transcribeSegments(segments: { no_speech_prob: number }[]) {
  const previousKey = process.env.GROQ_API_KEY;
  const previousFetch = global.fetch;
  process.env.GROQ_API_KEY = "test-key";
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ text: "Cảm ơn các bạn đã theo dõi", language: "vietnamese", duration: 2, segments: segments.map((s) => ({ start: 0, end: 1, text: "x", ...s })) }),
  });
  try {
    const form = new FormData();
    form.append("audio", new Blob(["audio"], { type: "audio/webm" }), "r.webm");
    form.append("language", "vi");
    const response = await POST(new NextRequest("http://localhost/api/speech/transcribe", { method: "POST", body: form }));
    return response.json();
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = previousKey;
  }
}

test("silence flags noSpeech so filler text is not used", async () => {
  expect((await transcribeSegments([{ no_speech_prob: 0.9 }, { no_speech_prob: 0.8 }])).noSpeech).toBe(true);
  expect((await transcribeSegments([{ no_speech_prob: 0.9 }, { no_speech_prob: 0.1 }])).noSpeech).toBe(false);
  expect((await transcribeSegments([])).noSpeech).toBe(false);
});
