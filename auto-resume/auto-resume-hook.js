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
  try { fs.appendFileSync(LOG_FILE, line); } catch {}
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
  log('StopFailure hook triggered');

  const state = loadState();
  if (!state.enabled) {
    log('Auto-resume is disabled, skipping');
    return;
  }

  const config = loadConfig();

  // Check max retries
  if (state.retryCount >= config.maxRetries) {
    log(`Max retries (${config.maxRetries}) reached, skipping`);
    return;
  }

  // Check cooldown
  if (state.lastResumeAt) {
    const elapsed = (Date.now() - state.lastResumeAt) / 1000;
    if (elapsed < config.retryCooldownSeconds) {
      const wait = Math.ceil(config.retryCooldownSeconds - elapsed);
      log(`Cooldown active, ${wait}s remaining, skipping`);
      return;
    }
  }

  // Update state
  state.retryCount += 1;
  state.lastResumeAt = Date.now();
  saveState(state);

  log(`Scheduling resume in ${config.delaySeconds}s (retry ${state.retryCount}/${config.maxRetries})`);

  // Spawn background process that sleeps then injects
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
  log('Background injector spawned');
}

main().catch(e => log(`Error: ${e.message}`));
