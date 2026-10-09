# Bubi

A menu-bar whip for your terminal. Hold the tray icon and a physics-simulated
whip appears on your cursor. Crack it, click on the crack, and Bubi sends an
interrupt plus a "motivational" phrase to whatever app you were in. That's
usually the terminal running Claude Code (or any CLI agent) that has been
thinking for way too long. Feeling kinder? Pat mode sends encouragement instead.

Wire up the Claude Code hooks and Bubi also shows how long the agent has been
busy right in the menu bar. If a prompt runs slow, the whip slides in on its own.

## Features

- **Real whip physics.** A 36-point verlet rope with a rigid handle, tapered
  mass and bend limits. A loop travels down the lash and the light tip goes
  supersonic, so it cracks like an actual whip.
- **Crack vs. strike.** A fast flick cracks (sparks, shockwave, snap sound,
  the agent yelps) and shows a phrase, but never types anything. Clicking
  while that phrase is on screen is a **strike**: it sends the interrupt and
  types that exact phrase.
- **Interrupt key of your choice.** `Ctrl-C` (works for any CLI) or `Esc`
  (gentler for Claude Code, since it never quits the session). Typed strikes
  are rate limited to one every 2s so a double `Ctrl-C` can't exit your agent.
- **Pat mode.** A hand follows the cursor. Clicks pat (hearts and a soft
  thump) and type a kind word plus Enter, with no interrupt.
- **Agent status in the menu bar.** Shows the busy time (`23s`) next to the icon while Claude is busy and
  `✓ done` when it finishes.
- **Auto-whip.** After a configurable slow threshold, the whip slides in from
  the left without you touching anything.
- **Menu-bar only.** No Dock icon, no Cmd+Tab entry, no windows.
- **No assets.** Sounds are synthesised with WebAudio, yelps are a synthesised cartoon dog
  (or your own clips), and icons are generated from code.

## Install

### Download

Grab the `.dmg` from [Releases](../../releases) (`arm64` for Apple Silicon,
the other one for Intel). Drag **Bubi** to Applications.

The build is unsigned, so macOS will say it is damaged. Click **Cancel**,
then run:

```bash
xattr -cr /Applications/Bubi.app
```

The first strike asks for Accessibility access. Enable **Bubi** under
**System Settings → Privacy & Security → Accessibility**, or it can crack but
can't type.

### From source

Requires Node 24+.

```bash
git clone git@github.com:tnt-leon-jashari/bubi.git
cd bubi
npm install
npm start
```

`npm install -g .` also gives you the `bubi` command (`bubi`, `bubi whip`,
`bubi pat`, `bubi install-hooks`, `bubi uninstall-hooks`).

When you run from source, macOS attributes Accessibility to **Electron**, so
enable that one instead.

## Controls

| Action | How |
|---|---|
| Summon the whip | Press **and hold** the tray icon (it drops when you let go), or `⌥⇧W` |
| Summon pat mode | `⌥⇧P`, or the tray menu |
| Crack | Flick the mouse fast |
| Strike (types into the agent) | After a crack, click while its phrase is on screen (~1.8s) — that exact phrase is sent |
| Pat | Click in pat mode |
| Switch whip ↔ pat | Scroll wheel or middle-click |
| Put it away | Right-click (pat mode waves goodbye) |
| Settings | Right-click the tray icon |

## Auto-trigger and status

Bubi polls `~/.bubi/status.json` once a second. Two shapes are understood:

```json
{ "status": "busy", "since": 1760000000000 }
{ "status": "idle" }
```

For Claude Code, pick **Install Claude Code hooks** from the tray menu, or run
`bubi install-hooks`. Either one merges `UserPromptSubmit`, `Stop` and
`SessionEnd` hooks into `~/.claude/settings.json`. Your existing hooks are
kept, a backup goes to `settings.json.bubi-backup`, and it's safe to re-run.
Restart Claude Code afterwards.

Any other agent can write the same file from its own start and finish hooks.

### Settings (tray right-click)

- **Auto-whip slow agents**, with **Slow after** set to 10s, 20s (default),
  30s, 1 min or 2 min
- **Interrupt with**: `Ctrl-C` or `Esc`
- **Agent yelps** and **Hit sound**: the reaction on every crack. Pick one of 8
  presets (squeaky toy, arcade combo, cartoon bonk, big punch, puppy, cat,
  robot, laser). Each escalates as you hit faster. **Open sound lab…**
  (or `bubi lab`) lets you audition them all on hit pads Drop your own
  `.wav/.mp3/.m4a/.aiff` clips in `~/.bubi/whimpers/` to replace the voice
- **Open at login** (installed app only)

Settings are saved to `~/.bubi/config.json`. These env vars override them:

| Variable | Effect |
|---|---|
| `BUBI_SLOW_THRESHOLD_MS` | Busy time before the whip auto-spawns |
| `BUBI_DISABLE_AUTOTRIGGER=1` | Never auto-spawn. Use this while developing Bubi, because the overlay captures real clicks |

## Stack

Built the way TENTON frontends are built:
**Vue 3.5** (`<script setup lang="ts">`), **TypeScript strict**, **Pinia**
setup stores, **VueUse**, **Tailwind CSS v4** (CSS-first `@theme`), **Zod**
for every file Bubi reads, and **Vitest**. The one new piece is
**Electron**, because a menu-bar app needs it. Vite builds the renderer;
there's no Nuxt, since the whole UI is a single transparent overlay page.

```
electron/            Main process (TypeScript, compiled with tsc)
  main.ts              Tray, overlay window, cursor feed, status polling
  preload.ts           contextBridge → window.bubi
  keystroke.ts         AppleScript typing + refocusing the target app
  hooks.ts             Claude Code hook install/uninstall (merge-safe)
  config.ts, status.ts Zod-validated ~/.bubi files
  whimpers.ts          Hit streaks + custom yelp clips (afplay)
  selftest.ts          Dev-only scripted flick + frame capture
shared/ipc.ts        IPC channel names and payload types
renderer/src/        Overlay UI (Vue + Pinia + Tailwind)
  physics/rope.ts      Verlet whip simulation (pure TS, unit-tested)
  composables/useOverlayEngine.ts  Fixed-step loop, input, crack/strike logic
  fx/                  Particles and synthesised audio
  render/              Canvas drawing for whip, hand and FX
  components/          Banner, pat counter, controls hint
  stores/overlay.ts    HUD state
tests/               Vitest: physics calibration, hooks merge, status parsing
scripts/make-icons.mjs  Generates tray and app icons from SDF shapes
```

## Development

```bash
npm run dev         # vite + tsc --watch + electron (renderer hot-reloads)
npm test            # vitest
npm run typecheck   # tsc + vue-tsc
npm run icons       # regenerate icon/ (takes about 45s)
npm run dist        # unsigned .dmg + .zip in release/
```

Physics constants in `renderer/src/physics/rope.ts` are calibrated by
`tests/rope.test.ts`: still and steady swings stay under the crack threshold,
and real flicks cross it. Re-run the tests after tuning.

To check rendering without your real mouse:

```bash
BUBI_DISABLE_AUTOTRIGGER=1 BUBI_SELFTEST=/tmp/bubi-frames npm start -- whip
```

This replays a scripted flick and saves overlay frames as PNGs. It never types.

Releases: push a `vX.Y.Z` tag and CI builds both Mac architectures and
attaches them to a GitHub Release.

## Credits

The idea comes from [PannTechFlow/wrangler](https://github.com/PannTechFlow/wrangler)
and [OpenWhip](https://github.com/GitFrog1111/OpenWhip). Bubi is an independent
rewrite with its own code, sounds and icons.

MIT. See [LICENSE](LICENSE).
