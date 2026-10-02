# AGENTS.md

Notes for coding agents working on this repo. See [README.md](README.md) for what the mod does and how to install it.

## What this is

A Claude Code mod (a plugin of function hooks) that draws a usage band above the prompt: 5-hour usage, weekly usage, and the 5-hour reset time. The repo root is a plugin marketplace named `usage`; the plugin itself lives in `usage-meter/`.

## Commands

```bash
claude plugin validate ./usage-meter
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test ./usage-meter
```

Run both after every change. Both must pass before committing.

On Windows with only the desktop app installed, `claude` is not on PATH; the bundled binary is under `%APPDATA%\Claude\claude-code\<version>\...\claude.exe` (the folder layout changes between versions, so find it rather than hard-coding it).

## Mod runtime rules

- The module runs in a sandbox with no DOM and no Node. Everything outside it goes through `$`. Plain JS built-ins (`Date`, `Math`, `JSON`) are available.
- Hooks are `($, e, next)`. Observe with `const r = await next(e); ...; return r`. Always call `next` unless deliberately answering for the engine.
- Element constructors come from `$.ui.resolve(e)`, never globals. `Box` and `Text` exist on every surface; check the surface's table before using anything else.
- A hot reload re-runs `register()` and `session.start`. Module-level variables reset; `$.state` survives. Keep anything a render needs in `$.state`.
- Writes to `$.state` redraw the `ui.render` hooks that read it. That is how the band updates; do not poll inside a render hook.

## API facts this mod depends on

These were confirmed against Claude Code 2.1.284–2.1.286. The authoritative declarations ship with the build: the `plugin-authoring` skill writes `claude-code.d.ts`, and `claude plugin validate` generates `usage-meter/.claude-plugin/types/` (git-ignored).

- `$.session.usage()` → `{ startedAt, context, rateLimits, cost }`. `rateLimits` is an array of `{ kind, percentUsed, resetsAt }`: `kind` is `"five_hour"`, `"seven_day"` or `"spend_limit"`, `percentUsed` is 0–100, `resetsAt` is an ISO string. It is empty until the first API response of the session, and always empty for API-key accounts.
- `session.measure` fires with `{ context, rateLimits, cost, changed }` when the numbers move.
- `$.clock`: `now()` (async, epoch ms), `sleep(ms)`, `after(ms, fn)`, `every(ms, fn)`.
- `AbovePrompt` is raised on the `terminal` and `desktop` surfaces only. Its props are `hasSurvey`, `isWorking`, `maxRows`, `bodyColumns`, `scroll`, `view`. Treat `bodyColumns` as possibly missing on desktop; the mod falls back to the full layout then.
- `$.ui.status` and `$.ui.toast` are dropped in a headless session (which is what the desktop app runs). Do not use them for anything the desktop user must see.

## Desktop app gotcha

The Code tab only starts sending draw requests for a plugin after it has picked the plugin up; after installing or updating, `/reload-plugins` is what makes the band appear. If the band is missing on desktop, check that before debugging the code.

## Conventions

- Plain ESM JavaScript in `hooks/usage-meter.mjs`; tests in TypeScript against `claude-code/testing`.
- Match the existing style: small top-level functions, constants at the top, short comments only where the reason is not obvious.
- Every `$.state` key the module uses must be declared in `usage-meter/types/index.d.ts`; `claude plugin validate` enforces it.
- Tests stub `session.usage` and `clock.now` and mount `AbovePrompt` on a named surface. Cover both `terminal` and `desktop` when the change affects layout.
- Bump `version` in `usage-meter/.claude-plugin/plugin.json` on any behavior change, or `claude plugin update` will not pick it up.
- Never commit `usage-meter/.claude-plugin/types/` (generated per build).
