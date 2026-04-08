/**
 * Analyze on-chain token activity: fetch recent activity and summarize transfers
 * Uses Solana JSON-RPC (POST), no REST-style paths
 */

type Commitment = "processed" | "confirmed" | "finalized"

export interface ActivityRecord {
  timestamp: number
  signature: string
  source: string
  destination: string
  amount: number
}

interface RpcRequest {
  jsonrpc: "2.0"
  id: number
  method: string
  params?: any[]
}

interface RpcResponse<T> {
  jsonrpc: "2.0"
  id: number
  result?: T
  error?: { code: number; message: string }
}

interface SignatureInfo {
  signature: string
  blockTime?: number | null
  slot: number
  err: unknown | null
}

interface TokenBalance {
  accountIndex: number
  mint: string
  owner?: string | null
  uiTokenAmount: { uiAmount: number | null }
}

interface TransactionMeta {
  preTokenBalances?: TokenBalance[] | null
  postTokenBalances?: TokenBalance[] | null
}

interface TransactionResponse {
  blockTime?: number | null
  meta?: TransactionMeta | null
}

export class TokenActivityAnalyzer {
  constructor(
    private rpcEndpoint: string,
    private options: { commitment?: Commitment; timeoutMs?: number; concurrency?: number } = {}
  ) {}

  /** Fetch recent signatures for an address with optional pagination support */
  async fetchRecentSignatures(
    address: string,
    limit = 100,
    before?: string
  ): Promise<SignatureInfo[]> {
    const params: any = [
      address,
      {
        limit,
        before,
        commitment: this.options.commitment ?? "confirmed",
      },
    ]
    const res = await this.rpc<RpcResponse<SignatureInfo[]>>("getSignaturesForAddress", params)
    return res.result ?? []
  }

  /** Fetch a single transaction by signature (JSON-RPC) */
  private async fetchTransaction(signature: string): Promise<TransactionResponse | null> {
    const res = await this.rpc<RpcResponse<TransactionResponse>>("getTransaction", [
      signature,
      {
        commitment: this.options.commitment ?? "confirmed",
        maxSupportedTransactionVersion: 0,
      },
    ])
    return res.result ?? null
  }

  /**
   * Analyze activity for a given mint:
   * 1) get recent signatures
   * 2) fetch transactions with limited concurrency
   * 3) compute token balance deltas per accountIndex for that mint
   */
  async analyzeActivity(mint: string, limit = 50): Promise<ActivityRecord[]> {
    const sigInfos = await this.fetchRecentSignatures(mint, limit)
    if (sigInfos.length === 0) return []

    const concurrency = Math.max(1, this.options.concurrency ?? 6)
    const tasks = [...sigInfos]
    const results: ActivityRecord[] = []

    // Simple concurrency control
    const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
      while (tasks.length) {
        const info = tasks.shift()!
        const tx = await this.fetchTransaction(info.signature)
        if (!tx || !tx.meta) continue

        const pre = (tx.meta.preTokenBalances ?? []).filter(b => b.mint === mint)
        const post = (tx.meta.postTokenBalances ?? []).filter(b => b.mint === mint)

        // Map by accountIndex for stable pairing
        const preMap = new Map(pre.map(b => [b.accountIndex, b]))
        const postMap = new Map(post.map(b => [b.accountIndex, b]))

        // Union of indices present in either pre or post
        const indices = new Set<number>([...preMap.keys(), ...postMap.keys()])

        for (const idx of indices) {
          const p = postMap.get(idx)
          const q = preMap.get(idx)
          const pAmt = p?.uiTokenAmount.uiAmount ?? 0
          const qAmt = q?.uiTokenAmount.uiAmount ?? 0
          const delta = pAmt - qAmt
          if (delta !== 0) {
            results.push({
              timestamp: (tx.blockTime ?? info.blockTime ?? 0) * 1000,
              signature: info.signature,
              source: (delta > 0 ? q?.owner : p?.owner) ?? "unknown",
              destination: (delta > 0 ? p?.owner : q?.owner) ?? "unknown",
              amount: Math.abs(delta),
            })
          }
        }
      }
    })

    await Promise.all(workers)
    // Sort ascending by time for deterministic output
    results.sort((a, b) => a.timestamp - b.timestamp)
    return results
  }

  /* ------------------------ internals ------------------------ */

  private async rpc<T extends RpcResponse<any>>(method: string, params?: any[]): Promise<T> {
    const body: RpcRequest = { jsonrpc: "2.0", id: Date.now(), method, params }
    const controller = new AbortController()
    const timeout = setTimeout(
      () => controller.abort(),
      Math.max(1, this.options.timeoutMs ?? 15_000)
    )
    try {
      const res = await fetch(this.rpcEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      } as RequestInit)
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`HTTP ${res.status}: ${text}`)
      }
      const json = (await res.json()) as T
      if ((json as RpcResponse<any>).error) {
        throw new Error((json as RpcResponse<any>).error!.message)
      }
      return json
    } finally {
      clearTimeout(timeout)
    }
  }
}
