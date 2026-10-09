import { contextBridge, ipcRenderer } from 'electron'
import type { BannerPayload, BubiBridge, HitSoundId, LabBridge, Mode, Point, SpawnPayload, YelpPayload } from '../shared/ipc.js'

// Channel names are inlined: sandboxed preloads cannot require local modules.
function listen<T>(channel: string): (fn: (payload: T) => void) => void {
  return fn => ipcRenderer.on(channel, (_e, payload: T) => fn(payload))
}

const bridge: BubiBridge = {
  onSpawn: listen<SpawnPayload>('spawn'),
  onDrop: fn => ipcRenderer.on('drop', () => fn()),
  onCursor: listen<Point>('cursor'),
  onBanner: listen<BannerPayload>('banner'),
  onSetMode: listen<Mode>('set-mode'),
  onYelp: listen<YelpPayload>('yelp'),
  crack: () => ipcRenderer.send('crack'),
  strike: () => ipcRenderer.send('strike'),
  pat: () => ipcRenderer.send('pat'),
  modeChanged: mode => ipcRenderer.send('mode-changed', mode),
  hidden: () => ipcRenderer.send('hidden'),
}

const lab: LabBridge = {
  getHitSound: () => ipcRenderer.invoke('get-hit-sound') as Promise<HitSoundId>,
  setHitSound: id => ipcRenderer.send('set-hit-sound', id),
}

contextBridge.exposeInMainWorld('bubi', bridge)
contextBridge.exposeInMainWorld('bubiLab', lab)
