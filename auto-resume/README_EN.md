# auto-resume

[中文](README.md)

Auto-resume Claude Code after rate-limit or API error interruptions.

When Claude Code hits a `StopFailure` (rate limit, server error, etc.), this skill automatically injects a "continue" prompt into the terminal after a configurable delay, so work resumes without manual intervention.

## Quick Start

```
/auto-resume setup    # Register the hook (requires restart)
/auto-resume on       # Enable auto-resume
```

## Commands

| Command | Description |
|---------|-------------|
| `/auto-resume setup` | Register StopFailure hook in settings.json (requires restart) |
| `/auto-resume on` | Enable auto-resume (no restart needed) |
| `/auto-resume off` | Disable auto-resume (no restart needed) |
| `/auto-resume` | Show current status and configuration |
| `/auto-resume config <key> <value>` | Update configuration |

## Configuration

Default config stored in `~/.claude/auto-resume/config.json`:

| Key | Default | Description |
|-----|---------|-------------|
| `delaySeconds` | 30 | Wait time before injecting prompt |
| `prompt` | 继续 | Text to inject into terminal |
| `maxRetries` | 3 | Max consecutive auto-resumes |
| `retryCooldownSeconds` | 60 | Min time between auto-resumes |

Example:

```
/auto-resume config delaySeconds 60
/auto-resume config prompt "continue"
/auto-resume config maxRetries 5
```

## How It Works

```
API Error → StopFailure hook fires
  → Hook checks state (enabled? under max retries? cooldown passed?)
    → Spawns background process
      → Sleeps delaySeconds
        → Injects prompt into terminal
          → Claude Code resumes from context
```

1. The `StopFailure` hook in settings.json triggers `auto-resume-hook.js`
2. The hook reads `~/.claude/auto-resume/state.json` to check if auto-resume is enabled and under retry limits
3. If allowed, it spawns `inject-input.js` as a detached background process
4. After the configured delay, the injector writes the prompt into the terminal
   - **Windows**: Uses PowerShell + clipboard + SendKeys (supports CJK characters), auto-tries WindowsTerminal / WindowTerminal / conhost
   - **macOS**: Prefers tmux send-keys, falls back to osascript (AppleScript keyboard simulation)
   - **Linux**: Prefers tmux send-keys, falls back to `/dev/pts/` direct write

## Safety

- **Max retries** prevents infinite loops (default: 3 consecutive resumes)
- **Retry cooldown** prevents rapid re-triggering (default: 60s between attempts)
- **State tracking** records retry count and last resume timestamp
- `/auto-resume off` immediately disables without restart

## Files

| File | Purpose |
|------|---------|
| `SKILL.md` | Skill definition and command handlers |
| `auto-resume-hook.js` | StopFailure hook entry point |
| `inject-input.js` | Background process that injects input into the terminal |

## Requirements

- Node.js (for hook and injector scripts)
- **Windows**: PowerShell with `System.Windows.Forms` (built-in on Windows 10+)
- **macOS**: tmux (recommended) or Accessibility permissions enabled (required by osascript)
- **Linux**: tmux (recommended) or `/dev/pts/` access
