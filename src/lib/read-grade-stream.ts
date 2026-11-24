/** Reads a gradeStream response: calls onField as each field arrives and resolves with the validated whole. */
export async function readGradeStream<T>(res: Response, onField?: (key: string, value: unknown) => void): Promise<T> {
  if (!res.body) throw new Error("no response body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: T | undefined;

  function handle(line: string) {
    if (!line.trim()) return;
    const event = JSON.parse(line) as { t: string; k?: string; v?: unknown; data?: T };
    if (event.t === "field" && event.k) onField?.(event.k, event.v);
    else if (event.t === "done") result = event.data;
    else if (event.t === "error") throw new Error("grading failed");
  }

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(handle);
  }
  handle(buffer);
  if (result === undefined) throw new Error("grading stream ended early");
  return result;
}
