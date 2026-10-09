export const MODES = { whip: 'whip', pat: 'pat' } as const
export type Mode = (typeof MODES)[keyof typeof MODES]

export interface Point {
  x: number
  y: number
}

export interface SpawnPayload {
  mode: Mode
  fromLeft: boolean
  cursor: Point
}

export type BannerKind = 'whip' | 'pat' | 'warn'

export interface BannerPayload {
  text: string
  kind: BannerKind
}

/** The bridge exposed on `window.bubi` by the preload script. */
export interface BubiBridge {
  onSpawn: (fn: (payload: SpawnPayload) => void) => void
  onDrop: (fn: () => void) => void
  onCursor: (fn: (point: Point) => void) => void
  onBanner: (fn: (payload: BannerPayload) => void) => void
  onSetMode: (fn: (mode: Mode) => void) => void
  crack: () => void
  strike: () => void
  pat: () => void
  modeChanged: (mode: Mode) => void
  hidden: () => void
}

export const IPC = {
  spawn: 'spawn',
  drop: 'drop',
  cursor: 'cursor',
  banner: 'banner',
  setMode: 'set-mode',
  crack: 'crack',
  strike: 'strike',
  pat: 'pat',
  modeChanged: 'mode-changed',
  hidden: 'hidden',
} as const
