/**
 * Analyze on-chain orderbook depth for a given market
 */
export interface Order {
  price: number
  size: number
}

export interface DepthMetrics {
  averageBidDepth: number
  averageAskDepth: number
  spread: number
}

type OrderbookResponse = { bids: Order[]; asks: Order[] }

interface AnalyzerOptions {
  timeoutMs?: number
  depth?: number
}

export class TokenDepthAnalyzer {
  constructor(
    private rpcEndpoint: string,
    private marketId: string,
    private options: AnalyzerOptions = {}
  ) {}

  /** Fetch raw orderbook from endpoint with an optional timeout */
  async fetchOrderbook(depth = 50): Promise<OrderbookResponse> {
    const d = this.options.depth ?? depth
    const url = `${this.rpcEndpoint}/orderbook/${this.marketId}?depth=${d}`
    const res = await this.fetchWithTimeout(url, this.options.timeoutMs ?? 12_000)
    if (!res.ok) throw new Error(`Orderbook fetch failed: ${res.status}`)
    const json: OrderbookResponse = await res.json()
    this.assertValid(json)
    return this.normalize(json, d)
  }

  /** Compute basic metrics (avg bid/ask depth, spread) */
  async analyze(depth = 50): Promise<DepthMetrics> {
    const { bids, asks } = await this.fetchOrderbook(depth)
    const avg = (arr: Order[]) =>
      arr.reduce((s, o) => s + o.size, 0) / Math.max(arr.length, 1)
    const bestBid = bids[0]?.price ?? 0
    const bestAsk = asks[0]?.price ?? 0
    return {
      averageBidDepth: avg(bids),
      averageAskDepth: avg(asks),
      spread: bestAsk - bestBid,
    }
  }

  /* -------------------- internals -------------------- */

  private async fetchWithTimeout(url: string, ms: number): Promise<Response> {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), Math.max(1, ms))
    try {
      return await fetch(url, { signal: controller.signal } as RequestInit)
    } finally {
      clearTimeout(id)
    }
  }

  private assertValid(data: any): asserts data is OrderbookResponse {
    if (!data || !Array.isArray(data.bids) || !Array.isArray(data.asks)) {
      throw new Error("Invalid orderbook shape")
    }
  }

  /** Ensure numeric fields and sensible sorting (bids desc, asks asc) */
  private normalize(ob: OrderbookResponse, depth: number): OrderbookResponse {
    const clean = (arr: Order[]) =>
      arr
        .filter(o => Number.isFinite(o.price) && Number.isFinite(o.size) && o.size > 0 && o.price > 0)
        .slice(0, depth)

    const bids = clean(ob.bids).sort((a, b) => b.price - a.price)
    const asks = clean(ob.asks).sort((a, b) => a.price - b.price)
    return { bids, asks }
  }
}
