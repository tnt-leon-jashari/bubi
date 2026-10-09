import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addHooks, HOOK_EVENTS, hooksInstalled, installHooks, stripHooks, uninstallHooks } from '../electron/hooks'

const userHook = { type: 'command', command: 'echo mine' }

describe('claude code hooks', () => {
  let dir: string
  let file: string

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bubi-hooks-'))
    file = path.join(dir, 'settings.json')
  })

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  it('adds one entry per event and is idempotent', () => {
    const once = addHooks({})
    const twice = addHooks(once)
    expect(twice).toEqual(once)
    for (const event of Object.keys(HOOK_EVENTS)) expect(twice.hooks?.[event]).toHaveLength(1)
  })

  it('keeps the user\'s own hooks and settings', () => {
    const settings = { model: 'opus', hooks: { Stop: [{ hooks: [userHook] }] } }
    const installed = addHooks(settings)
    expect(installed.model).toBe('opus')
    expect(installed.hooks?.Stop).toHaveLength(2)
    expect(stripHooks(installed)).toEqual(settings)
  })

  it('drops the hooks key entirely when only ours were there', () => {
    expect(stripHooks(addHooks({ theme: 'dark' }))).toEqual({ theme: 'dark' })
  })

  it('installs to disk with a backup and uninstalls cleanly', () => {
    fs.writeFileSync(file, JSON.stringify({ hooks: { Stop: [{ hooks: [userHook] }] } }))
    expect(hooksInstalled(file)).toBe(false)
    installHooks(file)
    expect(hooksInstalled(file)).toBe(true)
    expect(fs.existsSync(`${file}.bubi-backup`)).toBe(true)
    uninstallHooks(file)
    expect(hooksInstalled(file)).toBe(false)
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({ hooks: { Stop: [{ hooks: [userHook] }] } })
  })

  it('writes valid status JSON from the hook commands', () => {
    const status = path.join(dir, 'status.json')
    for (const command of [HOOK_EVENTS.UserPromptSubmit, HOOK_EVENTS.Stop]) {
      const local = command.replaceAll('~/.bubi', dir)
      execSync(local, { shell: '/bin/sh' })
      expect(() => JSON.parse(fs.readFileSync(status, 'utf8'))).not.toThrow()
    }
  })
})
