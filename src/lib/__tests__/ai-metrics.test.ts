import { recordMetric, getMetrics, clearMetrics, getAggregatedMetrics } from "../ai-metrics";

beforeEach(() => { clearMetrics(); });

test("recordMetric stores a metric entry", () => {
  recordMetric({ task: "word-generation", latencyMs: 450, success: true, usedFallback: false });
  expect(getMetrics()).toHaveLength(1);
});

test("getMetrics returns all recorded metrics", () => {
  recordMetric({ task: "exam-generation", latencyMs: 1200, success: true, usedFallback: false });
  recordMetric({ task: "speaking-grade", latencyMs: 3000, success: false, usedFallback: true });
  expect(getMetrics()).toHaveLength(2);
});

test("metrics cap at 1000 entries", () => {
  for (let i = 0; i < 1100; i++) {
    recordMetric({ task: "word-generation", latencyMs: 100, success: true, usedFallback: false });
  }
  expect(getMetrics().length).toBeLessThanOrEqual(1000);
});

test("aggregates p50/p95, repair rate and per-provider latency", () => {
  for (let i = 1; i <= 20; i++) {
    recordMetric({ task: "writing-grade", latencyMs: i * 1000, success: true, usedFallback: false, provider: "opencode", outChars: 400, repair: i === 20 });
  }
  const agg = getAggregatedMetrics()["writing-grade"];
  expect(agg.p50LatencyMs).toBe(11000);
  expect(agg.p95LatencyMs).toBe(20000);
  expect(agg.repairRate).toBe(5);
  expect(agg.avgOutChars).toBe(400);
  expect(agg.byProvider.opencode.count).toBe(20);
});
