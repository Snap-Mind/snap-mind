# SnapMind

<p align='center'>
<img src='./electron/assets/snap-mind-app-icon-macOS.png' width="150" height="150" alt="snapmind icon"/>
</p>
<h1 align='center'>思维的速度，AI 的力量</h1>
<p align="center">
  <a href="./README.md">English</a> | <a href="./README.zh.md">简体中文</a>
</p>
<p align="center">
  <a href="https://discord.gg/5SBqDHxU"><img src="https://img.shields.io/badge/Discord-加入-5865F2?logo=discord&logoColor=white" alt="Discord"></a>
  <a href="https://x.com/louisgh_7"><img src="https://img.shields.io/badge/X-关注-000000?logo=x&logoColor=white" alt="X"></a>
  <br />
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-Apache%202-blue.svg" alt="License"></a>
  <a href="https://github.com/Snap-Mind/snap-mind/stargazers"><img src="https://img.shields.io/github/stars/Snap-Mind/snap-mind?style=social" alt="GitHub stars"></a>
  <a href="https://github.com/Snap-Mind/snap-mind/releases"><img src="https://img.shields.io/github/v/release/Snap-Mind/snap-mind" alt="Release"></a>
  
</p>

SnapMind 是一款桌面 AI 助手，让你可以在系统的任意位置**即时调用LLM**。只需选中文本 + 按下快捷键，即可完成翻译、改写、总结、解释等任务 —— 无需切换应用，让工作流保持专注和顺畅。

---

## 功能特性

- ⚡ **极速响应** — 一键触发 AI，瞬间完成任务
- 🎯 **无缝体验** — 在任意应用中使用，不打断你的工作流
- 🛠 **高度定制** — 可为常用任务配置专属快捷指令

---

## 使用场景

- **即时翻译** — 快速翻译选中文本，支持多语言
- **润色与改写** — 让文字更简洁、更专业、更流畅
- **秒级总结** — 将长文、报告快速提炼成要点
- **快速解释** — 高亮概念、术语或代码，立刻得到简单说明
- **智能起草** — 生成邮件、回复或文本片段
- **学习助手** — 检查语法、简化复杂表达，辅助理解
- **即时头脑风暴** — 将笔记或想法转化为结构化的思路和行动方案

---

## 演示

<p align="center">
  <img src="./resources/snapmind-demo-cn.gif" width="800" alt="SnapMind demo"/>
</p>

---

## 安装

### 普通用户

前往 👉 [snap-mind.github.io](https://snap-mind.github.io) 或 [Releases](https://github.com/Snap-Mind/snap-mind/releases) 下载最新安装包。

> <u>目前支持 **macOS** 和 **Windows**</u>

在**Windows**上运行之前, 您需要以管理员权限运行此应用程序(右键以管理员身份运行)。

在**MacOS**上安装应用程序后, 您需要在系统偏好设置中允许应用程序的权限。
- 允许辅助功能权限，以便应用程序可以读取您选中的文本。
- 允许钥匙串访问，以便应用程序可以存储您的 API 密钥。

### 开发者

克隆仓库:

```bash
git clone git@github.com:Snap-Mind/snap-mind.git
```

安装依赖:

```
npm install
```

启动开发环境:

```
npm run dev:electron
```

macOS打包:

```
npm run build:prod
```

Windows打包:

```
npm run build:win-prod
```

## 开源协议

[Apache 2.0](./LICENSE)
