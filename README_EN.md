# cc_skills

[中文](README.md)

A collection of custom skills for Claude Code.

Each subdirectory is an independent skill. Copy it to `~/.claude/skills/` to use.

## Skills

| Skill | Description |
|-------|-------------|
| [auto-resume](auto-resume/) | Auto-resume Claude Code after rate-limit or API error interruptions, injecting a "continue" prompt via StopFailure hook after a configurable delay |
| [auto-accept](auto-accept/) | Auto-accept Claude Code's interactive confirmations (Plan Mode + AskUserQuestion) via hooks, with on/off control and strategy selection |

## Installation

Copy the desired skill directory to `~/.claude/skills/`:

```bash
# Example: install auto-resume
cp -r auto-resume ~/.claude/skills/
```

Windows (PowerShell):

```powershell
Copy-Item -Recurse auto-resume "$env:USERPROFILE\.claude\skills\"
```

See each skill's README for installation and usage details.
