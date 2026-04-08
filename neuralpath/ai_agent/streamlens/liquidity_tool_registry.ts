import { toolkitBuilder } from "@/ai/core"
import { FETCH_POOL_DATA_KEY } from "@/ai/modules/liquidity/pool-fetcher/key"
import { ANALYZE_POOL_HEALTH_KEY } from "@/ai/modules/liquidity/health-checker/key"
import { FetchPoolDataAction } from "@/ai/modules/liquidity/pool-fetcher/action"
import { AnalyzePoolHealthAction } from "@/ai/modules/liquidity/health-checker/action"

type Toolkit = ReturnType<typeof toolkitBuilder>

/** 
 * Utility function to normalize keys and enforce consistent tool identifiers
 */
const buildToolKey = (prefix: string, key: string): string => {
  if (!prefix || !key) throw new Error("Tool key cannot be empty")
  const normalized = (s: string) =>
    s
      .trim()
      .replace(/\s+/g, "")
      .replace(/-+/g, "-")
      .toLowerCase()
  return `${normalized(prefix)}-${normalized(key)}`
}

/** Tool IDs for consistency */
const FETCH_TOOL_ID = buildToolKey("liquidityscan", FETCH_POOL_DATA_KEY)
const HEALTH_TOOL_ID = buildToolKey("poolhealth", ANALYZE_POOL_HEALTH_KEY)

/** Exported IDs for external reference */
export const EXTENDED_TOOL_IDS = [FETCH_TOOL_ID, HEALTH_TOOL_ID] as const
export type ExtendedToolId = (typeof EXTENDED_TOOL_IDS)[number]

/**
 * Registry of extended liquidity tools
 * - fetch raw liquidity pool data
 * - perform pool health / risk analysis
 */
export const EXTENDED_LIQUIDITY_TOOLS: Record<ExtendedToolId, Toolkit> = Object.freeze({
  [FETCH_TOOL_ID]: toolkitBuilder(new FetchPoolDataAction()),
  [HEALTH_TOOL_ID]: toolkitBuilder(new AnalyzePoolHealthAction()),
} as const)

/** 
 * Helper to get a tool by its identifier 
 */
export const getLiquidityTool = (id: ExtendedToolId): Toolkit => {
  const tool = EXTENDED_LIQUIDITY_TOOLS[id]
  if (!tool) {
    throw new Error(`Liquidity tool not found: ${id}`)
  }
  return tool
}
