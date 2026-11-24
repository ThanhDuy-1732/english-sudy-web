import type { ZodTypeAny } from "zod";
import { callTask, streamTask, type AITaskName } from "./ai-tasks";
import { parseAiJson } from "./ai-json";

/**
 * Finds the finished top-level `"key": value` pairs of a JSON object while its text is still arriving.
 * Text before the first `{` (code fences, preamble) is skipped.
 */
export function createFieldScanner() {
  let buf = "";
  let pos = 0;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let segStart = -1;

  function pair(segment: string): [string, unknown] | null {
    try {
      const [k, v] = Object.entries(JSON.parse(`{${segment}}`))[0] ?? [];
      return k === undefined ? null : [k, v];
    } catch {
      return null;
    }
  }

  return function push(chunk: string): [string, unknown][] {
    buf += chunk;
    const out: [string, unknown][] = [];
    for (; pos < buf.length; pos++) {
      const c = buf[pos];
      if (inString) {
        if (escaped) escaped = false;
        else if (c === "\\") escaped = true;
        else if (c === '"') inString = false;
        continue;
      }
      if (c === '"') inString = true;
      else if (c === "{" || c === "[") {
        depth++;
        if (depth === 1 && c === "{") segStart = pos + 1;
      } else if (c === "}" || c === "]") {
        depth--;
        if (depth === 0 && segStart >= 0) {
          const p = pair(buf.slice(segStart, pos));
          if (p) out.push(p);
          segStart = -1;
        }
      } else if (c === "," && depth === 1 && segStart >= 0) {
        const p = pair(buf.slice(segStart, pos));
        if (p) out.push(p);
        segStart = pos + 1;
      }
    }
    return out;
  };
}

interface GradeStreamOptions<T extends ZodTypeAny> {
  task: AITaskName;
  prompt: string;
  schema: T;
  temperature?: number;
  /** Fields the server adds to the validated result (not produced by the model). */
  extra?: Record<string, unknown>;
  /** Maps the repair error to the re-ask prompt. */
  repairPrompt: (err: string) => string;
}

/**
 * Streams a graded JSON answer as NDJSON lines: `{t:"field",k,v}` for each top-level field as soon as the model
 * finishes it, then `{t:"done",data}` with the schema-validated whole (repaired once if needed) or `{t:"error"}`.
 * Fails with a normal JSON error response when no provider starts, so the client sees the status.
 */
export async function gradeStream<T extends ZodTypeAny>(o: GradeStreamOptions<T>): Promise<Response> {
  const { stream, providerId } = await streamTask({ task: o.task, prompt: o.prompt, temperature: o.temperature });
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: object) => controller.enqueue(enc.encode(`${JSON.stringify(event)}\n`));
      const scan = createFieldScanner();
      let text = "";
      try {
        for await (const chunk of stream) {
          text += chunk;
          for (const [k, v] of scan(chunk)) send({ t: "field", k, v });
        }
        const parsed = await parseAiJson(text, o.schema, {
          repair: (err) =>
            callTask({ task: o.task, prompt: o.repairPrompt(err), provider: providerId, temperature: o.temperature, repair: true }).then((r) => r.text),
        });
        send({ t: "done", data: { ...(parsed as object), ...o.extra, gradedBy: providerId } });
      } catch {
        send({ t: "error" });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Provider-Used": providerId } });
}
