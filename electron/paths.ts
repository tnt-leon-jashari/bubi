import os from 'node:os'
import path from 'node:path'

export const HOME_DIR = path.join(os.homedir(), '.bubi')
export const STATUS_FILE = path.join(HOME_DIR, 'status.json')
export const CONFIG_FILE = path.join(HOME_DIR, 'config.json')
export const CLAUDE_SETTINGS = path.join(os.homedir(), '.claude', 'settings.json')
