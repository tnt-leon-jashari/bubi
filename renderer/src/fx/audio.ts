// Synthesised sounds — no audio assets to ship. Created lazily on first use.
let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null

export function audio(): { ctx: AudioContext, noise: AudioBuffer } {
  ctx ??= new AudioContext()
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  return { ctx, noise }
}

function envelope(ctx: AudioContext, peak: number, attack: number, decay: number): GainNode {
  const gain = ctx.createGain()
  const t = ctx.currentTime
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(peak, t + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  gain.connect(ctx.destination)
  return gain
}

/** A sharp supersonic snap: filtered noise burst plus a falling click. */
export function playCrack(power: number): void {
  const { ctx, noise: buffer } = audio()
  const volume = Math.min(0.9, 0.35 + power * 0.2)

  const src = ctx.createBufferSource()
  src.buffer = buffer
  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 2400 + Math.random() * 1200
  band.Q.value = 0.8
  src.connect(band).connect(envelope(ctx, volume, 0.001, 0.09))
  src.start()
  src.stop(ctx.currentTime + 0.15)

  const osc = ctx.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(1800, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + 0.04)
  osc.connect(envelope(ctx, volume * 0.6, 0.001, 0.05))
  osc.start()
  osc.stop(ctx.currentTime + 0.08)
}

/** A soft, warm thump for pats. */
export function playPat(): void {
  const { ctx } = audio()
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(220, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.12)
  osc.connect(envelope(ctx, 0.35, 0.005, 0.14))
  osc.start()
  osc.stop(ctx.currentTime + 0.2)
}

/** Airy whoosh for fast swings that don't quite crack. */
export function playWhoosh(power: number): void {
  const { ctx, noise: buffer } = audio()
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const low = ctx.createBiquadFilter()
  low.type = 'lowpass'
  low.frequency.setValueAtTime(400, ctx.currentTime)
  low.frequency.exponentialRampToValueAtTime(1600, ctx.currentTime + 0.12)
  src.connect(low).connect(envelope(ctx, Math.min(0.12, 0.04 + power * 0.05), 0.04, 0.16))
  src.start()
  src.stop(ctx.currentTime + 0.25)
}

