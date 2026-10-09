// macOS keystroke automation via System Events (needs Accessibility access).
// We remember which app was frontmost when the whip came out and re-activate it
// before typing, so a click on the tray never sends keys into the void.
import { execFile } from 'node:child_process'
import type { Config } from './config.js'

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 5000 }, (err, stdout) => (err ? reject(err) : resolve(stdout.trim())))
  })
}

const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms))

/** Bundle id of the frontmost app, via lsappinfo (needs no permissions). */
export async function frontmostBundleId(): Promise<string | null> {
  try {
    const asn = await run('lsappinfo', ['front'])
    const info = await run('lsappinfo', ['info', '-only', 'bundleid', asn])
    return info.match(/"CFBundleIdentifier"="([^"]+)"/)?.[1] ?? null
  }
  catch {
    return null
  }
}

async function activate(bundleId: string | null): Promise<void> {
  if (!bundleId || (await frontmostBundleId()) === bundleId) return
  await run('open', ['-b', bundleId]).catch(() => undefined)
  await sleep(180)
}

export function escapeAppleScript(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

const INTERRUPTS: Record<Config['interruptKey'], string> = {
  'ctrl-c': 'key code 8 using {control down}',
  'escape': 'key code 53',
}

export function buildTypeScript(text: string, interrupt: Config['interruptKey'] | null): string {
  const lines = ['tell application "System Events"']
  if (interrupt) lines.push(`  ${INTERRUPTS[interrupt]}`, '  delay 0.3')
  lines.push(`  keystroke "${escapeAppleScript(text)}"`, '  delay 0.2', '  key code 36', 'end tell')
  return lines.join('\n')
}

export interface SendOptions {
  interrupt: Config['interruptKey'] | null
  targetBundleId: string | null
}

/** Types `text` + Enter into the target app, optionally preceded by an interrupt key. */
export async function sendText(text: string, { interrupt, targetBundleId }: SendOptions): Promise<void> {
  await activate(targetBundleId)
  await run('osascript', ['-e', buildTypeScript(text, interrupt)])
}
