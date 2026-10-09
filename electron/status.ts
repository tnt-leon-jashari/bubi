// Agent lifecycle status written by Claude Code hooks (or any tool) to ~/.bubi/status.json.
import { z } from 'zod'

export const statusSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('busy'), since: z.number() }),
  z.object({ status: z.literal('idle'), at: z.number().optional() }),
])

export type AgentStatus = z.infer<typeof statusSchema>

export function parseStatus(raw: string): AgentStatus | null {
  try {
    const result = statusSchema.safeParse(JSON.parse(raw))
    return result.success ? result.data : null
  }
  catch {
    return null
  }
}

export function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`
}
