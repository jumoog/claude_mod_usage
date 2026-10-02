# usage-meter

A [Claude Code mod](https://claude.dev/blog/getting-started-with-claude-code-mods/) that always shows your plan usage above the prompt: the 5-hour window, the weekly window, and when the 5-hour window resets.

```
5h ███░░░░░░░ 34% · resets 15:30 (in 1h 30m)   │  week ██░░░░░░░░ 18%
```

- **5h** and **week** each get a bar and a percentage, green below 50%, yellow from 50%, red from 80%. The empty part of the bar is dimmed.
- **resets** is the local time the 5-hour window resets, with a countdown that refreshes every 30 seconds.
- Under 70 columns it compacts to `5h 34% · ↻ 15:30 │ week 18%`.
- Until the first response of a session it shows `usage: waiting for the first response…`, since the numbers arrive with each response.

It works in the terminal and in the Claude desktop app's Code tab.

## Requirements

- A Claude Code build with mods (function hooks). Mods are early access: set `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1` in the environment Claude Code starts in, unless your account already has them on.
- A Claude subscription plan. The 5-hour and weekly limits come from the response headers of plan accounts; with an API key there is nothing to show.

## Install

Turn mods on. On Windows, as a user environment variable (then fully restart the desktop app or your terminal):

```powershell
[Environment]::SetEnvironmentVariable("CLAUDE_CODE_ENABLE_FUNCTION_HOOKS", "1", "User")
```

On macOS or Linux, in your shell profile:

```bash
export CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1
```

Then, inside Claude Code:

```
/plugin marketplace add jumoog/claude_mod_usage
/plugin install usage-meter@usage
/reload-plugins
```

In the desktop app, if the band does not appear after a restart, run `/reload-plugins` once more: the Code tab only starts drawing mod UI once it has picked up the plugin.

## Try it without installing

```bash
git clone git@github.com:jumoog/claude_mod_usage.git
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir ./claude_mod_usage/usage-meter
```

## How it works

The whole mod is [`usage-meter/hooks/usage-meter.mjs`](usage-meter/hooks/usage-meter.mjs).

- `$.session.usage()` returns `rateLimits`, a list of `{ kind, percentUsed, resetsAt }`. The mod keeps `five_hour` and `seven_day`.
- It refreshes on `session.start`, after every main-agent `turn.complete`, on `session.measure` (raised when the rate-limit headers move the numbers), and every 30 seconds via `$.clock.every` so the countdown stays current.
- Each refresh saves a snapshot to `$.state`. A `ui.render` hook on the `AbovePrompt` component reads it and draws the band, so every save redraws it.

## Development

```bash
claude plugin validate ./usage-meter
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test ./usage-meter
```

After changing the mod, bump `version` in [`usage-meter/.claude-plugin/plugin.json`](usage-meter/.claude-plugin/plugin.json), then:

```
claude plugin update usage-meter@usage
/reload-plugins
```

## Layout

```
.claude-plugin/marketplace.json     marketplace "usage", listing the one plugin
usage-meter/
  .claude-plugin/plugin.json        plugin manifest
  hooks/hooks.json                  names the hooks module
  hooks/usage-meter.mjs             the mod
  types/index.d.ts                  $.state contract
  tests/usage-meter.test.ts         claude plugin test suite
```
