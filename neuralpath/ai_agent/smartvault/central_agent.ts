import type { BaseAction, ActionResponse, ActionResult } from "./base_action"
import { z } from "zod"

interface AgentContext {
  apiEndpoint: string
  apiKey: string
}

/**
 * Central Agent: routes calls to registered actions.
 * Improvements: removed "Elaris", added listing, unregister, safe invoke,
 * error handling, execution timing, and metadata support.
 */
export class Agent {
  private actions = new Map<string, BaseAction<any, any, AgentContext>>()

  register<S, R>(action: BaseAction<S, R, AgentContext>): void {
    if (this.actions.has(action.id)) {
      throw new Error(`Action with id "${action.id}" already registered`)
    }
    this.actions.set(action.id, action)
  }

  unregister(id: string): boolean {
    return this.actions.delete(id)
  }

  listActions(): string[] {
    return Array.from(this.actions.keys())
  }

  getAction(id: string): BaseAction<any, any, AgentContext> | undefined {
    return this.actions.get(id)
  }

  async invoke<R>(
    actionId: string,
    payload: unknown,
    ctx: AgentContext
  ): Promise<ActionResult<R>> {
    const action = this.actions.get(actionId)
    if (!action) {
      return { ok: false, error: `Unknown action "${actionId}"` }
    }
    try {
      const start = Date.now()
      // Validate payload using schema
      const parsed = action.input.safeParse(payload)
      if (!parsed.success) {
        return { ok: false, error: `Validation error: ${parsed.error.message}` }
      }
      const result = await action.execute({ payload: parsed.data, context: ctx })
      const duration = Date.now() - start
      result.response.durationMs = duration
      return result
    } catch (err: any) {
      return { ok: false, error: err.message }
    }
  }
}
