import type { BubiBridge } from '../../../shared/ipc'

declare global {
  interface Window {
    bubi: BubiBridge
  }
}

export {}
