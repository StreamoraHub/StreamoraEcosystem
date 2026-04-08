export interface SightCoreConfig {
  url: string
  protocols?: string[]
  reconnectIntervalMs?: number
  maxRetries?: number
  debug?: boolean
}

export type SightCoreMessage = {
  topic: string
  payload: any
  timestamp: number
}

export class SightCoreWebSocket {
  private socket?: WebSocket
  private url: string
  private protocols?: string[]
  private reconnectInterval: number
  private retries = 0
  private maxRetries: number
  private debug: boolean

  constructor(config: SightCoreConfig) {
    this.url = config.url
    this.protocols = config.protocols
    this.reconnectInterval = config.reconnectIntervalMs ?? 5000
    this.maxRetries = config.maxRetries ?? Infinity
    this.debug = config.debug ?? false
  }

  connect(
    onMessage: (msg: SightCoreMessage) => void,
    onOpen?: () => void,
    onClose?: () => void,
    onError?: (err: any) => void
  ): void {
    this.socket = this.protocols
      ? new WebSocket(this.url, this.protocols)
      : new WebSocket(this.url)

    this.socket.onopen = () => {
      this.retries = 0
      this.debug && console.log("[SightCoreWS] Connected")
      onOpen?.()
    }

    this.socket.onmessage = event => {
      try {
        const msg = JSON.parse(event.data) as SightCoreMessage
        onMessage(msg)
      } catch (err) {
        this.debug && console.warn("[SightCoreWS] Invalid message:", event.data)
      }
    }

    this.socket.onclose = () => {
      this.debug && console.log("[SightCoreWS] Closed")
      onClose?.()
      if (this.retries < this.maxRetries) {
        this.retries++
        setTimeout(
          () => this.connect(onMessage, onOpen, onClose, onError),
          this.reconnectInterval
        )
      }
    }

    this.socket.onerror = err => {
      this.debug && console.error("[SightCoreWS] Error:", err)
      onError?.(err)
      this.socket?.close()
    }
  }

  send(topic: string, payload: any): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      const msg = JSON.stringify({ topic, payload, timestamp: Date.now() })
      this.socket.send(msg)
      this.debug && console.log("[SightCoreWS] Sent:", msg)
    } else {
      this.debug && console.warn("[SightCoreWS] Cannot send, socket not open")
    }
  }

  disconnect(): void {
    this.debug && console.log("[SightCoreWS] Disconnecting...")
    this.socket?.close()
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN
  }
}
