export interface PricePoint {
  timestamp: number
  priceUsd: number
}

export interface TrendResult {
  startTime: number
  endTime: number
  trend: "upward" | "downward" | "neutral"
  changePct: number
}

export interface AnalyzeOptions {
  minSegmentLength?: number           // minimum window length for a segment
  minChangePct?: number               // ignore tiny segments with < this % change
  neutralEpsilonPct?: number          // treat |change| < epsilon as neutral
  smoothWindow?: number               // simple moving average window; 1 = off
  roundDigits?: number                // rounding for changePct
  ensureMonotonicTimestamps?: boolean // drop out-of-order points
}

/**
 * Analyze a series of price points to determine overall trend segments.
 * Improvements: options (smoothing, epsilon, min change), rounding control,
 * and safer boundary/pivot detection with optional timestamp sanitization.
 */
export function analyzePriceTrends(
  points: PricePoint[],
  minSegmentLength: number = 5,
  opts: AnalyzeOptions = {}
): TrendResult[] {
  const {
    minChangePct = 0,
    neutralEpsilonPct = 0.05,
    smoothWindow = 1,
    roundDigits = 2,
    ensureMonotonicTimestamps = true,
  } = opts

  const requiredLen = Math.max(1, opts.minSegmentLength ?? minSegmentLength)
  if (!Array.isArray(points) || points.length < requiredLen) return []

  // Optionally enforce non-decreasing timestamps
  const sanitized = ensureMonotonicTimestamps ? dedupeAndSort(points) : points.slice()

  // Optional smoothing
  const series = smoothWindow > 1 ? applySMA(sanitized, smoothWindow) : sanitized

  const results: TrendResult[] = []
  let segStart = 0

  const pushSegment = (endIdx: number) => {
    const start = series[segStart]
    const end = series[endIdx]
    if (!start || !end) return

    const changePct = pctChange(start.priceUsd, end.priceUsd)
    const absChange = Math.abs(changePct)

    if (endIdx - segStart + 1 >= requiredLen && absChange >= minChangePct) {
      const trend = resolveTrend(changePct, neutralEpsilonPct)
      results.push({
        startTime: start.timestamp,
        endTime: end.timestamp,
        trend,
        changePct: round(changePct, roundDigits),
      })
      segStart = endIdx
    }
  }

  for (let i = 1; i < series.length - 1; i++) {
    const a = series[i - 1].priceUsd
    const b = series[i].priceUsd
    const c = series[i + 1].priceUsd

    const dirNow = direction(a, b)
    const dirNext = direction(b, c)

    const pivot = dirNow !== 0 && dirNext !== 0 && dirNow !== dirNext
    const flatToMove = dirNow === 0 && dirNext !== 0
    const moveToFlat = dirNow !== 0 && dirNext === 0

    if (i - segStart + 1 >= requiredLen && (pivot || flatToMove || moveToFlat)) {
      pushSegment(i)
    }
  }

  // Close final segment
  pushSegment(series.length - 1)
  return results
}

// ---------- helpers ----------

function pctChange(start: number, end: number): number {
  if (start === 0) return 0
  return ((end - start) / start) * 100
}

function direction(a: number, b: number): -1 | 0 | 1 {
  if (b > a) return 1
  if (b < a) return -1
  return 0
}

function round(value: number, digits: number): number {
  const m = Math.pow(10, Math.max(0, digits))
  return Math.round(value * m) / m
}

function resolveTrend(changePct: number, neutralEpsilonPct: number): TrendResult["trend"] {
  const abs = Math.abs(changePct)
  if (abs < neutralEpsilonPct) return "neutral"
  return changePct > 0 ? "upward" : "downward"
}

function applySMA(points: PricePoint[], window: number): PricePoint[] {
  const w = Math.max(1, Math.floor(window))
  if (w === 1 || points.length === 0) return points.slice()

  const out: PricePoint[] = []
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    sum += points[i].priceUsd
    if (i >= w) sum -= points[i - w].priceUsd
    const price = i + 1 >= w ? sum / w : sum / (i + 1)
    out.push({ timestamp: points[i].timestamp, priceUsd: price })
  }
  return out
}

function dedupeAndSort(points: PricePoint[]): PricePoint[] {
  // Remove NaNs/invalid and sort by timestamp, keep last price for same timestamp
  const map = new Map<number, number>()
  for (const p of points) {
    if (!Number.isFinite(p.timestamp) || !Number.isFinite(p.priceUsd)) continue
    map.set(p.timestamp, p.priceUsd)
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([timestamp, priceUsd]) => ({ timestamp, priceUsd }))
}
