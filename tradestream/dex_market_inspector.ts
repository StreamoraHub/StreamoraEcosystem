export interface PairInfo {
  exchange: string
  pairAddress: string
  baseSymbol: string
  quoteSymbol: string
  liquidityUsd: number
  volume24hUsd: number
  priceUsd: number
  updatedAt?: number
}

export interface DexSuiteConfig {
  apis: Array<{ name: string; baseUrl: string; apiKey?: string }>
  timeoutMs?: number
  retries?: number
}

type Json = Record<string, any>

interface ApiPairResponse {
  token0?: { symbol?: string }
  token1?: { symbol?: string }
  liquidityUsd?: number | string
  volume24hUsd?: number | string
  priceUsd?: number | string
  updatedAt?: number
}

export class DexSuite {
  constructor(private config: DexSuiteConfig) {}

  /* --------------------------- public API --------------------------- */

  /**
   * Retrieve aggregated pair info across all configured DEX APIs
   * @param pairAddress Blockchain address of the trading pair
   */
  async getPairInfo(pairAddress: string): Promise<PairInfo[]> {
    this.assertNonEmpty("pairAddress", pairAddress)
    const results: PairInfo[] = []
    const tasks = this.config.apis.map(async api => {
      try {
        const data = await this.withRetry(() =>
          this.fetchFromApi<ApiPairResponse>(api, `/pair/${pairAddress}`)
        )
        const parsed = this.parsePairInfo(api.name, pairAddress, data)
        if (parsed) results.push(parsed)
      } catch {
        // skip failed API
      }
    })
    await Promise.all(tasks)
    // ensure deterministic order by exchange name
    return results.sort((a, b) => a.exchange.localeCompare(b.exchange))
  }

  /**
   * Compare a list of pairs across exchanges, returning the best volume and liquidity
   */
  async comparePairs(
    pairs: string[]
  ): Promise<Record<string, { bestVolume?: PairInfo; bestLiquidity?: PairInfo }>> {
    const entries = await Promise.all(
      pairs.map(async addr => {
        const infos = await this.getPairInfo(addr)
        if (!infos.length) return [addr, { bestVolume: undefined, bestLiquidity: undefined }] as const
        const bestVolume = this.maxBy(infos, x => x.volume24hUsd)
        const bestLiquidity = this.maxBy(infos, x => x.liquidityUsd)
        return [addr, { bestVolume, bestLiquidity }] as const
      })
    )
    return Object.fromEntries(entries)
  }

  /**
   * Summarize a pair across APIs: average price, total liquidity, total 24h volume
   */
  async summarizePair(
    pairAddress: string
  ): Promise<{ pairAddress: string; avgPriceUsd: number; totalLiquidityUsd: number; totalVolume24hUsd: number }> {
    const infos = await this.getPairInfo(pairAddress)
    const avgPriceUsd = this.average(infos.map(i => i.priceUsd))
    const totalLiquidityUsd = this.sum(infos.map(i => i.liquidityUsd))
    const totalVolume24hUsd = this.sum(infos.map(i => i.volume24hUsd))
    return { pairAddress, avgPriceUsd, totalLiquidityUsd, totalVolume24hUsd }
  }

  /* --------------------------- internals --------------------------- */

  private async fetchFromApi<T>(api: { name: string; baseUrl: string; apiKey?: string }, path: string): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 10000)
    try {
      const res = await fetch(`${this.trimSlash(api.baseUrl)}${path}`, {
        headers: api.apiKey ? { Authorization: `Bearer ${api.apiKey}` } : {},
        signal: controller.signal,
      } as RequestInit)
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(`${api.name} ${path} ${res.status} ${text}`)
      }
      return (await res.json()) as T
    } finally {
      clearTimeout(timer)
    }
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    const max = Math.max(1, this.config.retries ?? 1)
    let lastErr: unknown
    for (let i = 0; i < max; i++) {
      try {
        return await fn()
      } catch (err) {
        lastErr = err
        if (i === max - 1) throw err
      }
    }
    // unreachable but satisfies TS
    throw lastErr as Error
  }

  private parsePairInfo(exchange: string, pairAddress: string, raw: ApiPairResponse | Json): PairInfo | null {
    const data = raw as ApiPairResponse
    const baseSymbol = (data.token0?.symbol ?? "").toString()
    const quoteSymbol = (data.token1?.symbol ?? "").toString()
    const liquidityUsd = this.num(data.liquidityUsd)
    const volume24hUsd = this.num(data.volume24hUsd)
    const priceUsd = this.num(data.priceUsd)
    if (!baseSymbol || !quoteSymbol || !Number.isFinite(priceUsd)) return null
    return {
      exchange,
      pairAddress,
      baseSymbol,
      quoteSymbol,
      liquidityUsd,
      volume24hUsd,
      priceUsd,
      updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : undefined,
    }
  }

  private num(v: unknown): number {
    const n = typeof v === "string" ? Number(v) : (v as number)
    return Number.isFinite(n) ? n : 0
  }

  private sum(arr: number[]): number {
    return arr.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)
  }

  private average(arr: number[]): number {
    const valid = arr.filter(Number.isFinite)
    return valid.length ? this.sum(valid) / valid.length : 0
  }

  private maxBy<T>(arr: T[], sel: (x: T) => number): T {
    return arr.reduce((a, b) => (sel(b) > sel(a) ? b : a))
  }

  private trimSlash(url: string): string {
    return url.endsWith("/") ? url.slice(0, -1) : url
  }

  private assertNonEmpty(name: string, v: string): void {
    if (!v || !v.trim()) throw new Error(`${name} must be provided`)
  }
}
