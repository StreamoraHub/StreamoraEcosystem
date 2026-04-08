import { z } from "zod"

/**
 * Base types for any workflow action.
 * Improvements: renamed to remove "Elaris", added error typing, metadata,
 * and a Result union for better success/error handling.
 */

export type ActionSchema = z.ZodObject<z.ZodRawShape>

export interface ActionResponse<T> {
  notice: string
  data?: T
  error?: string
  executedAt: number
  durationMs?: number
}

export type ActionResult<T> =
  | { ok: true; response: ActionResponse<T> }
  | { ok: false; error: string }

export interface BaseAction<
  S extends ActionSchema,
  R,
  Ctx = unknown
> {
  id: string
  summary: string
  input: S
  metadata?: {
    category?: string
    version?: string
    tags?: string[]
  }
  execute(args: {
    payload: z.infer<S>
    context: Ctx
  }): Promise<ActionResult<R>>
}
