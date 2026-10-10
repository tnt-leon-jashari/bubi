// Tray-menu settings, persisted to ~/.bubi/config.json. Env vars win over the file.
import fs from 'node:fs'
import { z } from 'zod'
import { CONFIG_FILE, HOME_DIR } from './paths.js'

export const INTERRUPT_KEYS = { ctrlC: 'ctrl-c', escape: 'escape' } as const

export const configSchema = z.object({
  autoTrigger: z.boolean().catch(true),
  slowThresholdMs: z.number().int().positive().catch(20000),
  interruptKey: z.enum([INTERRUPT_KEYS.ctrlC, INTERRUPT_KEYS.escape]).catch(INTERRUPT_KEYS.ctrlC),
  lastMode: z.enum(['whip', 'pat']).catch('whip'),
})

export type Config = z.infer<typeof configSchema>

function readRaw(): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  }
  catch {
    return {}
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const config = configSchema.parse(readRaw())
  const threshold = Number(env.BUBI_SLOW_THRESHOLD_MS)
  if (threshold > 0) config.slowThresholdMs = threshold
  if (env.BUBI_DISABLE_AUTOTRIGGER === '1') config.autoTrigger = false
  return config
}

export function saveConfig(changes: Partial<Config>): void {
  try {
    fs.mkdirSync(HOME_DIR, { recursive: true })
    fs.writeFileSync(CONFIG_FILE, `${JSON.stringify({ ...readRaw(), ...changes }, null, 2)}\n`)
  }
  catch (err) {
    console.warn('bubi: could not save config:', (err as Error).message)
  }
}
