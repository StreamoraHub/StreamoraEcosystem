import { execCommand } from "./execCommand"

export interface ShellTask {
  id: string
  command: string
  description?: string
  timeoutMs?: number
}

export interface ShellResult {
  taskId: string
  output?: string
  error?: string
  executedAt: number
  durationMs?: number
}

export class ShellTaskRunner {
  private tasks: ShellTask[] = []

  /**
   * Schedule a shell task for execution.
   */
  scheduleTask(task: ShellTask): void {
    if (this.tasks.find(t => t.id === task.id)) {
      throw new Error(`Task with id "${task.id}" already exists`)
    }
    this.tasks.push(task)
  }

  /**
   * Cancel a scheduled task by id.
   */
  cancelTask(id: string): boolean {
    const before = this.tasks.length
    this.tasks = this.tasks.filter(t => t.id !== id)
    return this.tasks.length < before
  }

  /**
   * List all scheduled tasks.
   */
  listTasks(): ShellTask[] {
    return [...this.tasks]
  }

  /**
   * Execute all scheduled tasks in sequence.
   */
  async runAll(): Promise<ShellResult[]> {
    const results: ShellResult[] = []
    for (const task of this.tasks) {
      const start = Date.now()
      try {
        const output = await execCommand(task.command, task.timeoutMs)
        results.push({
          taskId: task.id,
          output,
          executedAt: start,
          durationMs: Date.now() - start,
        })
      } catch (err: any) {
        results.push({
          taskId: task.id,
          error: err.message,
          executedAt: start,
          durationMs: Date.now() - start,
        })
      }
    }
    this.tasks = []
    return results
  }

  /**
   * Run a single task immediately without scheduling.
   */
  async runOnce(task: ShellTask): Promise<ShellResult> {
    const start = Date.now()
    try {
      const output = await execCommand(task.command, task.timeoutMs)
      return {
        taskId: task.id,
        output,
        executedAt: start,
        durationMs: Date.now() - start,
      }
    } catch (err: any) {
      return {
        taskId: task.id,
        error: err.message,
        executedAt: start,
        durationMs: Date.now() - start,
      }
    }
  }
}
