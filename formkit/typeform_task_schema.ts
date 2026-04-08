import { z } from "zod"

/**
 * Schema for scheduling a new task via Typeform submission.
 * Improvements: added description, priority, validation for parameters,
 * and support for optional tags. (~30% expansion)
 */
export const TaskFormSchema = z.object({
  taskName: z.string().min(3, "Task name too short").max(100, "Task name too long"),
  taskType: z.enum(["anomalyScan", "tokenAnalytics", "whaleMonitor", "liquidityCheck", "walletTrace"]),
  description: z.string().max(200).optional(),
  parameters: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .refine(obj => Object.keys(obj).length > 0, "Parameters must include at least one key"),
  scheduleCron: z
    .string()
    .regex(
      /^(\*|[0-5]?\d) (\*|[01]?\d|2[0-3]) (\*|[1-9]|[12]\d|3[01]) (\*|[1-9]|1[0-2]) (\*|[0-6])$/,
      "Invalid cron expression"
    ),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  tags: z.array(z.string().min(1)).optional(),
})

export type TaskFormInput = z.infer<typeof TaskFormSchema>
