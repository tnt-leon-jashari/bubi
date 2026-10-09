import type { MenuItemConstructorOptions, Rectangle } from 'electron'
import type { BannerKind, Mode, SpawnPayload } from '../shared/ipc.js'
import type { Config } from './config.js'
import fs from 'node:fs'
import path from 'node:path'
import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, screen, systemPreferences, Tray } from 'electron'
import { IPC, MODES } from '../shared/ipc.js'
import { INTERRUPT_KEYS, loadConfig, saveConfig } from './config.js'
import { hooksInstalled, installHooks, uninstallHooks } from './hooks.js'
import { frontmostBundleId, sendText } from './keystroke.js'
import { STATUS_FILE } from './paths.js'
import { randomKindPhrase, randomWhipPhrase } from './phrases.js'
import { captureFrames, selftestCursor } from './selftest.js'
import { formatElapsed, parseStatus } from './status.js'
import { yelp } from './whimpers.js'

const WHIP_SHORTCUT = 'Alt+Shift+W'
const PAT_SHORTCUT = 'Alt+Shift+P'
const THRESHOLD_CHOICES_MS = [10000, 20000, 30000, 60000, 120000] as const
const DONE_FLASH_MS = 4000
// A second Ctrl-C right after the first can quit an idle CLI agent, so typed
// strikes are rate limited no matter how fast the whip is swung.
const SEND_COOLDOWN_MS = 2000
const CURSOR_HZ = 120
// Slightly longer than the renderer's strike window, to cover IPC latency.
const STRIKE_PHRASE_TTL_MS = 2500
const ROOT = path.join(__dirname, '..', '..')
const SELFTEST_DIR = process.env.BUBI_SELFTEST
let selftestStart = 0
const selftestOrigin = (b: Rectangle): { x: number, y: number } => ({ x: b.x + b.width * 0.35, y: b.y + b.height * 0.4 })

const config: Config = loadConfig()

let tray: Tray | null = null
let overlay: BrowserWindow | null = null
let overlayReady = false
let overlayBounds: Rectangle | null = null
let pendingSpawn: SpawnPayload | null = null
let cursorTimer: NodeJS.Timeout | null = null
let targetBundleId: string | null = null
let lastSendAt = 0

let wasBusy = false
let doneUntil = 0
let autoTriggeredThisSpan = false

// ── Overlay window ───────────────────────────────────────────────────────────

function createOverlay(bounds: Rectangle): BrowserWindow {
  const win = new BrowserWindow({
    ...bounds,
    type: 'panel',
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    focusable: false,
    acceptFirstMouse: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    hasShadow: false,
    show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  overlayReady = false

  const devUrl = process.env.BUBI_DEV_URL
  const load = (): void => {
    if (devUrl) win.loadURL(devUrl).catch(() => setTimeout(load, 500)) // vite may still be booting
    else void win.loadFile(path.join(ROOT, 'dist-renderer', 'index.html'))
  }
  load()

  win.webContents.on('did-finish-load', () => {
    overlayReady = true
    if (pendingSpawn) {
      win.webContents.send(IPC.spawn, pendingSpawn)
      pendingSpawn = null
    }
  })
  win.on('closed', () => {
    overlay = null
    overlayReady = false
    stopCursorFeed()
  })
  return win
}

function isOut(): boolean {
  return !!overlay?.isVisible()
}

/** The overlay is never focused, so we feed it the cursor from here — this also works while the tray icon is held down. */
function startCursorFeed(): void {
  if (cursorTimer) return
  cursorTimer = setInterval(() => {
    if (!overlay || !isOut() || !overlayBounds) return
    if (SELFTEST_DIR) {
      overlay.webContents.send(IPC.cursor, selftestCursor(selftestStart, selftestOrigin(overlayBounds)))
      return
    }
    const p = screen.getCursorScreenPoint()
    overlay.webContents.send(IPC.cursor, { x: p.x - overlayBounds.x, y: p.y - overlayBounds.y })
  }, 1000 / CURSOR_HZ)
}

function stopCursorFeed(): void {
  if (cursorTimer) clearInterval(cursorTimer)
  cursorTimer = null
}

function showOverlay(mode: Mode, { fromLeft = false } = {}): void {
  if (overlay && isOut()) {
    overlay.webContents.send(IPC.setMode, mode)
    return
  }
  rememberMode(mode)
  // Capture the app being whipped before anything of ours could take focus.
  void frontmostBundleId().then((id) => {
    if (id && !id.startsWith('com.github.Electron') && id !== 'dev.bubi.app') targetBundleId = id
  })

  const real = screen.getCursorScreenPoint()
  const bounds = screen.getDisplayNearestPoint(real).bounds
  const cursor = SELFTEST_DIR ? selftestOrigin(bounds) : real
  overlayBounds = bounds
  overlay ??= createOverlay(bounds)
  overlay.setBounds(bounds)
  overlay.showInactive()
  startCursorFeed()

  const spawn: SpawnPayload = { mode, fromLeft, cursor: { x: cursor.x - bounds.x, y: cursor.y - bounds.y } }
  if (overlayReady) overlay.webContents.send(IPC.spawn, spawn)
  else pendingSpawn = spawn
}

function dropOverlay(): void {
  if (overlay && isOut()) overlay.webContents.send(IPC.drop)
}

function toggleOverlay(mode: Mode = config.lastMode): void {
  if (isOut()) dropOverlay()
  else showOverlay(mode)
}

function rememberMode(mode: Mode): void {
  if (mode !== config.lastMode) setConfig({ lastMode: mode })
}

// ── Typing into the agent ───────────────────────────────────────────────────

function banner(text: string, kind: BannerKind, note?: string): void {
  overlay?.webContents.send(IPC.banner, { text, kind, note })
}

function ensureAccessibility(): boolean {
  if (systemPreferences.isTrustedAccessibilityClient(false)) return true
  systemPreferences.isTrustedAccessibilityClient(true) // opens the system prompt
  banner('Allow Bubi in Settings → Privacy & Security → Accessibility', 'warn')
  return false
}

async function typeIntoAgent(phrase: string, interrupt: boolean): Promise<void> {
  const now = Date.now()
  if (now - lastSendAt < SEND_COOLDOWN_MS || !ensureAccessibility()) return
  lastSendAt = now
  try {
    await sendText(phrase, { interrupt: interrupt ? config.interruptKey : null, targetBundleId })
  }
  catch (err) {
    console.warn('bubi: typing failed:', (err as Error).message)
    banner('Could not type — check Accessibility access', 'warn')
  }
}

// ── IPC from the overlay ─────────────────────────────────────────────────────

ipcMain.on(IPC.hidden, () => {
  overlay?.hide()
  stopCursorFeed()
})
ipcMain.on(IPC.modeChanged, (_e, mode: unknown) => rememberMode(mode === MODES.pat ? MODES.pat : MODES.whip))

// A crack is free: sparks, a yelp and a banner, but nothing is typed.
// The phrase it shows is what a following strike sends.
let crackPhrase: { text: string, at: number } | null = null

ipcMain.on(IPC.crack, () => {
  crackPhrase = { text: randomWhipPhrase(), at: Date.now() }
  banner(crackPhrase.text, 'whip', 'click to send ↵')
  if (config.voice) yelp()
})

// A strike (click while the crack phrase is up) is what actually interrupts.
ipcMain.on(IPC.strike, () => {
  const fresh = crackPhrase && Date.now() - crackPhrase.at < STRIKE_PHRASE_TTL_MS
  const phrase = fresh && crackPhrase ? crackPhrase.text : randomWhipPhrase()
  crackPhrase = null
  banner(phrase, 'whip', 'sent ✓')
  void typeIntoAgent(phrase, true)
})

ipcMain.on(IPC.pat, () => {
  const phrase = randomKindPhrase()
  banner(phrase, 'pat', 'sent ✓')
  void typeIntoAgent(phrase, false)
})

// ── Agent status (Claude Code hooks → ~/.bubi/status.json) ─────────────────

function pollStatus(): void {
  fs.readFile(STATUS_FILE, 'utf8', (err, data) => {
    const status = err ? { status: 'idle' as const } : parseStatus(data)
    if (!status) return // caught mid-write; try again next tick
    const now = Date.now()

    if (status.status === 'busy') {
      wasBusy = true
      const elapsed = formatElapsed(now - status.since)
      tray?.setTitle(` ${elapsed}`, { fontType: 'monospacedDigit' })
      tray?.setToolTip(`Bubi — agent busy for ${elapsed}`)

      if (!config.autoTrigger || autoTriggeredThisSpan || now - status.since < config.slowThresholdMs) return
      autoTriggeredThisSpan = true
      if (!isOut()) showOverlay(MODES.whip, { fromLeft: true })
      return
    }

    if (wasBusy) {
      wasBusy = false
      doneUntil = now + DONE_FLASH_MS
    }
    autoTriggeredThisSpan = false
    tray?.setTitle(now < doneUntil ? ' ✓ done' : '')
    if (now >= doneUntil) tray?.setToolTip(DEFAULT_TOOLTIP)
  })
}

// ── Tray ─────────────────────────────────────────────────────────────────────

const DEFAULT_TOOLTIP = `Bubi — hold to whip · ${WHIP_SHORTCUT} / ${PAT_SHORTCUT} · right-click for settings`

function setConfig(changes: Partial<Config>): void {
  Object.assign(config, changes)
  saveConfig(changes)
}

function formatThreshold(ms: number): string {
  return ms < 60000 ? `${ms / 1000} seconds` : `${ms / 60000} minute${ms > 60000 ? 's' : ''}`
}

function toggleHooks(installed: boolean): void {
  try {
    if (installed) uninstallHooks()
    else installHooks()
  }
  catch (err) {
    console.warn('bubi: hook install failed:', (err as Error).message)
  }
}

function buildTrayMenu(): Menu {
  const installed = hooksInstalled()
  const template: MenuItemConstructorOptions[] = [
    { label: 'Whip', accelerator: WHIP_SHORTCUT, click: () => toggleOverlay(MODES.whip) },
    { label: 'Pat on the shoulder', accelerator: PAT_SHORTCUT, click: () => toggleOverlay(MODES.pat) },
    { type: 'separator' },
    {
      label: 'Auto-whip slow agents',
      type: 'checkbox',
      checked: config.autoTrigger,
      click: item => setConfig({ autoTrigger: item.checked }),
    },
    {
      label: 'Slow after',
      enabled: config.autoTrigger,
      submenu: THRESHOLD_CHOICES_MS.map(ms => ({
        label: formatThreshold(ms),
        type: 'radio' as const,
        checked: config.slowThresholdMs === ms,
        click: () => setConfig({ slowThresholdMs: ms }),
      })),
    },
    {
      label: 'Interrupt with',
      submenu: [
        { label: 'Ctrl-C', type: 'radio', checked: config.interruptKey === INTERRUPT_KEYS.ctrlC, click: () => setConfig({ interruptKey: INTERRUPT_KEYS.ctrlC }) },
        { label: 'Esc (gentler for Claude Code)', type: 'radio', checked: config.interruptKey === INTERRUPT_KEYS.escape, click: () => setConfig({ interruptKey: INTERRUPT_KEYS.escape }) },
      ],
    },
    { label: 'Agent yelps', type: 'checkbox', checked: config.voice, click: item => setConfig({ voice: item.checked }) },
    { type: 'separator' },
    {
      label: installed ? 'Remove Claude Code hooks' : 'Install Claude Code hooks',
      toolTip: 'Writes ~/.bubi/status.json when a prompt starts and stops',
      click: () => toggleHooks(installed),
    },
    {
      label: 'Open at login',
      type: 'checkbox',
      visible: app.isPackaged,
      checked: app.getLoginItemSettings().openAtLogin,
      click: item => app.setLoginItemSettings({ openAtLogin: item.checked }),
    },
    { type: 'separator' },
    { label: 'Quit Bubi', role: 'quit' },
  ]
  return Menu.buildFromTemplate(template)
}

function loadTrayIcon(): Electron.NativeImage {
  const file = path.join(ROOT, 'icon', 'TrayTemplate.png')
  if (!fs.existsSync(file)) return nativeImage.createEmpty()
  const img = nativeImage.createFromPath(file) // picks up TrayTemplate@2x.png automatically
  img.setTemplateImage(true)
  return img
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

function modeFromArgv(argv: string[]): Mode | null {
  if (argv.includes(MODES.pat)) return MODES.pat
  if (argv.includes(MODES.whip)) return MODES.whip
  return null
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
}
else {
  app.on('second-instance', (_e, argv) => toggleOverlay(modeFromArgv(argv) ?? config.lastMode))

  void app.whenReady().then(() => {
    app.dock?.hide() // menu-bar only
    systemPreferences.isTrustedAccessibilityClient(true)

    tray = new Tray(loadTrayIcon())
    tray.setToolTip(DEFAULT_TOOLTIP)
    // Press-and-hold: the whip appears on mouse-down and drops when you let go.
    tray.on('mouse-down', () => showOverlay(MODES.whip))
    tray.on('mouse-up', () => dropOverlay())
    tray.on('right-click', () => tray?.popUpContextMenu(buildTrayMenu()))

    const shortcuts: [string, Mode][] = [[WHIP_SHORTCUT, MODES.whip], [PAT_SHORTCUT, MODES.pat]]
    for (const [accelerator, mode] of shortcuts) {
      if (!globalShortcut.register(accelerator, () => toggleOverlay(mode))) console.warn(`bubi: could not register ${accelerator}`)
    }

    // Warm the overlay up so the first summon is instant.
    overlayBounds = screen.getPrimaryDisplay().bounds
    overlay = createOverlay(overlayBounds)

    if (SELFTEST_DIR) {
      selftestStart = Date.now() + 400
      setTimeout(() => overlay && captureFrames(overlay, SELFTEST_DIR, [1000, 1500, 1560, 1620, 1700, 1850, 2300]), 400)
    }

    const launchMode = modeFromArgv(process.argv)
    if (launchMode) setTimeout(() => showOverlay(launchMode), 400)

    setInterval(pollStatus, 1000)
  })

  app.on('window-all-closed', () => {}) // stay alive in the menu bar
  app.on('will-quit', () => globalShortcut.unregisterAll())
}
