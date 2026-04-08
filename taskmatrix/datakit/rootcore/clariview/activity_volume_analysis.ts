/**
 * Detect volume-based patterns in a series of activity amounts
 */
export interface PatternMatch {
  index: number
  window: number
  average: number
  max: number
  min: number
  volatility: number
}

export function detectVolumePatterns(
  volumes: number[],
  windowSize: number,
  threshold: number
): PatternMatch[] {
  const matches: PatternMatch[] = []
  if (windowSize <= 0 || threshold < 0) return matches
  if (volumes.length < windowSize) return matches

  for (let i = 0; i + windowSize <= volumes.length; i++) {
    const slice = volumes.slice(i, i + windowSize)
    const sum = slice.reduce((a, b) => a + b, 0)
    const avg = sum / windowSize
    const max = Math.max(...slice)
    const min = Math.min(...slice)
    const volatility = max - min

    if (avg >= threshold) {
      matches.push({
        index: i,
        window: windowSize,
        average: avg,
        max,
        min,
        volatility,
      })
    }
  }

  return matches
}

/**
 * Utility to detect strongest pattern from a series
 */
export function detectStrongestPattern(
  volumes: number[],
  windowSize: number,
  threshold: number
): PatternMatch | null {
  const all = detectVolumePatterns(volumes, windowSize, threshold)
  if (all.length === 0) return null
  return all.reduce((best, cur) => (cur.average > best.average ? cur : best))
}
