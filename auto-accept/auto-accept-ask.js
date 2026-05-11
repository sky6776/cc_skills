#!/usr/bin/env node
// auto-accept-ask.js — PreToolUse hook for auto-answering AskUserQuestion
// Reads state from ~/.claude/auto-accept/state.json
// Strategy: 'first' (pick first option), 'last' (pick last), 'recommended' (pick option with "Recommended" in label)

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

function pickAnswer(question, strategy) {
  const options = question.options || [];
  if (options.length === 0) return null;

  switch (strategy) {
    case 'recommended': {
      // Look for option with "(Recommended)" in label or description
      const rec = options.find(o =>
        (o.label || '').includes('Recommended') || (o.description || '').includes('Recommended')
      );
      if (rec) return rec.label;
      // Fall through to first if no recommended found
    }
    // eslint-disable-next-line no-fallthrough
    case 'first':
      return options[0].label;

    case 'last':
      return options[options.length - 1].label;

    default:
      return options[0].label;
  }
}

function main() {
  const state = loadState();

  if (!state.askQuestion) {
    log('AskUserQuestion — askQuestion is OFF, not auto-answering');
    process.stdout.write('');
    return;
  }

  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('end', () => {
    let toolInput = {};
    try {
      const parsed = JSON.parse(input);
      toolInput = parsed.tool_input || {};
    } catch {}

    const questions = toolInput.questions || [];
    if (questions.length === 0) {
      log('AskUserQuestion — no questions found in input, skipping');
      process.stdout.write('');
      return;
    }

    const strategy = state.askQuestionStrategy || 'first';
    const answers = {};
    for (const q of questions) {
      const answer = pickAnswer(q, strategy);
      if (answer !== null) {
        answers[q.question] = answer;
      }
    }

    log(`AskUserQuestion — auto-answering ${questions.length} question(s) with strategy '${strategy}'`);

    const response = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        updatedInput: {
          questions: questions,
          answers: answers
        }
      }
    };
    process.stdout.write(JSON.stringify(response));
  });
}

main();
