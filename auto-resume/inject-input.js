#!/usr/bin/env node
// auto-resume inject-input.js — Inject keyboard input into Claude Code's terminal
// Called as a detached background process by auto-resume-hook.js
// Input comes from user's own config.json, not external input — execSync is safe here.
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

// ── Windows ──────────────────────────────────────────────────────────
// Clipboard + SendKeys. SendKeys can't handle CJK, so we paste instead.
function injectWindows(text) {
  const tmpScript = path.join(require('os').tmpdir(), `auto-resume-${Date.now()}.ps1`);
  const escapedText = text.replace(/'/g, "''");

  const psContent = `
    Add-Type -AssemblyName System.Windows.Forms

    [System.Windows.Forms.Clipboard]::SetText('${escapedText}')
    Start-Sleep -Milliseconds 500

    $shell = New-Object -ComObject WScript.Shell
    $found = $false

    # Priority 1: Any window with "claude" in title
    $allProcs = Get-Process | Where-Object { $_.MainWindowTitle -match 'claude' -and $_.MainWindowTitle -ne '' }
    if ($allProcs) {
      $target = @($allProcs)[0]
      $shell.AppActivate($target.MainWindowTitle)
      $found = $true
    }

    # Priority 2: WindowsTerminal
    if (-not $found) {
      $wt = Get-Process -Name WindowsTerminal -ErrorAction SilentlyContinue
      if ($wt) {
        $t = @($wt) | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object -First 1
        if ($t) { $shell.AppActivate($t.MainWindowTitle); $found = $true }
      }
    }

    # Priority 3: cmd.exe
    if (-not $found) {
      $cmd = Get-Process -Name cmd -ErrorAction SilentlyContinue
      if ($cmd) {
        $t = @($cmd) | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object -First 1
        if ($t) { $shell.AppActivate($t.MainWindowTitle); $found = $true }
      }
    }

    # Priority 4: ConEmu, Cmder
    if (-not $found) {
      $alt = Get-Process -Name ConEmu64,ConEmu,Cmder -ErrorAction SilentlyContinue
      if ($alt) {
        $t = @($alt) | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object -First 1
        if ($t) { $shell.AppActivate($t.MainWindowTitle); $found = $true }
      }
    }

    if ($found) {
      Start-Sleep -Milliseconds 300
      $shell.SendKeys('^v')
      Start-Sleep -Milliseconds 200
      $shell.SendKeys('{ENTER}')
      [System.Windows.Forms.Clipboard]::Clear()
      Write-Host 'OK'
    } else {
      [System.Windows.Forms.Clipboard]::Clear()
      Write-Host 'NO_WINDOW'
    }
  `;
  fs.writeFileSync(tmpScript, psContent);

  try {
    const result = execFileSync('powershell', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tmpScript
    ], { timeout: 15000, encoding: 'utf8' }).trim();
    try { fs.unlinkSync(tmpScript); } catch {}
    log(`PowerShell result: ${result}`);
    return result.includes('OK');
  } catch (e) {
    try { fs.unlinkSync(tmpScript); } catch {}
    log(`PowerShell injection failed: ${e.message}`);
    return false;
  }
}

// ── macOS ────────────────────────────────────────────────────────────
function injectMacOS(text) {
  const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  for (const app of ['Terminal', 'iTerm2', 'Warp', 'Alacritty', 'kitty']) {
    try {
      execSync(`osascript -e 'tell application "${app}" to activate'`, { timeout: 3000 });
      break;
    } catch {}
  }

  try {
    execFileSync('osascript', ['-e',
      `tell application "System Events" to keystroke "${escaped}"`
    ], { timeout: 5000 });
    execFileSync('osascript', ['-e',
      'tell application "System Events" to keystroke return'
    ], { timeout: 5000 });
    return true;
  } catch (e) {
    log(`macOS osascript failed: ${e.message}`);
    return false;
  }
}

// ── Linux ────────────────────────────────────────────────────────────
function injectLinux(text) {
  // tmux
  try {
    execFileSync('tmux', ['send-keys', text, 'Enter'], { timeout: 5000 });
    return true;
  } catch {}

  // xdotool (X11)
  try {
    const wid = execSync('xdotool search --onlyvisible --name claude 2>/dev/null', {
      encoding: 'utf8', timeout: 3000
    }).trim().split('\n')[0];
    if (wid) {
      execSync(`xdotool windowactivate ${wid} --sync type --delay 50 "${text}"`, { timeout: 5000 });
      execSync('xdotool key Return', { timeout: 3000 });
      return true;
    }
  } catch {}

  // ydotool (Wayland)
  try {
    execSync(`ydotool type "${text}"`, { timeout: 5000 });
    execSync('ydotool key 28:1 28:0', { timeout: 3000 });
    return true;
  } catch {}

  // /dev/pts fallback
  try {
    const fd0 = fs.readlinkSync('/proc/self/fd/0');
    if (fd0 && fd0.startsWith('/dev/pts/')) {
      fs.appendFileSync(fd0, text + '\n');
      return true;
    }
  } catch {}

  return false;
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  log(`Waiting ${delay}s before injecting "${prompt}"...`);
  await sleep(delay * 1000);

  log(`Injecting "${prompt}" on ${process.platform}...`);

  let success = false;
  switch (process.platform) {
    case 'win32': success = injectWindows(prompt); break;
    case 'darwin': success = injectMacOS(prompt); break;
    default: success = injectLinux(prompt); break;
  }

  log(success ? 'Injection successful' : 'Injection failed');
}

main().catch(e => log(`Error: ${e.message}`));
