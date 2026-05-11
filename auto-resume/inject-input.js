#!/usr/bin/env node
// inject-input.js — Inject keyboard input into Claude Code's terminal
// Called as a detached background process by auto-resume-hook.js
//
// Environment variables:
//   AUTO_RESUME_DELAY  - seconds to wait before injecting (default: 30)
//   AUTO_RESUME_PROMPT - text to inject (default: "继续")
//   AUTO_RESUME_LOG    - log file path

const fs = require('fs');
const path = require('path');
const { execFileSync, execSync } = require('child_process');

const delay = parseInt(process.env.AUTO_RESUME_DELAY || '30', 10);
const prompt = process.env.AUTO_RESUME_PROMPT || '继续';
const logFile = process.env.AUTO_RESUME_LOG;

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  if (logFile) {
    try { fs.appendFileSync(logFile, line); } catch {}
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Windows: inject input into the cmd terminal running Claude Code
// Strategy: Use clipboard + SendKeys for reliable text injection in cmd
// SendKeys cannot handle Chinese characters, so we:
//   1. Copy the prompt text to clipboard
//   2. Send Ctrl+V to paste it
//   3. Send Enter to submit
function injectWindows(text) {
  const tmpScript = path.join(require('os').tmpdir(), `auto-resume-${Date.now()}.ps1`);

  // Escape for PowerShell string
  const escapedText = text.replace(/'/g, "''");

  const psContent = `
    Add-Type -AssemblyName System.Windows.Forms

    # Copy prompt to clipboard
    [System.Windows.Forms.Clipboard]::SetText('${escapedText}')

    Start-Sleep -Milliseconds 500

    # Find the Claude Code terminal window
    # Works with cmd, Windows Terminal, and conhost
    $shell = New-Object -ComObject WScript.Shell

    # Look for cmd or terminal process with claude in title
    $procs = Get-Process -Name cmd -ErrorAction SilentlyContinue
    $wt = Get-Process -Name WindowsTerminal,WindowTerminal -ErrorAction SilentlyContinue
    $ch = Get-Process -Name conhost -ErrorAction SilentlyContinue

    if ($procs -or $wt -or $ch) {
      # Activate the window — try to find one with 'claude' in title
      $found = $false
      foreach ($p in @($procs, $wt, $ch)) {
        if ($p) {
          foreach ($proc in $p) {
            if ($proc.MainWindowTitle -match 'claude') {
              $shell.AppActivate($proc.MainWindowTitle)
              $found = $true
              break
            }
          }
          if ($found) { break }
        }
      }

      if (-not $found) {
        # Fallback: activate any cmd/terminal window
        $shell.AppActivate('cmd')
        Start-Sleep -Milliseconds 200
      }

      Start-Sleep -Milliseconds 300

      # Paste from clipboard (Ctrl+V works in cmd on Windows 10+)
      $shell.SendKeys('^v')
      Start-Sleep -Milliseconds 200
      $shell.SendKeys('{ENTER}')

      # Clear clipboard
      [System.Windows.Forms.Clipboard]::Clear()

      Write-Output 'OK'
    } else {
      Write-Output 'NO_WINDOW'
    }
  `;
  fs.writeFileSync(tmpScript, psContent);

  try {
    const result = execFileSync('powershell', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tmpScript
    ], { timeout: 15000, encoding: 'utf8' }).trim();
    try { fs.unlinkSync(tmpScript); } catch {}
    return result === 'OK';
  } catch (e) {
    try { fs.unlinkSync(tmpScript); } catch {}
    log(`PowerShell injection failed: ${e.message}`);
    return false;
  }
}

// Unix: write directly to the TTY device
function injectUnix(text) {
  // Try tmux first (most reliable for detached processes)
  try {
    execFileSync('tmux', ['send-keys', text, 'Enter'], { timeout: 5000 });
    return true;
  } catch {}

  // macOS: use osascript to type into the active Terminal window
  if (process.platform === 'darwin') {
    try {
      // Escape double quotes and backslashes for AppleScript string
      const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const script = `tell application "System Events" to keystroke "${escaped}"`;
      execFileSync('osascript', ['-e', script], { timeout: 5000 });
      execFileSync('osascript', ['-e', 'tell application "System Events" to keystroke return'], { timeout: 5000 });
      return true;
    } catch (e) {
      log(`macOS osascript failed: ${e.message}`);
    }
  }

  // Linux: try writing to /proc/self/fd/0
  try {
    const fd0 = fs.readlinkSync('/proc/self/fd/0');
    if (fd0 && fd0.startsWith('/dev/pts/')) {
      fs.appendFileSync(fd0, text + '\n');
      return true;
    }
  } catch {}

  return false;
}

async function main() {
  log(`Waiting ${delay}s before injecting "${prompt}"...`);
  await sleep(delay * 1000);

  log(`Injecting "${prompt}"...`);

  let success = false;
  if (process.platform === 'win32') {
    success = injectWindows(prompt);
  } else {
    success = injectUnix(prompt);
  }

  if (success) {
    log('Injection successful');
  } else {
    log('Injection failed — could not find target terminal');
  }
}

main().catch(e => log(`Error: ${e.message}`));