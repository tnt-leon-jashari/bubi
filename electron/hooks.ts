// Claude Code hooks that write ~/.bubi/status.json on prompt start/stop.
// Merges into ~/.claude/settings.json, keeps a backup, safe to re-run.
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { CLAUDE_SETTINGS } from './paths.js'

const MARKER = '.bubi/status.json'
const BUSY = `mkdir -p ~/.bubi && printf '{"status":"busy","since":%s}' "$(date +%s000)" > ~/${MARKER}`
const IDLE = `mkdir -p ~/.bubi && printf '{"status":"idle","at":%s}' "$(date +%s000)" > ~/${MARKER}`
export const HOOK_EVENTS = { UserPromptSubmit: BUSY, Stop: IDLE, SessionEnd: IDLE } as const

const hookSchema = z.looseObject({ type: z.string().optional(), command: z.string().optional() })
const groupSchema = z.looseObject({ hooks: z.array(hookSchema).default([]) })
const settingsSchema = z.looseObject({ hooks: z.record(z.string(), z.array(groupSchema)).optional() })

type Settings = z.infer<typeof settingsSchema>
type Hook = z.infer<typeof hookSchema>

const isOurs = (hook: Hook): boolean => hook.command?.includes(MARKER) ?? false

function readSettings(file: string): Settings {
  if (!fs.existsSync(file)) return {}
  return settingsSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')))
}

function writeSettings(file: string, settings: Settings): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bubi-backup`)
  fs.writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`)
}

/** Removes our hook entries, dropping any groups or events left empty. */
export function stripHooks(settings: Settings): Settings {
  const hooks = { ...settings.hooks }
  for (const [event, groups] of Object.entries(hooks)) {
    const kept = groups
      .map(group => ({ ...group, hooks: group.hooks.filter(h => !isOurs(h)) }))
      .filter(group => group.hooks.length > 0)
    if (kept.length) hooks[event] = kept
    else delete hooks[event]
  }
  const { hooks: _drop, ...rest } = settings
  return Object.keys(hooks).length ? { ...rest, hooks } : rest
}

export function addHooks(settings: Settings): Settings {
  const stripped = stripHooks(settings)
  const hooks = { ...stripped.hooks }
  for (const [event, command] of Object.entries(HOOK_EVENTS)) {
    hooks[event] = [...(hooks[event] ?? []), { hooks: [{ type: 'command', command }] }]
  }
  return { ...stripped, hooks }
}

export function hooksInstalled(file: string = CLAUDE_SETTINGS): boolean {
  try {
    const hooks = readSettings(file).hooks ?? {}
    return Object.keys(HOOK_EVENTS).every(event => (hooks[event] ?? []).some(g => g.hooks.some(isOurs)))
  }
  catch {
    return false
  }
}

export function installHooks(file: string = CLAUDE_SETTINGS): void {
  writeSettings(file, addHooks(readSettings(file)))
}

export function uninstallHooks(file: string = CLAUDE_SETTINGS): void {
  writeSettings(file, stripHooks(readSettings(file)))
}
