/** @jest-environment node */
import { NextRequest } from "next/server";
import { POST } from "../speak/roleplay/route";

const post = (body?: unknown) =>
  POST(new NextRequest("http://localhost/api/speak/roleplay", { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }));

test.each([undefined, {}, { scenario: { aiRole: "Clerk" }, history: "nope", userText: "hi" }])(
  "returns 400 for an invalid body: %j",
  async (body) => {
    expect((await post(body)).status).toBe(400);
  }
);
