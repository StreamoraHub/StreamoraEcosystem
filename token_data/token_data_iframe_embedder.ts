import type { TokenDataPoint } from "./token_data_fetcher"

export interface DataIframeConfig {
  containerId: string
  iframeUrl: string
  token: string
  refreshMs?: number
  /** Restrict postMessage target; defaults to iframeUrl origin */
  targetOrigin?: string
  /** Optional fixed height in pixels (fallback: 100%) */
  heightPx?: number
  /** Optional fixed width (e.g., "100%", "800px"); defaults to "100%" */
  width?: string
  /** Auto-refresh on page visibility changes */
  refreshOnVisibilityChange?: boolean
}

type TokenDataMessage =
  | {
      type: "TOKEN_DATA_UPDATE"
      token: string
      data: TokenDataPoint[]
    }
  | {
      type: "TOKEN_DATA_ERROR"
      token: string
      error: string
    }

export class TokenDataIframeEmbedder {
  private iframe?: HTMLIFrameElement
  private timer?: number
  private disposed = false
  private ready = false
  private postDebounced: () => void

  constructor(private cfg: DataIframeConfig) {
    this.postDebounced = this.debounce(() => this.postTokenData(), 250)
  }

  async init(): Promise<void> {
    const container = document.getElementById(this.cfg.containerId)
    if (!container) throw new Error(`Container not found: ${this.cfg.containerId}`)

    const iframe = document.createElement("iframe")
    iframe.src = this.cfg.iframeUrl
    iframe.style.border = "none"
    iframe.width = this.cfg.width ?? "100%"
    iframe.height = this.cfg.heightPx ? String(this.cfg.heightPx) : "100%"
    iframe.onload = () => {
      this.ready = true
      // Use rAF to ensure contentWindow is ready to receive messages
      requestAnimationFrame(() => this.postDebounced())
    }

    this.iframe = iframe
    container.appendChild(iframe)

    if (this.cfg.refreshMs && this.cfg.refreshMs > 0) {
      this.timer = window.setInterval(() => this.postTokenData(), this.cfg.refreshMs)
    }

    if (this.cfg.refreshOnVisibilityChange) {
      document.addEventListener("visibilitychange", this.onVisibility, false)
    }
  }

  /** Update token on the fly and push fresh data */
  async setToken(token: string): Promise<void> {
    this.cfg.token = token
    await this.postTokenData()
  }

  /** Manually trigger an immediate refresh */
  async refreshNow(): Promise<void> {
    await this.postTokenData()
  }

  /** Clean up DOM nodes and timers */
  destroy(): void {
    this.disposed = true
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = undefined
    }
    document.removeEventListener("visibilitychange", this.onVisibility, false)
    if (this.iframe?.parentElement) {
      this.iframe.parentElement.removeChild(this.iframe)
    }
    this.iframe = undefined
  }

  /* -------------------- internals -------------------- */

  private onVisibility = () => {
    if (document.visibilityState === "visible") {
      this.postDebounced()
    }
  }

  private async postTokenData(): Promise<void> {
    if (this.disposed || !this.ready) return
    const win = this.iframe?.contentWindow
    if (!win) return

    try {
      // Fetch latest data from the API base (derived from iframe URL host if needed)
      const fetcherModule = await import("./token_data_fetcher")
      const apiBase = this.cfg.iframeUrl // keep API colocated with the iframe host unless overridden externally
      const fetcher = new fetcherModule.TokenDataFetcher(apiBase)
      const data: TokenDataPoint[] = await fetcher.fetchHistory(this.cfg.token)

      const message: TokenDataMessage = {
        type: "TOKEN_DATA_UPDATE",
        token: this.cfg.token,
        data,
      }
      win.postMessage(message, this.resolveTargetOrigin())
    } catch (err: any) {
      const message: TokenDataMessage = {
        type: "TOKEN_DATA_ERROR",
        token: this.cfg.token,
        error: err?.message ?? "Unknown error",
      }
      win.postMessage(message, this.resolveTargetOrigin())
    }
  }

  private resolveTargetOrigin(): string {
    if (this.cfg.targetOrigin) return this.cfg.targetOrigin
    try {
      const origin = new URL(this.cfg.iframeUrl).origin
      return origin
    } catch {
      // Fallback when URL cannot be parsed (should not happen for valid URLs)
      return "*"
    }
  }

  private debounce(fn: () => void, ms: number): () => void {
    let id: number | undefined
    return () => {
      if (id) clearTimeout(id)
      id = window.setTimeout(() => fn(), ms)
    }
  }
}
