// The agent yelps when hit; rapid hits escalate volume and panic.
// Drop .wav/.mp3/.m4a/.aiff clips in ~/.bubi/whimpers to replace the voice.
import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { WHIMPERS_DIR } from './paths.js'
import { randomYelp } from './phrases.js'

const CLIP_EXT = /\.(?:wav|mp3|m4a|aiff?|caf)$/i
const STREAK_MS = 1800
const MAX_STREAK = 6

let streak = 0
let lastHitAt = 0
let playing: ChildProcess | null = null

function customClips(): string[] {
  try {
    return fs.readdirSync(WHIMPERS_DIR).filter(f => CLIP_EXT.test(f)).map(f => path.join(WHIMPERS_DIR, f))
  }
  catch {
    return []
  }
}

export function yelp(): void {
  const now = Date.now()
  streak = now - lastHitAt < STREAK_MS ? Math.min(streak + 1, MAX_STREAK) : 0
  lastHitAt = now
  if (playing) return // never stack voices

  const volume = Math.min(0.35 + streak * 0.13, 1)
  const clips = customClips()
  const clip = clips[Math.floor(Math.random() * clips.length)]
  playing = clip
    ? spawn('afplay', ['-v', String(volume), clip])
    : spawn('say', ['-r', String(210 + streak * 25), `[[volm ${volume.toFixed(2)}]] [[pbas ${48 + streak * 4}]] ${randomYelp()}`])

  const done = (): void => {
    playing = null
  }
  playing.on('exit', done)
  playing.on('error', done)
}
