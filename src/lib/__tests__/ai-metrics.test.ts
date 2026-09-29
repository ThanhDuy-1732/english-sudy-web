import { recordMetric, getMetrics, clearMetrics } from "../ai-metrics";

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
