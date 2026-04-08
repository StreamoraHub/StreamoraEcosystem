export interface TokenDataPoint {
  timestamp: number
  priceUsd: number
  volumeUsd: number
  marketCapUsd: number
}

export class TokenDataFetcher {
  constructor(private apiBase: string, private timeoutMs: number = 15000) {}

  /**
   * Fetches an array of TokenDataPoint for the given token symbol.
   * Expects endpoint: `${apiBase}/tokens/${symbol}/history`
   */
  async fetchHistory(symbol: string): Promise<TokenDataPoint[]> {
    const url = `${this.apiBase}/tokens/${encodeURIComponent(symbol)}/history`
    const res = await this.fetchWithTimeout(url, this.timeoutMs)
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Failed to fetch history for ${symbol}: ${res.status} ${text}`)
    }
    const raw = (await res.json()) as any[]
    return raw
      .filter(r => r && typeof r.time === "number")
      .map(r => ({
        timestamp: r.time * 1000,
        priceUsd: Number(r.priceUsd ?? 0),
        volumeUsd: Number(r.volumeUsd ?? 0),
        marketCapUsd: Number(r.marketCapUsd ?? 0),
      }))
      .sort((a, b) => a.timestamp - b.timestamp)
  }

  /** Fetch a single most recent data point */
  async fetchLatest(symbol: string): Promise<TokenDataPoint | null> {
    const history = await this.fetchHistory(symbol)
    return history.length ? history[history.length - 1] : null
  }

  /** Compute average price from history */
  async fetchAveragePrice(symbol: string, points = 30): Promise<number> {
    const history = await this.fetchHistory(symbol)
    const slice = history.slice(-points)
    if (!slice.length) return 0
    return slice.reduce((sum, p) => sum + p.priceUsd, 0) / slice.length
  }

  /** Internal fetch with timeout */
  private async fetchWithTimeout(url: string, ms: number): Promise<Response> {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), ms)
    try {
      return await fetch(url, { signal: controller.signal } as RequestInit)
    } finally {
      clearTimeout(id)
    }
  }
}
