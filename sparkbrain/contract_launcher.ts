export interface LaunchConfig {
  contractName: string
  parameters: Record<string, any>
  deployEndpoint: string
  apiKey?: string
  timeoutMs?: number
  retries?: number
}

export interface LaunchResult {
  success: boolean
  address?: string
  transactionHash?: string
  error?: string
}

export class LaunchNode {
  constructor(private config: LaunchConfig) {}

  /** Deploy the contract using configured parameters */
  async deploy(): Promise<LaunchResult> {
    const { deployEndpoint, apiKey, contractName, parameters, timeoutMs, retries } = this.config
    let attempt = 0
    const maxRetries = retries ?? 1

    while (attempt < maxRetries) {
      attempt++
      try {
        const controller = new AbortController()
        const id = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : undefined

        const res = await fetch(deployEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({ contractName, parameters }),
          signal: controller.signal,
        })

        if (id) clearTimeout(id)

        if (!res.ok) {
          const text = await res.text()
          return { success: false, error: `HTTP ${res.status}: ${text}` }
        }

        const json = await res.json()
        if (!json.contractAddress || !json.txHash) {
          return { success: false, error: "Invalid response format" }
        }

        return {
          success: true,
          address: json.contractAddress,
          transactionHash: json.txHash,
        }
      } catch (err: any) {
        if (attempt >= maxRetries) {
          return { success: false, error: err?.message ?? "Unknown error" }
        }
      }
    }
    return { success: false, error: "Max retries reached" }
  }

  /** Validate configuration before deployment */
  validateConfig(): boolean {
    if (!this.config.contractName || !this.config.deployEndpoint) return false
    if (!this.config.parameters || typeof this.config.parameters !== "object") return false
    return true
  }
}
