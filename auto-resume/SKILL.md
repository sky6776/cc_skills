---
name: auto-resume
version: 0.1.0
description: |
  Auto-resume Claude Code after rate-limit or API error interruptions.
  When StopFailure hook fires, automatically injects a "continue" prompt
  after a configurable delay to resume work.
  Use "/auto-resume setup" to install hooks (requires restart),
  "/auto-resume on" to enable, "/auto-resume off" to disable.
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
---

# /auto-resume — Auto-Resume After Interruptions

Automatically resumes Claude Code after API interruptions (rate limits, server
errors, etc.) by injecting a "continue" prompt into the terminal after a
configurable delay.

## Commands

| Command | Description |
|---------|-------------|
| `/auto-resume setup` | Register StopFailure hook in settings.json (requires restart) |
| `/auto-resume on` | Enable auto-resume (no restart needed) |
| `/auto-resume off` | Disable auto-resume (no restart needed) |
| `/auto-resume` | Show current status and configuration |
| `/auto-resume config <key> <value>` | Update configuration |

## When user says "/auto-resume setup"

Register the StopFailure hook in `~/.claude/settings.json`. **Idempotent**: if an auto-resume hook command already exists, remove it first, then add the fresh entry.

Run the following script to update settings.json (it handles deduplication automatically):

```bash
node -e "
const fs = require('fs');
const path = require('path');
const os = require('os');
const HOME = os.homedir();
const SKILLS_DIR = HOME + '/.claude/skills/auto-resume';
const SETTINGS_PATH = HOME + '/.claude/settings.json';
const HOOK_CMD = 'node ' + SKILLS_DIR + '/auto-resume-hook.js';

let settings = {};
try { settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')); } catch {}
if (!settings.hooks) settings.hooks = {};

// Helper: remove any hook entry whose command contains 'auto-resume-hook.js'
function removeAutoResumeHooks(arr) {
  if (!Array.isArray(arr)) return arr;
  return arr.map(entry => {
    if (!entry.hooks || !Array.isArray(entry.hooks)) return entry;
    entry.hooks = entry.hooks.filter(h => {
      if (h.type !== 'command') return true;
      return !h.command.includes('auto-resume-hook.js');
    });
    return entry;
  }).filter(entry => entry.hooks && entry.hooks.length > 0);
}

// StopFailure — remove old, then add fresh
if (!settings.hooks.StopFailure) settings.hooks.StopFailure = [];
settings.hooks.StopFailure = removeAutoResumeHooks(settings.hooks.StopFailure);
settings.hooks.StopFailure.push({
  matcher: '',
  hooks: [{ type: 'command', command: HOOK_CMD, async: true }]
});

fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
console.log('Auto-resume hook registered (idempotent). Restart Claude Code for changes to take effect.');
"
```

## When user says "/auto-resume on"

Enable auto-resume by writing to the state file (creates defaults if missing):

```bash
node -e "
const fs = require('fs');
const path = require('path');
const BASE = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(require('os').homedir(), '.claude'), 'auto-resume');
fs.mkdirSync(BASE, { recursive: true });
const SF = path.join(BASE, 'state.json');
const CF = path.join(BASE, 'config.json');
const DEFAULT_STATE = { enabled: false, retryCount: 0, lastResumeAt: null };
const DEFAULT_CONFIG = { delaySeconds: 30, prompt: '继续', maxRetries: 3, retryCooldownSeconds: 60 };
let state;
try { state = JSON.parse(fs.readFileSync(SF, 'utf8')); } catch { state = DEFAULT_STATE; }
try { fs.readFileSync(CF, 'utf8'); } catch { fs.writeFileSync(CF, JSON.stringify(DEFAULT_CONFIG, null, 2)); }
state.enabled = true;
state.retryCount = 0;
fs.writeFileSync(SF, JSON.stringify(state, null, 2));
console.log('Auto-resume enabled');
"
```

## When user says "/auto-resume off"

Disable auto-resume (creates defaults if missing):

```bash
node -e "
const fs = require('fs');
const path = require('path');
const BASE = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(require('os').homedir(), '.claude'), 'auto-resume');
fs.mkdirSync(BASE, { recursive: true });
const SF = path.join(BASE, 'state.json');
const DEFAULT_STATE = { enabled: false, retryCount: 0, lastResumeAt: null };
let state;
try { state = JSON.parse(fs.readFileSync(SF, 'utf8')); } catch { state = DEFAULT_STATE; }
state.enabled = false;
fs.writeFileSync(SF, JSON.stringify(state, null, 2));
console.log('Auto-resume disabled');
"
```

## When user says "/auto-resume" (no args)

Show current status by reading state.json and config.json:

```bash
node -e "
const fs = require('fs');
const path = require('path');
const BASE = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(require('os').homedir(), '.claude'), 'auto-resume');
const state = JSON.parse(fs.readFileSync(path.join(BASE, 'state.json'), 'utf8'));
const config = JSON.parse(fs.readFileSync(path.join(BASE, 'config.json'), 'utf8'));
console.log('Status:', state.enabled ? 'ON' : 'OFF');
console.log('Retries:', state.retryCount + '/' + config.maxRetries);
console.log('Config:', JSON.stringify(config, null, 2));
"
```

## When user says "/auto-resume config <key> <value>"

Update a config value in `~/.claude/auto-resume/config.json`:

```bash
node -e "
const fs = require('fs');
const path = require('path');
const BASE = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(require('os').homedir(), '.claude'), 'auto-resume');
const config = JSON.parse(fs.readFileSync(path.join(BASE, 'config.json'), 'utf8'));
// <key> and <value> are substituted from user input
config[KEY] = VALUE;
fs.writeFileSync(path.join(BASE, 'config.json'), JSON.stringify(config, null, 2));
console.log('Updated:', KEY, '=', VALUE);
"
```

Valid config keys: `delaySeconds` (number), `prompt` (string), `maxRetries` (number), `retryCooldownSeconds` (number)

## Configuration

Default config (stored in `~/.claude/auto-resume/config.json`):

| Key | Default | Description |
|-----|---------|-------------|
| `delaySeconds` | 30 | Wait time before injecting prompt |
| `prompt` | 继续 | Text to inject into terminal |
| `maxRetries` | 3 | Max consecutive auto-resumes |
| `retryCooldownSeconds` | 60 | Min time between auto-resumes |

## How It Works

1. StopFailure hook fires when Claude Code encounters an API error
2. Hook script reads state file (`~/.claude/auto-resume/state.json`)
3. If enabled and under max retries, spawns a background process
4. Background process sleeps for `delaySeconds`, then injects `prompt` into terminal
5. Claude Code receives the prompt and resumes work from its context

## Safety

- Max retries prevents infinite loops (default: 3)
- Retry cooldown prevents rapid re-triggering (default: 60s)
- State file tracks retry count and timestamps
- `/auto-resume off` immediately disables without restart