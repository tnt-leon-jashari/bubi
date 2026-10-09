#!/usr/bin/env node
'use strict'
// bubi [whip|pat]         launch the menu-bar app (or toggle it if already running)
// bubi install-hooks      wire Claude Code up to the auto-trigger
// bubi uninstall-hooks    remove them again
const fs = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')

const root = path.join(__dirname, '..')
const cmd = process.argv[2]

if (!fs.existsSync(path.join(root, 'dist-electron', 'electron', 'main.js')) || !fs.existsSync(path.join(root, 'dist-renderer', 'index.html'))) {
  console.error(`bubi: not built yet — run \`npm run build\` in ${root}`)
  process.exit(1)
}

if (cmd === 'install-hooks' || cmd === 'uninstall-hooks') {
  const hooks = require('../dist-electron/electron/hooks.js')
  const { CLAUDE_SETTINGS } = require('../dist-electron/electron/paths.js')
  if (cmd === 'install-hooks') hooks.installHooks()
  else hooks.uninstallHooks()
  console.log(`bubi: ${cmd === 'install-hooks' ? 'installed' : 'removed'} hooks in ${CLAUDE_SETTINGS} (backup: settings.json.bubi-backup)`)
  console.log('bubi: restart Claude Code to pick them up.')
  process.exit(0)
}

if (cmd && !['whip', 'pat', 'lab'].includes(cmd)) {
  console.log('usage: bubi [whip|pat|lab|install-hooks|uninstall-hooks]')
  process.exit(1)
}

const electron = require('electron')
spawn(electron, [root, ...(cmd ? [cmd] : [])], { detached: true, stdio: 'ignore' }).unref()
