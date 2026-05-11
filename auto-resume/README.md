# auto-resume

[English](README_EN.md)

Claude Code 遇到速率限制或 API 错误中断后自动恢复。

当 Claude Code 触发 `StopFailure`（速率限制、服务器错误等），此技能会在可配置的延迟后自动向终端注入"继续"提示，无需手动干预即可恢复工作。

## 快速开始

```
/auto-resume setup    # 注册 hook（需要重启）
/auto-resume on       # 启用自动恢复
```

## 命令

| 命令 | 说明 |
|------|------|
| `/auto-resume setup` | 在 settings.json 中注册 StopFailure hook（需要重启） |
| `/auto-resume on` | 启用自动恢复（无需重启） |
| `/auto-resume off` | 禁用自动恢复（无需重启） |
| `/auto-resume` | 显示当前状态和配置 |
| `/auto-resume config <key> <value>` | 修改配置 |

## 配置

默认配置存储在 `~/.claude/auto-resume/config.json`：

| 键 | 默认值 | 说明 |
|----|--------|------|
| `delaySeconds` | 30 | 注入提示前的等待时间（秒） |
| `prompt` | 继续 | 注入到终端的文本 |
| `maxRetries` | 3 | 最大连续自动恢复次数 |
| `retryCooldownSeconds` | 60 | 两次自动恢复的最小间隔（秒） |

示例：

```
/auto-resume config delaySeconds 60
/auto-resume config prompt "continue"
/auto-resume config maxRetries 5
```

## 工作原理

```
API 错误 → StopFailure hook 触发
  → Hook 检查状态（已启用？未超重试上限？冷却已过？）
    → 启动后台进程
      → 等待 delaySeconds
        → 向终端注入提示文本
          → Claude Code 从上下文恢复工作
```

1. settings.json 中的 `StopFailure` hook 触发 `auto-resume-hook.js`
2. Hook 读取 `~/.claude/auto-resume/state.json` 检查是否启用且未超重试上限
3. 若允许，以分离后台进程方式启动 `inject-input.js`
4. 经过配置的延迟后，注入器将提示文本写入终端
   - **Windows**：使用 PowerShell + 剪贴板 + SendKeys（支持中文字符），自动尝试 WindowsTerminal / WindowTerminal / conhost
   - **macOS**：优先使用 tmux send-keys，回退到 osascript（AppleScript 模拟键盘输入）
   - **Linux**：优先使用 tmux send-keys，回退到 `/dev/pts/` 直写

## 安全机制

- **最大重试次数**防止无限循环（默认：3 次连续恢复）
- **重试冷却**防止快速重复触发（默认：两次间隔 60 秒）
- **状态跟踪**记录重试次数和上次恢复时间戳
- `/auto-resume off` 立即禁用，无需重启

## 文件说明

| 文件 | 用途 |
|------|------|
| `SKILL.md` | 技能定义和命令处理器 |
| `auto-resume-hook.js` | StopFailure hook 入口 |
| `inject-input.js` | 向终端注入输入的后台进程 |

## 环境要求

- Node.js（用于 hook 和注入脚本）
- **Windows**：PowerShell 及 `System.Windows.Forms`（Windows 10+ 内置）
- **macOS**：tmux（推荐）或系统已启用辅助功能权限（osascript 需要）
- **Linux**：tmux（推荐）或 `/dev/pts/` 访问权限
