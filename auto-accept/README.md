# Auto-Accept Skill for Claude Code

[English](README_EN.md) | [中文](README.md)

通过 hooks 自动接受 Claude Code 的交互式确认提示。

## 功能

- **Plan Mode 自动确认** — 跳过 `EnterPlanMode` / `ExitPlanMode` 确认提示
- **Ask Question 自动回答** — 自动为 `AskUserQuestion` 提示选择答案
- **开关控制** — 通过斜杠命令独立控制每个功能
- **策略选择** — 选择 AskUserQuestion 的回答方式（首个 / 末个 / 推荐）
- **审计日志** — 所有自动接受操作记录到 `~/.claude/auto-accept/auto-accept.log`

## 安装

将 `auto-accept` 文件夹复制到 `~/.claude/skills/`：

```bash
cp -r auto-accept ~/.claude/skills/
```

然后在 Claude Code 中运行设置命令：

```
/auto-accept setup
```

这会在 `~/.claude/settings.json` 中注册 hooks 并初始化状态文件。**重启 Claude Code** 使配置生效。

## 命令

| 命令 | 效果 |
|------|------|
| `/auto-accept setup` | 在 settings.json 中注册 hooks |
| `/auto-accept all on` | 开启全部自动接受 |
| `/auto-accept all off` | 关闭全部自动接受 |
| `/auto-accept plan on` | 仅开启 plan mode 自动确认 |
| `/auto-accept plan off` | 仅关闭 plan mode 自动确认 |
| `/auto-accept ask on` | 仅开启 ask question 自动回答 |
| `/auto-accept ask off` | 仅关闭 ask question 自动回答 |
| `/auto-accept ask option first` | 策略：选第一个选项 |
| `/auto-accept ask option last` | 策略：选最后一个选项 |
| `/auto-accept ask option recommended` | 策略：选带 "Recommended" 的选项 |
| `/auto-accept` 或 `/auto-accept status` | 查看当前状态 |

## 回答策略选项

| 策略 | 行为 |
|------|------|
| `first` | 始终选第一个选项（默认，最安全 — Claude 通常把推荐选项放第一个） |
| `last` | 始终选最后一个选项 |
| `recommended` | 选标签或描述中包含 "Recommended" 的选项，找不到则回退到第一个 |

## 工作原理

```
用户输入 /auto-accept all on
        │
        ▼
状态文件更新 (~/.claude/auto-accept/state.json)
        │
        ▼
Hook 脚本在每次提示时读取状态
        │
   ┌────┴────┐
   ▼         ▼
PermissionRequest   PreToolUse
(Plan Mode)        (AskUserQuestion)
   │                  │
   ▼                  ▼
auto-accept-hook.js  auto-accept-ask.js
   │                  │
   ▼                  ▼
返回 "allow"        返回答案 + "allow"
```

## 文件说明

| 文件 | 用途 |
|------|------|
| `SKILL.md` | Skill 定义，包含所有命令处理逻辑 |
| `auto-accept-hook.js` | Plan mode 的 PermissionRequest hook |
| `auto-accept-ask.js` | AskUserQuestion 的 PreToolUse hook |
| `README.md` | 本文件（中文） |
| `README_EN.md` | 英文文档 |

## 安全性

- 所有功能**默认关闭** — 不会自动接受任何提示，直到你显式开启
- 每个功能可独立开关
- 所有自动接受操作均有日志记录，可审计
