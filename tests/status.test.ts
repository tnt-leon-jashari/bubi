import { describe, expect, it } from 'vitest'
import { formatElapsed, parseStatus } from '../electron/status'
import { buildPasteScript } from '../electron/keystroke'

describe('status file', () => {
  it('parses busy and idle', () => {
    expect(parseStatus('{"status":"busy","since":1700000000000}')).toEqual({ status: 'busy', since: 1700000000000 })
    expect(parseStatus('{"status":"idle"}')).toEqual({ status: 'idle' })
  })

  it('rejects partial writes and unknown shapes', () => {
    expect(parseStatus('{"status":"bu')).toBeNull()
    expect(parseStatus('{"status":"busy"}')).toBeNull()
    expect(parseStatus('{"status":"weird"}')).toBeNull()
  })

  it('formats elapsed time for the menu bar', () => {
    expect(formatElapsed(4_400)).toBe('4s')
    expect(formatElapsed(95_000)).toBe('1m35s')
  })
})

describe('applescript', () => {
  it('pastes then presses Enter', () => {
    const script = buildPasteScript(null)
    expect(script).toContain('keystroke "v" using {command down}')
    expect(script.indexOf('command down')).toBeLessThan(script.indexOf('key code 36'))
  })

  it('only interrupts when asked', () => {
    expect(buildPasteScript(null)).not.toContain('key code 8')
    expect(buildPasteScript('ctrl-c')).toContain('key code 8 using {control down}')
    expect(buildPasteScript('escape')).toContain('key code 53')
  })
})
