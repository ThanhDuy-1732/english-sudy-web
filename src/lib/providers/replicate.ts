import type { AIProvider } from "./types";

export class ReplicateProvider implements AIProvider {
  readonly id = "replicate";
  readonly name = "Replicate";
  readonly model: string;
  private apiKey: string;
  private owner: string;
  private modelName: string;
  private sleep: (ms: number) => Promise<void>;

  constructor(
    apiKey: string,
    model: string,
    sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((r) => setTimeout(r, ms))
  ) {
    this.model = model;
    this.apiKey = apiKey;
    const slash = model.indexOf("/");
    this.owner = model.slice(0, slash);
    this.modelName = model.slice(slash + 1);
    this.sleep = sleep;
  }

  async generateContent(prompt: string): Promise<string> {
    const createRes = await fetch(
      `https://api.replicate.com/v1/models/${this.owner}/${this.modelName}/predictions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input: { prompt } }),
      }
    );

    if (!createRes.ok) {
      throw { status: createRes.status };
    }

    const prediction = (await createRes.json()) as {
      id: string;
      status: string;
      output?: string[];
      error?: string;
    };

    if (prediction.status === "succeeded") {
      return Array.isArray(prediction.output) ? prediction.output.join("") : "";
    }

    for (let i = 0; i < 20; i++) {
      await this.sleep(500);
      const pollRes = await fetch(
        `https://api.replicate.com/v1/predictions/${prediction.id}`,
        { headers: { Authorization: `Bearer ${this.apiKey}` } }
      );
      if (!pollRes.ok) throw { status: pollRes.status };
      const polled = (await pollRes.json()) as {
        status: string;
        output?: string[];
        error?: string;
      };
      if (polled.status === "succeeded") {
        return Array.isArray(polled.output) ? polled.output.join("") : "";
      }
      if (polled.status === "failed") {
        throw new Error(polled.error ?? "Replicate prediction failed");
      }
    }
    throw new Error("Replicate prediction timed out");
  }
}
