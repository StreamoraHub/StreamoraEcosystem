export interface VolumePoint {
  timestamp: number
  volumeUsd: number
}

export interface SpikeEvent {
  timestamp: number
  volume: number
  spikeRatio: number
  zScore?: number
  windowAvg?: number
}

export interface SpikeOptions {
  windowSize?: number           // size of rolling window (>=2 recommended)
  spikeThreshold?: number       // ratio threshold (current / avg)
  minInterval?: number          // minimum index gap between spikes
  minVolumeUsd?: number         // ignore points below this absolute volume
  roundDigits?: number          // rounding for spikeRatio and zScore
  useZScore?: boolean           // also compute (curr - avg)/std
}

/**
 * Detect spikes in trading volume compared to a rolling average window.
 * Optimizations: rolling sum/std, min interval debouncing, optional z-score,
 * configurable rounding, and input validation.
 */
export function detectVolumeSpikes(
  points: VolumePoint[],
  windowSize: number = 10,
  spikeThreshold: number = 2.0,
  opts: SpikeOptions = {}
): SpikeEvent[] {
  const w = Math.max(1, Math.floor(opts.windowSize ?? windowSize))
  const thr = Math.max(0, opts.spikeThreshold ?? spikeThreshold)
  const minInterval = Math.max(0, Math.floor(opts.minInterval ?? 0))
  const minVolumeUsd = Math.max(0, opts.minVolumeUsd ?? 0)
  const roundDigits = Math.max(0, Math.floor(opts.roundDigits ?? 2))
  const wantZ = !!opts.useZScore

  if (!Array.isArray(points) || points.length === 0) return []
  if (points.length <= w) return []

  // Sanitize volumes; replace non-finite with 0
  const volumes = points.map(p => (Number.isFinite(p.volumeUsd) ? p.volumeUsd : 0))

  // Rolling mean and (optionally) std via Welford’s algorithm over a fixed window
  const events: SpikeEvent[] = []
  let sum = 0
  let sumSq = 0
  // prime the first window [0, w)
  for (let i = 0; i < w; i++) {
    const v = volumes[i]
    sum += v
    sumSq += v * v
  }

  let lastSpikeIdx = -Infinity
  for (let i = w; i < volumes.length; i++) {
    const curr = volumes[i]
    const avg = sum / w
    const ratio = avg > 0 ? curr / avg : Infinity

    const variance = Math.max(0, sumSq / w - avg * avg)
    const std = Math.sqrt(variance)
    const z = std > 0 ? (curr - avg) / std : 0

    if (
      curr >= minVolumeUsd &&
      ratio >= thr &&
      i - lastSpikeIdx >= minInterval
    ) {
      const spike: SpikeEvent = {
        timestamp: points[i].timestamp,
        volume: curr,
        spikeRatio: roundTo(ratio, roundDigits),
        windowAvg: roundTo(avg, roundDigits),
      }
      if (wantZ) spike.zScore = roundTo(z, roundDigits)
      events.push(spike)
      lastSpikeIdx = i
    }

    // slide window: remove volumes[i - w], add volumes[i]
    const outV = volumes[i - w]
    sum += curr - outV
    sumSq += curr * curr - outV * outV
  }

  return events
}

function roundTo(x: number, digits: number): number {
  const m = Math.pow(10, digits)
  return Math.round(x * m) / m
}
