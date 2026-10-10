import { describe, expect, it } from 'vitest'
import { formatElapsed, parseStatus } from '../electron/status'
import { buildTypeScript, escapeAppleScript } from '../electron/keystroke'

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
  it('escapes quotes and backslashes', () => {
    expect(escapeAppleScript('say "hi" \\ bye')).toBe('say \\"hi\\" \\\\ bye')
  })

  it('types words separately with real space key presses', () => {
    const script = buildTypeScript('You had one job', null)
    expect(script).toContain('keystroke "You"')
    expect(script).toContain('keystroke "job"')
    expect(script.match(/key code 49/g)).toHaveLength(3)
    expect(script).not.toContain('keystroke "You had')
  })

  it('only interrupts when asked', () => {
    expect(buildTypeScript('go', null)).not.toContain('key code 8')
    expect(buildTypeScript('go', 'ctrl-c')).toContain('key code 8 using {control down}')
    expect(buildTypeScript('go', 'escape')).toContain('key code 53')
  })
})
