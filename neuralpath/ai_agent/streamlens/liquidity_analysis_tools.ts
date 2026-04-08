import { toolkitBuilder } from "@/ai/core"
import { FETCH_POOL_DATA_KEY } from "@/ai/modules/liquidity/pool-fetcher/key"
import { ANALYZE_POOL_HEALTH_KEY } from "@/ai/modules/liquidity/health-checker/key"
import { FetchPoolDataAction } from "@/ai/modules/liquidity/pool-fetcher/action"
import { AnalyzePoolHealthAction } from "@/ai/modules/liquidity/health-checker/action"

type Toolkit = ReturnType<typeof toolkitBuilder>

/**
 * Toolkit exposing liquidity-related actions:
 * - fetch raw pool data
 * - run health / risk analysis on a liquidity pool
 */

/** Normalize and compose a stable tool id like "<prefix>-<key>" */
const makeKey = (prefix: string, key: string): string => {
  if (!prefix || !key) throw new Error("Invalid tool key")
  const clean = (s: string) =>
    s
      .trim()
      .replace(/\s+/g, "")
      .replace(/-+/g, "-")
  return `${clean(prefix)}-${clean(key)}`
}

/** Stable tool identifiers */
const FETCH_TOOL_ID = makeKey("liquidityscan", FETCH_POOL_DATA_KEY)
const HEALTH_TOOL_ID = makeKey("poolhealth", ANALYZE_POOL_HEALTH_KEY)

/** Exported list of tool ids for discovery / validation */
export const TOOL_IDS = [FETCH_TOOL_ID, HEALTH_TOOL_ID] as const
export type ToolId = (typeof TOOL_IDS)[number]

/** Readonly registry map */
export const LIQUIDITY_ANALYSIS_TOOLS: Record<ToolId, Toolkit> = Object.freeze({
  [FETCH_TOOL_ID]: toolkitBuilder(new FetchPoolDataAction()),
  [HEALTH_TOOL_ID]: toolkitBuilder(new AnalyzePoolHealthAction()),
} as const)
