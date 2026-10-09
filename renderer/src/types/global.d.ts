import type { BubiBridge, LabBridge } from '../../../shared/ipc'

declare global {
  interface Window {
    bubi: BubiBridge
    /** Only present in the sound lab window. */
    bubiLab?: LabBridge
  }
}

export {}
