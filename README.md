# cc_skills

[English](README_EN.md)

Claude Code 自定义 Skills 仓库。

每个子目录是一个独立的 skill，安装到 `~/.claude/skills/` 下即可使用。

## Skills

| Skill | 说明 |
|-------|------|
| [auto-resume](auto-resume/) | Claude Code 遇到速率限制或 API 错误中断后自动恢复，通过 StopFailure hook 在可配置延迟后注入"继续"提示 |
| [auto-accept](auto-accept/) | 通过 hooks 自动接受 Claude Code 的交互式确认（Plan Mode 确认 + AskUserQuestion 回答），支持开关控制和策略选择 |

## 安装

将需要的 skill 目录复制到 `~/.claude/skills/` 下：

```bash
# 示例：安装 auto-resume
cp -r auto-resume ~/.claude/skills/
```

Windows (PowerShell)：

```powershell
Copy-Item -Recurse auto-resume "$env:USERPROFILE\.claude\skills\"
```

安装使用请参考对应 skill 的 README。
