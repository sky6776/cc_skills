#!/usr/bin/env node
// auto-accept-hook.js — PermissionRequest hook for auto-accepting plan mode prompts
// Handles: EnterPlanMode, ExitPlanMode
// Reads state from ~/.claude/auto-accept/state.json to check if feature is enabled

const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(
  process.env.CLAUDE_CONFIG_DIR || path.join(require('os').homedir(), '.claude'),
  'auto-accept'
);
const STATE_FILE = path.join(BASE_DIR, 'state.json');
const LOG_FILE = path.join(BASE_DIR, 'auto-accept.log');

function log(msg) {
  const ts = new Date().toISOString();
  try { fs.appendFileSync(LOG_FILE, `[${ts}] ${msg}\n`); } catch {}
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {
      planMode: false,
      askQuestion: false,
      askQuestionStrategy: 'first'
    };
  }
}

function main() {
  const state = loadState();

  // Read stdin for hook context (tool name is in the input)
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('end', () => {
    let toolName = '';
    try {
      const parsed = JSON.parse(input);
      toolName = parsed.tool_name || '';
    } catch {}

    if (toolName === 'EnterPlanMode' || toolName === 'ExitPlanMode') {
      if (!state.planMode) {
        log(`${toolName} — planMode is OFF, not auto-accepting`);
        // Return empty — let the normal prompt appear
        process.stdout.write('');
        return;
      }
      log(`${toolName} — auto-accepting`);
      const response = {
        hookSpecificOutput: {
          hookEventName: 'PermissionRequest',
          decision: { behavior: 'allow' }
        }
      };
      process.stdout.write(JSON.stringify(response));
      return;
    }

    // Unknown tool, don't interfere
    process.stdout.write('');
  });
}

main();
