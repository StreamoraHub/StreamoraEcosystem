import { TokenActivityAnalyzer } from "@/ai/modules/activity/token-activity-analyzer"
import { TokenDepthAnalyzer } from "@/ai/modules/depth/token-depth-analyzer"
import { detectVolumePatterns } from "@/ai/modules/signals/volume-patterns"
import { ExecutionEngine } from "@/ai/core/execution/engine"
import { SigningEngine } from "@/ai/core/crypto/signing"

/** --------- Config (env-overridable) --------- */
const SOLANA_RPC = process.env.SOLANA_RPC ?? "https://solana.rpc"
const DEX_API = process.env.DEX_API ?? "https://dex.api"
const MINT_PUBKEY = process.env.MINT_PUBKEY ?? "MintPubkeyHere"
const MARKET_PUBKEY = process.env.MARKET_PUBKEY ?? "MarketPubkeyHere"

const ACTIVITY_LIMIT = toPositiveInt(process.env.ACTIVITY_LIMIT ?? "20", 20)
const DEPTH_LIMIT = toPositiveInt(process.env.DEPTH_LIMIT ?? "30", 30)
const PATTERN_WINDOW = toPositiveInt(process.env.PATTERN_WINDOW ?? "5", 5)
const PATTERN_THRESHOLD = toPositiveInt(process.env.PATTERN_THRESHOLD ?? "100", 100)

/** --------- Utilities --------- */
function toPositiveInt(val: string, fallback: number): number {
  const n = Number(val)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

function assertNonEmpty(name: string, v: string) {
  if (!v || !v.trim()) throw new Error(`${name} must be provided`)
}

async function withTimeout<T>(p: Promise<T>, ms: number, label = "operation"): Promise<T> {
  let t: NodeJS.Timeout | undefined
  return Promise.race<T>([
    p.finally(() => t && clearTimeout(t)),
    new Promise<T>((_, rej) => {
      t = setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms)
    }),
  ])
}

function summarize<T extends { length: number }>(arr: T | any[]): { count: number } {
  return { count: arr.length }
}

/** --------- Main workflow --------- */
async function main() {
  assertNonEmpty("SOLANA_RPC", SOLANA_RPC)
  assertNonEmpty("DEX_API", DEX_API)
  assertNonEmpty("MINT_PUBKEY", MINT_PUBKEY)
  assertNonEmpty("MARKET_PUBKEY", MARKET_PUBKEY)

  // 1) Analyze activity
  const activityAnalyzer = new TokenActivityAnalyzer(SOLANA_RPC)
  const records = await withTimeout(
    activityAnalyzer.analyzeActivity(MINT_PUBKEY, ACTIVITY_LIMIT),
    20_000,
    "activity analysis"
  )

  // 2) Analyze depth
  const depthAnalyzer = new TokenDepthAnalyzer(DEX_API, MARKET_PUBKEY)
  const depthMetrics = await withTimeout(
    depthAnalyzer.analyze(DEPTH_LIMIT),
    20_000,
    "depth analysis"
  )

  // 3) Detect volume patterns
  const volumes = records.map(r => r.amount)
  const patterns = detectVolumePatterns(volumes, PATTERN_WINDOW, PATTERN_THRESHOLD)

  // 4) Execute a custom task
  const engine = new ExecutionEngine()
  engine.register("report", async (params: { records: unknown[] }) => ({
    ...summarize(params.records),
    generatedAt: new Date().toISOString(),
  }))
  engine.enqueue("task1", "report", { records })
  const taskResults = await engine.runAll()

  // 5) Sign the results
  const signer = new SigningEngine()
  const payload = JSON.stringify({ depthMetrics, patterns, taskResults })
  const signature = await signer.sign(payload)
  const signatureValid = await signer.verify(payload, signature)
  if (!signatureValid) throw new Error("Signature verification failed")

  // 6) Output
  const brief = {
    records: summarize(records),
    depthMetricsPresent: !!depthMetrics,
    patternsCount: patterns.length,
    tasks: taskResults.length,
    signatureValid,
  }

  console.log("[summary]", brief)
  console.log(
    "[details]",
    JSON.stringify({ depthMetrics, patterns, taskResults, signature }, null, 2)
  )
}

;(async () => {
  try {
    await withTimeout(main(), 60_000, "main")
  } catch (err: any) {
    console.error("[error]", err?.message ?? err)
    process.exitCode = 1
  }
})()
