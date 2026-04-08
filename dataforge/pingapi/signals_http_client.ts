export interface Signal {
  id: string
  type: string
  timestamp: number
  payload: Record<string, any>
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  status?: number
  receivedAt?: number
}

/**
 * HTTP client for fetching signals from ArchiNet
 * Improvements: added timeout, retry logic, detailed error handling,
 * and helper methods for filtering & searching.
 */
export class SignalApiClient {
  private timeoutMs: number
  private maxRetries: number

  constructor(
    private baseUrl: string,
    private apiKey?: string,
    opts: { timeoutMs?: number; maxRetries?: number } = {}
  ) {
    this.timeoutMs = opts.timeoutMs ?? 10_000
    this.maxRetries = opts.maxRetries ?? 2
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`
    return headers
  }

  private async fetchJson<T>(url: string): Promise<ApiResponse<T>> {
    let attempt = 0
    let lastErr: any
    while (attempt <= this.maxRetries) {
      attempt++
      const controller = new AbortController()
      const t = setTimeout(() => controller.abort(), this.timeoutMs)
      try {
        const res = await fetch(url, { headers: this.getHeaders(), signal: controller.signal })
        if (!res.ok) return { success: false, error: `HTTP ${res.status}`, status: res.status }
        const data = (await res.json()) as T
        return { success: true, data, status: res.status, receivedAt: Date.now() }
      } catch (err: any) {
        lastErr = err
        if (attempt > this.maxRetries) break
      } finally {
        clearTimeout(t)
      }
    }
    return { success: false, error: lastErr?.message ?? "Fetch failed" }
  }

  async fetchAllSignals(): Promise<ApiResponse<Signal[]>> {
    return this.fetchJson<Signal[]>(`${this.baseUrl}/signals`)
  }

  async fetchSignalById(id: string): Promise<ApiResponse<Signal>> {
    return this.fetchJson<Signal>(`${this.baseUrl}/signals/${encodeURIComponent(id)}`)
  }

  /**
   * Fetch all signals and filter by type
   */
  async fetchSignalsByType(type: string): Promise<ApiResponse<Signal[]>> {
    const res = await this.fetchAllSignals()
    if (!res.success || !res.data) return res
    return {
      ...res,
      data: res.data.filter(s => s.type === type),
    }
  }

  /**
   * Fetch all signals within a time window
   */
  async fetchSignalsSince(since: number): Promise<ApiResponse<Signal[]>> {
    const res = await this.fetchAllSignals()
    if (!res.success || !res.data) return res
    return {
      ...res,
      data: res.data.filter(s => s.timestamp >= since),
    }
  }
}
