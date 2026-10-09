// Hit reactions. By default the overlay synthesises a cartoon dog yelp; drop
// .wav/.mp3/.m4a/.aiff clips in ~/.bubi/whimpers to use your own instead.
import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { WHIMPERS_DIR } from './paths.js'

const CLIP_EXT = /\.(?:wav|mp3|m4a|aiff?|caf)$/i
const STREAK_MS = 1800
const MAX_STREAK = 6

let streak = 0
let lastHitAt = 0
let playing: ChildProcess | null = null

/** Registers a hit and returns how many rapid hits came before it (0 = first). */
export function hitStreak(): number {
  const now = Date.now()
  streak = now - lastHitAt < STREAK_MS ? Math.min(streak + 1, MAX_STREAK) : 0
  lastHitAt = now
  return streak
}

function customClips(): string[] {
  try {
    return fs.readdirSync(WHIMPERS_DIR).filter(f => CLIP_EXT.test(f)).map(f => path.join(WHIMPERS_DIR, f))
  }
  catch {
    return []
  }
}

/** Plays one of the user's clips, louder on a streak. False when there are none. */
export function playCustomClip(hitStreak: number): boolean {
  const clips = customClips()
  const clip = clips[Math.floor(Math.random() * clips.length)]
  if (!clip) return false
  if (playing) return true // never stack clips
  playing = spawn('afplay', ['-v', String(Math.min(0.35 + hitStreak * 0.13, 1)), clip])
  const done = (): void => {
    playing = null
  }
  playing.on('exit', done)
  playing.on('error', done)
  return true
}
