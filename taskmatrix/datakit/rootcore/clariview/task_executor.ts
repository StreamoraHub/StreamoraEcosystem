/**
 * Simple task executor: registers and runs tasks by name.
 */
type Handler = (params: any) => Promise<any>

export interface Task {
  id: string
  type: string
  params: any
  createdAt: number
  attempts: number
}

export interface TaskResult {
  id: string
  result?: any
  error?: string
  durationMs?: number
}

export class ExecutionEngine {
  private handlers: Record<string, Handler> = {}
  private queue: Task[] = []
  private maxRetries: number

  constructor(maxRetries = 1) {
    this.maxRetries = maxRetries
  }

  /** Register a new handler type */
  register(type: string, handler: Handler): void {
    this.handlers[type] = handler
  }

  /** Add a new task to the queue */
  enqueue(id: string, type: string, params: any): void {
    if (!this.handlers[type]) throw new Error(`No handler for ${type}`)
    this.queue.push({ id, type, params, createdAt: Date.now(), attempts: 0 })
  }

  /** Execute all tasks in the queue */
  async runAll(): Promise<TaskResult[]> {
    const results: TaskResult[] = []
    while (this.queue.length) {
      const task = this.queue.shift()!
      const start = Date.now()
      try {
        task.attempts++
        const data = await this.handlers[task.type](task.params)
        results.push({ id: task.id, result: data, durationMs: Date.now() - start })
      } catch (err: any) {
        if (task.attempts < this.maxRetries) {
          // requeue for retry
          this.queue.push(task)
        } else {
          results.push({ id: task.id, error: err.message, durationMs: Date.now() - start })
        }
      }
    }
    return results
  }

  /** Get number of tasks waiting */
  size(): number {
    return this.queue.length
  }

  /** Clear all pending tasks */
  clear(): void {
    this.queue = []
  }

  /** List all registered handler types */
  listHandlers(): string[] {
    return Object.keys(this.handlers)
  }
}
