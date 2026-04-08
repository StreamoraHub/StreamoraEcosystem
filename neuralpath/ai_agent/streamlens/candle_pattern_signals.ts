import fetch from "node-fetch"

/*------------------------------------------------------
 * Types
 *----------------------------------------------------*/

export interface Candle {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
}

export type CandlestickPattern =
  | "Hammer"
  | "ShootingStar"
  | "BullishEngulfing"
  | "BearishEngulfing"
  | "Doji"

export interface PatternSignal {
  timestamp: number
  pattern: CandlestickPattern
  confidence: number
}

/*------------------------------------------------------
 * Detector
 *----------------------------------------------------*/

export class CandlestickPatternDetector {
  constructor(private readonly apiUrl: string) {}

  /* Fetch recent OHLC candles with an explicit timeout */
  async fetchCandles(symbol: string, limit = 100): Promise<Candle[]> {
    const cleanSymbol = this.normalizeSymbol(symbol)
    const url = `${this.apiUrl}/markets/${cleanSymbol}/candles?limit=${limit}`
    const res = await this.fetchWithTimeout(url, 10_000)

    if (!res.ok) {
      throw new Error(`Failed to fetch candles ${res.status}: ${res.statusText}`)
    }
    const data = (await res.json()) as Candle[]
    this.assertValidCandles(data)
    return data
  }

  /** Analyze a symbol end-to-end: fetch → detect → dedupe */
  async analyzeSymbol(symbol: string, limit = 200): Promise<PatternSignal[]> {
    const candles = await this.fetchCandles(symbol, limit)
    const signals = this.detectPatterns(candles)
    const gap = this.deriveTimeGap(candles, 2) // min 2-candle spacing
    return this.dedupeByTime(signals, gap)
  }

  /* ---------------------------------------------------
   * Internal HTTP utils
   * --------------------------------------------------*/

  private async fetchWithTimeout(url: string, ms: number): Promise<Response> {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), ms)
    try {
      return await fetch(url, { signal: controller.signal } as any)
    } finally {
      clearTimeout(id)
    }
  }

  private normalizeSymbol(symbol: string): string {
    const s = symbol.trim()
    if (!s) throw new Error("Symbol cannot be empty")
    return s.toUpperCase()
  }

  /* ---------------------------------------------------
   * Validation
   * --------------------------------------------------*/

  private assertValidCandles(candles: Candle[]): void {
    if (!Array.isArray(candles) || candles.length === 0) {
      throw new Error("No candle data returned")
    }
    for (const c of candles) {
      if (
        typeof c.timestamp !== "number" ||
        typeof c.open !== "number" ||
        typeof c.high !== "number" ||
        typeof c.low !== "number" ||
        typeof c.close !== "number"
      ) {
        throw new Error("Invalid candle shape detected")
      }
      if (!(c.low <= c.open && c.low <= c.close && c.high >= c.open && c.high >= c.close)) {
        // Basic sanity for OHLC bounds
        throw new Error("Inconsistent OHLC bounds")
      }
    }
  }

  /* ---------------------------------------------------
   * Pattern helpers
   * --------------------------------------------------*/

  private isHammer(c: Candle): number {
    const body = Math.abs(c.close - c.open)
    const lowerWick = Math.min(c.open, c.close) - c.low
    const range = c.high - c.low
    if (range <= 0) return 0
    const ratio = body > 0 ? lowerWick / body : 0
    const bodyShare = body / range
    return ratio > 2 && bodyShare < 0.3 ? Math.min(ratio / 3, 1) : 0
  }

  private isShootingStar(c: Candle): number {
    const body = Math.abs(c.close - c.open)
    const upperWick = c.high - Math.max(c.open, c.close)
    const range = c.high - c.low
    if (range <= 0) return 0
    const ratio = body > 0 ? upperWick / body : 0
    const bodyShare = body / range
    return ratio > 2 && bodyShare < 0.3 ? Math.min(ratio / 3, 1) : 0
  }

  private isBullishEngulfing(prev: Candle, curr: Candle): number {
    const cond =
      curr.close > curr.open &&
      prev.close < prev.open &&
      curr.close > prev.open &&
      curr.open < prev.close
    if (!cond) return 0
    const bodyPrev = Math.abs(prev.close - prev.open)
    const bodyCurr = Math.abs(curr.close - curr.open)
    return bodyPrev > 0 ? Math.min(bodyCurr / bodyPrev, 1) : 0.8
  }

  private isBearishEngulfing(prev: Candle, curr: Candle): number {
    const cond =
      curr.close < curr.open &&
      prev.close > prev.open &&
      curr.open > prev.close &&
      curr.close < prev.open
    if (!cond) return 0
    const bodyPrev = Math.abs(prev.close - prev.open)
    const bodyCurr = Math.abs(curr.close - curr.open)
    return bodyPrev > 0 ? Math.min(bodyCurr / bodyPrev, 1) : 0.8
  }

  private isDoji(c: Candle): number {
    const range = c.high - c.low
    const body = Math.abs(c.close - c.open)
    const ratio = range > 0 ? body / range : 1
    return ratio < 0.1 ? 1 - ratio * 10 : 0
  }

  /* ---------------------------------------------------
   * Detection & post-processing
   * --------------------------------------------------*/

  /** Convert raw detections into signals with thresholds and ordering */
  private detectPatterns(candles: Candle[]): PatternSignal[] {
    if (candles.length === 0) return []

    const out: PatternSignal[] = []
    const pushIf = (timestamp: number, pattern: CandlestickPattern, confidence: number) => {
      const c = this.clamp(this.round(confidence, 3), 0, 1)
      if (c >= 0.6) out.push({ timestamp, pattern, confidence: c })
    }

    for (let i = 0; i < candles.length; i++) {
      const c = candles[i]
      // Single-candle patterns
      const hammer = this.isHammer(c)
      if (hammer) pushIf(c.timestamp, "Hammer", hammer)

      const star = this.isShootingStar(c)
      if (star) pushIf(c.timestamp, "ShootingStar", star)

      const doji = this.isDoji(c)
      if (doji) pushIf(c.timestamp, "Doji", doji)

      // Two-candle patterns
      if (i > 0) {
        const p = candles[i - 1]
        const bull = this.isBullishEngulfing(p, c)
        if (bull) pushIf(c.timestamp, "BullishEngulfing", bull)

        const bear = this.isBearishEngulfing(p, c)
        if (bear) pushIf(c.timestamp, "BearishEngulfing", bear)
      }
    }

    // Sort by time ascending
    out.sort((a, b) => a.timestamp - b.timestamp)
    return out
  }

  /** Remove signals that are too close in time, keep the higher-confidence one */
  private dedupeByTime(signals: PatternSignal[], minGapMs: number): PatternSignal[] {
    if (signals.length <= 1) return signals

    const result: PatternSignal[] = []
    let lastKept: PatternSignal | undefined

    for (const s of signals) {
      if (!lastKept) {
        result.push(s)
        lastKept = s
        continue
      }
      const gap = s.timestamp - lastKept.timestamp
      if (gap >= minGapMs) {
        result.push(s)
        lastKept = s
      } else if (s.confidence > lastKept.confidence) {
        result[result.length - 1] = s
        lastKept = s
      }
    }
    return result
  }

  /** Derive a sensible time gap based on average candle interval and multiplier */
  private deriveTimeGap(candles: Candle[], multiplier = 2): number {
    if (candles.length < 2) return 0
    const first = candles[0].timestamp
    const last = candles[candles.length - 1].timestamp
    const avgInterval = (last - first) / Math.max(1, candles.length - 1)
    return Math.max(0, Math.floor(avgInterval * multiplier))
  }

  /* ---------------------------------------------------
   * Math helpers
   * --------------------------------------------------*/

  private clamp(v: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, v))
  }

  private round(v: number, decimals: number): number {
    const factor = Math.pow(10, decimals)
    return Math.round(v * factor) / factor
  }
}
