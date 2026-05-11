# Auto-Accept Skill for Claude Code

[English](README_EN.md) | [中文](README.md)

Automatically accept Claude Code's interactive confirmations via hooks.

## Features

- **Plan Mode Auto-Accept** — Skip `EnterPlanMode` / `ExitPlanMode` confirmation prompts
- **Ask Question Auto-Answer** — Automatically select an answer for `AskUserQuestion` prompts
- **On/Off Control** — Toggle each feature independently via slash commands
- **Strategy Selection** — Choose how AskUserQuestion answers are picked (first / last / recommended)
- **Audit Log** — All auto-accepts are logged to `~/.claude/auto-accept/auto-accept.log`

## Install

Copy the `auto-accept` folder to `~/.claude/skills/`:

```bash
cp -r auto-accept ~/.claude/skills/
```

Then run the setup command in Claude Code:

```
/auto-accept setup
```

This registers the hooks in `~/.claude/settings.json` and initializes the state file. **Restart Claude Code** for changes to take effect.

## Commands

| Command | Effect |
|---------|--------|
| `/auto-accept setup` | Register hooks in settings.json |
| `/auto-accept all on` | Enable all auto-accept |
| `/auto-accept all off` | Disable all auto-accept |
| `/auto-accept plan on` | Enable plan mode auto-accept |
| `/auto-accept plan off` | Disable plan mode auto-accept |
| `/auto-accept ask on` | Enable ask question auto-answer |
| `/auto-accept ask off` | Disable ask question auto-answer |
| `/auto-accept ask option first` | Strategy: pick first option (default) |
| `/auto-accept ask option last` | Strategy: pick last option |
| `/auto-accept ask option recommended` | Strategy: pick "Recommended" option |
| `/auto-accept` or `/auto-accept status` | Show current state |

## Ask Strategy Options

| Strategy | Behavior |
|----------|----------|
| `first` | Always pick the first option (default, safest — Claude usually puts recommended first) |
| `last` | Always pick the last option |
| `recommended` | Pick option with "Recommended" in label/description, fallback to first |

## How It Works

```
User types /auto-accept all on
        │
        ▼
State file updated (~/.claude/auto-accept/state.json)
        │
        ▼
Hook scripts read state on each prompt
        │
   ┌────┴────┐
   ▼         ▼
PermissionRequest   PreToolUse
(Plan Mode)        (AskUserQuestion)
   │                  │
   ▼                  ▼
auto-accept-hook.js  auto-accept-ask.js
   │                  │
   ▼                  ▼
Return "allow"      Return answer + "allow"
```

## Files

| File | Purpose |
|------|---------|
| `SKILL.md` | Skill definition with all command handlers |
| `auto-accept-hook.js` | PermissionRequest hook for plan mode |
| `auto-accept-ask.js` | PreToolUse hook for AskUserQuestion |
| `README.md` | Chinese documentation |
| `README_EN.md` | This file |

## Safety

- All features are **OFF by default** — nothing is auto-accepted until you explicitly enable it
- Each feature can be toggled independently
- All auto-accepts are logged for audit
