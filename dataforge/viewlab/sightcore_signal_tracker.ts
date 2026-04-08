import type { SightCoreMessage } from "./WebSocketClient"

export interface AggregatedSignal {
  topic: string
  count: number
  lastPayload: any
  lastTimestamp: number
  firstTimestamp?: number
}

export class SignalAggregator {
  private counts: Record<string, AggregatedSignal> = {}

  /**
   * Process a new message and update aggregated stats.
   */
  processMessage(msg: SightCoreMessage): AggregatedSignal {
    const { topic, payload, timestamp } = msg
    let entry = this.counts[topic]

    if (!entry) {
      entry = {
        topic,
        count: 0,
        lastPayload: null,
        lastTimestamp: 0,
        firstTimestamp: timestamp,
      }
    }

    entry.count += 1
    entry.lastPayload = payload
    entry.lastTimestamp = timestamp
    this.counts[topic] = entry
    return entry
  }

  /**
   * Get aggregated data for a single topic.
   */
  getAggregated(topic: string): AggregatedSignal | undefined {
    return this.counts[topic]
  }

  /**
   * Get all aggregated topics.
   */
  getAllAggregated(): AggregatedSignal[] {
    return Object.values(this.counts)
  }

  /**
   * Return the top N topics by message count.
   */
  getTopTopics(limit = 5): AggregatedSignal[] {
    return this.getAllAggregated()
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  }

  /**
   * Return stats including total messages and unique topics.
   */
  getStats(): { totalMessages: number; uniqueTopics: number } {
    const all = this.getAllAggregated()
    const totalMessages = all.reduce((sum, e) => sum + e.count, 0)
    return { totalMessages, uniqueTopics: all.length }
  }

  /**
   * Reset all counts.
   */
  reset(): void {
    this.counts = {}
  }
}
