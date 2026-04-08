import type { Signal } from "./SignalApiClient"

/**
 * Processes raw signals into actionable events
 * Improvements: added grouping, sorting, deduplication,
 * extended filtering, batch summarization
 */
export class SignalProcessor {
  /**
   * Filter signals by type and recency.
   * @param signals Array of Signal
   * @param type Desired signal type
   * @param sinceTimestamp Only include signals after this time
   */
  filter(signals: Signal[], type: string, sinceTimestamp: number): Signal[] {
    return signals.filter(s => s.type === type && s.timestamp > sinceTimestamp)
  }

  /**
   * Aggregate signals by type, counting occurrences.
   * @param signals Array of Signal
   */
  aggregateByType(signals: Signal[]): Record<string, number> {
    return signals.reduce((acc, s) => {
      acc[s.type] = (acc[s.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }

  /**
   * Group signals by type into buckets.
   */
  groupByType(signals: Signal[]): Record<string, Signal[]> {
    return signals.reduce((acc, s) => {
      if (!acc[s.type]) acc[s.type] = []
      acc[s.type].push(s)
      return acc
    }, {} as Record<string, Signal[]>)
  }

  /**
   * Sort signals by timestamp ascending or descending.
   */
  sortByTimestamp(signals: Signal[], order: "asc" | "desc" = "asc"): Signal[] {
    return [...signals].sort((a, b) =>
      order === "asc" ? a.timestamp - b.timestamp : b.timestamp - a.timestamp
    )
  }

  /**
   * Remove duplicate signals by id.
   */
  deduplicate(signals: Signal[]): Signal[] {
    const seen = new Set<string>()
    return signals.filter(s => {
      if (seen.has(s.id)) return false
      seen.add(s.id)
      return true
    })
  }

  /**
   * Transform a single signal into a human-readable summary string.
   */
  summarize(signal: Signal): string {
    const time = new Date(signal.timestamp).toISOString()
    return `[${time}] ${signal.type.toUpperCase()}: ${JSON.stringify(signal.payload)}`
  }

  /**
   * Summarize a batch of signals into lines.
   */
  summarizeBatch(signals: Signal[]): string[] {
    return this.sortByTimestamp(signals, "asc").map(s => this.summarize(s))
  }
}
