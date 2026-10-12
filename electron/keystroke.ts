// macOS keystroke automation via System Events (needs Accessibility access).
// We remember which app was frontmost when the whip came out and re-activate it
// before sending, so a click on the tray never sends keys into the void.
// Phrases are pasted rather than typed: synthetic per-key typing occasionally
// drops characters (spaces especially), a paste always lands whole.
import { execFile } from 'node:child_process'
import { clipboard, ClipboardItem } from 'electron'
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

const INTERRUPTS: Record<Config['interruptKey'], string> = {
  'ctrl-c': 'key code 8 using {control down}',
  'escape': 'key code 53',
}

/** Optional interrupt, then paste whatever is on the clipboard and press Enter. */
export function buildPasteScript(interrupt: Config['interruptKey'] | null): string {
  const lines = ['tell application "System Events"']
  if (interrupt) lines.push(`  ${INTERRUPTS[interrupt]}`, '  delay 0.3')
  lines.push('  keystroke "v" using {command down}', '  delay 0.25', '  key code 36', 'end tell')
  return lines.join('\n')
}

export interface SendOptions {
  interrupt: Config['interruptKey'] | null
  targetBundleId: string | null
}

/**
 * Sends `text` + Enter to the target app, optionally preceded by an interrupt
 * key. The user's clipboard is restored afterwards.
 */
export async function sendText(text: string, { interrupt, targetBundleId }: SendOptions): Promise<void> {
  const saved = await snapshotClipboard()
  await clipboard.writeText(text)
  try {
    await activate(targetBundleId)
    await run('osascript', ['-e', buildPasteScript(interrupt)])
  }
  finally {
    // Give the target app a moment to read the paste before putting things back.
    setTimeout(() => void restoreClipboard(saved), CLIPBOARD_RESTORE_MS)
  }
}

const CLIPBOARD_RESTORE_MS = 600

type ClipboardData = Record<string, Blob | string | Electron.ClipboardBookmark>

/** Copies every type of every clipboard item out, since read() items can't be written back as-is. */
async function snapshotClipboard(): Promise<ClipboardData[]> {
  try {
    const items = await clipboard.read()
    return await Promise.all(items.map(async (item) => {
      const data: ClipboardData = {}
      for (const type of item.types) data[type] = await item.getType(type)
      return data
    }))
  }
  catch {
    return []
  }
}

async function restoreClipboard(saved: ClipboardData[]): Promise<void> {
  try {
    if (saved.length) await clipboard.write(saved.map(data => new ClipboardItem(data)))
    else clipboard.clear()
  }
  catch (err) {
    console.warn('bubi: could not restore clipboard:', (err as Error).message)
  }
}
