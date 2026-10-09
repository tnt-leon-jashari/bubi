export const MODES = { whip: 'whip', pat: 'pat' } as const
export type Mode = (typeof MODES)[keyof typeof MODES]

/** Hit reaction presets; the recipes live in renderer/src/fx/hitSounds.ts. */
export const HIT_SOUND_IDS = ['squeaky', 'arcade', 'bonk', 'punch', 'puppy', 'cat', 'robot', 'laser'] as const
export type HitSoundId = (typeof HIT_SOUND_IDS)[number]

export interface YelpPayload {
  sound: HitSoundId
  /** Rapid hits before this one (0 = first); sounds escalate with it. */
  streak: number
}

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
  onYelp: (fn: (payload: YelpPayload) => void) => void
  crack: () => void
  strike: () => void
  pat: () => void
  modeChanged: (mode: Mode) => void
  hidden: () => void
}

/** Exposed as `window.bubiLab` for the sound lab window. */
export interface LabBridge {
  getHitSound: () => Promise<HitSoundId>
  setHitSound: (id: HitSoundId) => void
}

export const IPC = {
  spawn: 'spawn',
  drop: 'drop',
  cursor: 'cursor',
  banner: 'banner',
  setMode: 'set-mode',
  yelp: 'yelp',
  getHitSound: 'get-hit-sound',
  setHitSound: 'set-hit-sound',
  crack: 'crack',
  strike: 'strike',
  pat: 'pat',
  modeChanged: 'mode-changed',
  hidden: 'hidden',
} as const
