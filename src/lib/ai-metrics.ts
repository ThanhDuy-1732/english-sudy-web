import type { AITaskName } from "./ai-tasks";

const MAX = 1000;

export interface MetricEntry {
  task: AITaskName;
  latencyMs: number;
  success: boolean;
  usedFallback: boolean;
  provider?: string;
  /** Providers tried, including the one that answered. */
  attempts?: number;
  outChars?: number;
  repair?: boolean;
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

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

export function getAggregatedMetrics(): Record<string, {
  count: number; avgLatencyMs: number; p50LatencyMs: number; p95LatencyMs: number;
  successRate: number; fallbackRate: number; repairRate: number; avgOutChars: number;
  byProvider: Record<string, { count: number; p50LatencyMs: number; p95LatencyMs: number }>;
}> {
  const groups: Record<string, MetricEntry[]> = {};
  for (const m of metrics) (groups[m.task] ??= []).push(m);
  const pct = (n: number, total: number) => Math.round((n / total) * 100);
  const latencies = (list: MetricEntry[]) => list.map((m) => m.latencyMs).sort((a, b) => a - b);

  return Object.fromEntries(Object.entries(groups).map(([task, list]) => {
    const sorted = latencies(list);
    const perProvider: Record<string, MetricEntry[]> = {};
    for (const m of list) if (m.provider) (perProvider[m.provider] ??= []).push(m);
    return [task, {
      count: list.length,
      avgLatencyMs: Math.round(sorted.reduce((s, v) => s + v, 0) / list.length),
      p50LatencyMs: percentile(sorted, 0.5),
      p95LatencyMs: percentile(sorted, 0.95),
      successRate: pct(list.filter((m) => m.success).length, list.length),
      fallbackRate: pct(list.filter((m) => m.usedFallback).length, list.length),
      repairRate: pct(list.filter((m) => m.repair).length, list.length),
      avgOutChars: Math.round(list.reduce((s, m) => s + (m.outChars ?? 0), 0) / list.length),
      byProvider: Object.fromEntries(Object.entries(perProvider).map(([id, entries]) => {
        const ps = latencies(entries);
        return [id, { count: entries.length, p50LatencyMs: percentile(ps, 0.5), p95LatencyMs: percentile(ps, 0.95) }];
      })),
    }];
  }));
}
