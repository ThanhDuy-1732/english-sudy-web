import type { AITaskName } from "./ai-tasks";

const MAX = 1000;

export interface MetricEntry {
  task: AITaskName;
  latencyMs: number;
  success: boolean;
  usedFallback: boolean;
  provider?: string;
  at: string;
}

// ponytail: in-memory per server instance; resets on cold start — fine for v1 monitoring
const metrics: MetricEntry[] = [];

export function recordMetric(entry: Omit<MetricEntry, "at">): void {
  metrics.unshift({ ...entry, at: new Date().toISOString() });
  if (metrics.length > MAX) metrics.splice(MAX);
}

export function getMetrics(): MetricEntry[] {
  return [...metrics];
}

export function clearMetrics(): void {
  metrics.length = 0;
}

export function getAggregatedMetrics(): Record<string, {
  count: number; avgLatencyMs: number; successRate: number; fallbackRate: number;
}> {
  const agg: Record<string, { total: number; latency: number; success: number; fallback: number }> = {};
  for (const m of metrics) {
    if (!agg[m.task]) agg[m.task] = { total: 0, latency: 0, success: 0, fallback: 0 };
    agg[m.task].total++;
    agg[m.task].latency += m.latencyMs;
    if (m.success) agg[m.task].success++;
    if (m.usedFallback) agg[m.task].fallback++;
  }
  return Object.fromEntries(Object.entries(agg).map(([k, v]) => [k, {
    count: v.total,
    avgLatencyMs: Math.round(v.latency / v.total),
    successRate: Math.round((v.success / v.total) * 100),
    fallbackRate: Math.round((v.fallback / v.total) * 100),
  }]));
}
