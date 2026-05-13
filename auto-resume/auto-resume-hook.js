#!/usr/bin/env node
// auto-resume-hook.js — StopFailure hook for Claude Code auto-resume
// Triggered by StopFailure event, spawns background delayed prompt injection

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const BASE_DIR = path.join(
  process.env.CLAUDE_CONFIG_DIR || path.join(require('os').homedir(), '.claude'),
  'auto-resume'
);
const STATE_FILE = path.join(BASE_DIR, 'state.json');
const CONFIG_FILE = path.join(BASE_DIR, 'config.json');
const LOG_FILE = path.join(BASE_DIR, 'auto-resume.log');

const DEFAULT_CONFIG = {
  delaySeconds: 30,
  prompt: '继续',
  maxRetries: 3,
  retryCooldownSeconds: 60
};

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  try {
    fs.mkdirSync(BASE_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, line);
  } catch {}
}

function loadConfig() {
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { enabled: false, retryCount: 0, lastResumeAt: null };
  }
}

function saveState(state) {
  try {
    fs.mkdirSync(BASE_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    log(`Failed to save state: ${e.message}`);
  }
}

async function main() {
  // Log everything we receive from the hook system
  log('=== StopFailure hook triggered ===');
  log(`argv: ${JSON.stringify(process.argv)}`);
  log(`env keys: CLAUDE_CONFIG_DIR=${process.env.CLAUDE_CONFIG_DIR || '(unset)'}`);

  // Read stdin (Claude Code may pass error details via stdin)
  let stdinData = '';
  try {
    if (!process.stdin.isTTY) {
      process.stdin.setEncoding('utf8');
      for await (const chunk of process.stdin) {
        stdinData += chunk;
      }
    }
  } catch {}
  if (stdinData) {
    log(`stdin: ${stdinData.substring(0, 500)}`);
  }

  const state = loadState();
  log(`state: enabled=${state.enabled}, retryCount=${state.retryCount}, lastResumeAt=${state.lastResumeAt}`);

  if (!state.enabled) {
    log('Auto-resume is disabled, skipping');
    return;
  }

  const config = loadConfig();

  if (state.retryCount >= config.maxRetries) {
    log(`Max retries (${config.maxRetries}) reached, skipping`);
    return;
  }

  if (state.lastResumeAt) {
    const elapsed = (Date.now() - state.lastResumeAt) / 1000;
    if (elapsed < config.retryCooldownSeconds) {
      const wait = Math.ceil(config.retryCooldownSeconds - elapsed);
      log(`Cooldown active, ${wait}s remaining, skipping`);
      return;
    }
  }

  state.retryCount += 1;
  state.lastResumeAt = Date.now();
  saveState(state);

  log(`Scheduling resume in ${config.delaySeconds}s (retry ${state.retryCount}/${config.maxRetries})`);

  const scriptDir = __dirname;
  const injectScript = path.join(scriptDir, 'inject-input.js');

  const child = spawn('node', [injectScript], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      AUTO_RESUME_DELAY: String(config.delaySeconds),
      AUTO_RESUME_PROMPT: config.prompt,
      AUTO_RESUME_LOG: LOG_FILE
    }
  });

  child.unref();
  log(`Background injector spawned (pid=${child.pid})`);
}

main().catch(e => log(`Error: ${e.message}`));
