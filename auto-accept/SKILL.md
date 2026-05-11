---
name: auto-accept
description: |
  Auto-accept plan mode confirmations and AskUserQuestion prompts via hooks.
  Commands: setup, all/plan/ask on/off, ask option first/last/recommended.
---

# /auto-accept — Auto-Accept Interactive Confirmations

Automatically accept Claude Code's interactive confirmations:
- **Plan Mode**: EnterPlanMode / ExitPlanMode prompts
- **Ask Question**: AskUserQuestion multi-choice prompts

State file: `~/.claude/auto-accept/state.json`
Log file: `~/.claude/auto-accept/auto-accept.log`

---

## When user says "/auto-accept setup"

Register hooks in `~/.claude/settings.json`. **Idempotent**: if any auto-accept hook command already exists, remove it first, then add the fresh entry.

Run the following script to update settings.json (it handles deduplication automatically):

```bash
node -e "
const fs = require('fs');
const path = require('path');
const os = require('os');
const HOME = os.homedir();
const SKILLS_DIR = HOME + '/.claude/skills/auto-accept';
const SETTINGS_PATH = HOME + '/.claude/settings.json';
const HOOK_CMD_PLAN = 'node ' + SKILLS_DIR + '/auto-accept-hook.js';
const HOOK_CMD_ASK  = 'node ' + SKILLS_DIR + '/auto-accept-ask.js';

let settings = {};
try { settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')); } catch {}
if (!settings.hooks) settings.hooks = {};

// Helper: remove any hook entry whose command contains 'auto-accept-hook.js' or 'auto-accept-ask.js'
function removeAutoAcceptHooks(arr) {
  if (!Array.isArray(arr)) return arr;
  return arr.map(entry => {
    if (!entry.hooks || !Array.isArray(entry.hooks)) return entry;
    entry.hooks = entry.hooks.filter(h => {
      if (h.type !== 'command') return true;
      return !h.command.includes('auto-accept-hook.js') && !h.command.includes('auto-accept-ask.js');
    });
    return entry;
  }).filter(entry => entry.hooks && entry.hooks.length > 0);
}

// 1. PermissionRequest — remove old, then add fresh
if (!settings.hooks.PermissionRequest) settings.hooks.PermissionRequest = [];
settings.hooks.PermissionRequest = removeAutoAcceptHooks(settings.hooks.PermissionRequest);
settings.hooks.PermissionRequest.push({
  matcher: 'EnterPlanMode|ExitPlanMode',
  hooks: [{ type: 'command', command: HOOK_CMD_PLAN }]
});

// 2. PreToolUse AskUserQuestion — remove old auto-accept entries, then append fresh one
if (!settings.hooks.PreToolUse) settings.hooks.PreToolUse = [];
settings.hooks.PreToolUse = removeAutoAcceptHooks(settings.hooks.PreToolUse);
let askEntry = settings.hooks.PreToolUse.find(e => e.matcher === 'AskUserQuestion');
if (askEntry) {
  askEntry.hooks.push({ type: 'command', command: HOOK_CMD_ASK });
} else {
  settings.hooks.PreToolUse.push({
    matcher: 'AskUserQuestion',
    hooks: [{ type: 'command', command: HOOK_CMD_ASK }]
  });
}

fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
console.log('Auto-accept hooks registered (idempotent). Restart Claude Code for changes to take effect.');
"
```

Then initialize the state file:

```bash
node -e "
const fs = require('fs');
const path = require('path');
const BASE = path.join(require('os').homedir(), '.claude', 'auto-accept');
fs.mkdirSync(BASE, { recursive: true });
const SF = path.join(BASE, 'state.json');
let state;
try { state = JSON.parse(fs.readFileSync(SF, 'utf8')); } catch { state = null; }
if (!state) {
  state = { planMode: false, askQuestion: false, askQuestionStrategy: 'first' };
  fs.writeFileSync(SF, JSON.stringify(state, null, 2));
  console.log('State file initialized.');
} else {
  console.log('State file already exists, keeping current values.');
}
"
```

---

## When user says "/auto-accept all on"

Enable both features. Run:

```bash
node -e "
const fs = require('fs');
const path = require('path');
const BASE = path.join(require('os').homedir(), '.claude', 'auto-accept');
fs.mkdirSync(BASE, { recursive: true });
const state = JSON.parse(fs.readFileSync(path.join(BASE, 'state.json'), 'utf8'));
state.planMode = true;
state.askQuestion = true;
fs.writeFileSync(path.join(BASE, 'state.json'), JSON.stringify(state, null, 2));
console.log('Auto-Accept: ALL ON');
console.log('  Plan Mode: ON');
console.log('  Ask Question: ON (strategy: ' + state.askQuestionStrategy + ')');
"
```

---

## When user says "/auto-accept all off"

Disable both features. Run:

```bash
node -e "
const fs = require('fs');
const path = require('path');
const BASE = path.join(require('os').homedir(), '.claude', 'auto-accept');
const state = JSON.parse(fs.readFileSync(path.join(BASE, 'state.json'), 'utf8'));
state.planMode = false;
state.askQuestion = false;
fs.writeFileSync(path.join(BASE, 'state.json'), JSON.stringify(state, null, 2));
console.log('Auto-Accept: ALL OFF');
console.log('  Plan Mode: OFF');
console.log('  Ask Question: OFF');
"
```

---

## When user says "/auto-accept plan on"

Enable plan mode auto-accept only. Run:

```bash
node -e "
const fs = require('fs');
const path = require('path');
const BASE = path.join(require('os').homedir(), '.claude', 'auto-accept');
const state = JSON.parse(fs.readFileSync(path.join(BASE, 'state.json'), 'utf8'));
state.planMode = true;
fs.writeFileSync(path.join(BASE, 'state.json'), JSON.stringify(state, null, 2));
console.log('Auto-Accept: Plan Mode ON');
console.log('  Plan Mode: ' + (state.planMode ? 'ON' : 'OFF'));
console.log('  Ask Question: ' + (state.askQuestion ? 'ON' : 'OFF'));
"
```

---

## When user says "/auto-accept plan off"

Disable plan mode auto-accept only. Run:

```bash
node -e "
const fs = require('fs');
const path = require('path');
const BASE = path.join(require('os').homedir(), '.claude', 'auto-accept');
const state = JSON.parse(fs.readFileSync(path.join(BASE, 'state.json'), 'utf8'));
state.planMode = false;
fs.writeFileSync(path.join(BASE, 'state.json'), JSON.stringify(state, null, 2));
console.log('Auto-Accept: Plan Mode OFF');
console.log('  Plan Mode: ' + (state.planMode ? 'ON' : 'OFF'));
console.log('  Ask Question: ' + (state.askQuestion ? 'ON' : 'OFF'));
"
```

---

## When user says "/auto-accept ask on"

Enable ask question auto-answer only. Run:

```bash
node -e "
const fs = require('fs');
const path = require('path');
const BASE = path.join(require('os').homedir(), '.claude', 'auto-accept');
const state = JSON.parse(fs.readFileSync(path.join(BASE, 'state.json'), 'utf8'));
state.askQuestion = true;
fs.writeFileSync(path.join(BASE, 'state.json'), JSON.stringify(state, null, 2));
console.log('Auto-Accept: Ask Question ON');
console.log('  Plan Mode: ' + (state.planMode ? 'ON' : 'OFF'));
console.log('  Ask Question: ON (strategy: ' + state.askQuestionStrategy + ')');
"
```

---

## When user says "/auto-accept ask off"

Disable ask question auto-answer only. Run:

```bash
node -e "
const fs = require('fs');
const path = require('path');
const BASE = path.join(require('os').homedir(), '.claude', 'auto-accept');
const state = JSON.parse(fs.readFileSync(path.join(BASE, 'state.json'), 'utf8'));
state.askQuestion = false;
fs.writeFileSync(path.join(BASE, 'state.json'), JSON.stringify(state, null, 2));
console.log('Auto-Accept: Ask Question OFF');
console.log('  Plan Mode: ' + (state.planMode ? 'ON' : 'OFF'));
console.log('  Ask Question: OFF');
"
```

---

## When user says "/auto-accept ask option first"

Set ask strategy to pick first option. Run:

```bash
node -e "
const fs = require('fs');
const path = require('path');
const BASE = path.join(require('os').homedir(), '.claude', 'auto-accept');
const state = JSON.parse(fs.readFileSync(path.join(BASE, 'state.json'), 'utf8'));
state.askQuestionStrategy = 'first';
fs.writeFileSync(path.join(BASE, 'state.json'), JSON.stringify(state, null, 2));
console.log('Auto-Accept: Ask strategy set to FIRST');
console.log('  Will always pick the first option');
"
```

---

## When user says "/auto-accept ask option last"

Set ask strategy to pick last option. Run:

```bash
node -e "
const fs = require('fs');
const path = require('path');
const BASE = path.join(require('os').homedir(), '.claude', 'auto-accept');
const state = JSON.parse(fs.readFileSync(path.join(BASE, 'state.json'), 'utf8'));
state.askQuestionStrategy = 'last';
fs.writeFileSync(path.join(BASE, 'state.json'), JSON.stringify(state, null, 2));
console.log('Auto-Accept: Ask strategy set to LAST');
console.log('  Will always pick the last option');
"
```

---

## When user says "/auto-accept ask option recommended"

Set ask strategy to pick option with "Recommended" label. Run:

```bash
node -e "
const fs = require('fs');
const path = require('path');
const BASE = path.join(require('os').homedir(), '.claude', 'auto-accept');
const state = JSON.parse(fs.readFileSync(path.join(BASE, 'state.json'), 'utf8'));
state.askQuestionStrategy = 'recommended';
fs.writeFileSync(path.join(BASE, 'state.json'), JSON.stringify(state, null, 2));
console.log('Auto-Accept: Ask strategy set to RECOMMENDED');
console.log('  Will pick option with (Recommended) label, fallback to first');
"
```

---

## When user says "/auto-accept" (no args) or "/auto-accept status"

Show current state. Run:

```bash
node -e "
const fs = require('fs');
const path = require('path');
const BASE = path.join(require('os').homedir(), '.claude', 'auto-accept');
const state = JSON.parse(fs.readFileSync(path.join(BASE, 'state.json'), 'utf8'));
console.log('=== Auto-Accept Status ===');
console.log('  Plan Mode (EnterPlanMode/ExitPlanMode): ' + (state.planMode ? 'ON' : 'OFF'));
console.log('  Ask Question (AskUserQuestion):         ' + (state.askQuestion ? 'ON' : 'OFF'));
console.log('  Ask Strategy:                           ' + (state.askQuestionStrategy || 'first'));
"
```

---

## Strategy Options

| Strategy | Behavior |
|----------|----------|
| `first` | Always pick the first option (default) |
| `last` | Always pick the last option |
| `recommended` | Pick option with "Recommended" in label/description, fallback to first |

## Safety

- State is OFF by default — nothing is auto-accepted until you explicitly enable it
- Individual features can be toggled independently
- All auto-accepts are logged to `~/.claude/auto-accept/auto-accept.log`