# SnapMind

<p align='center'>
<img src='./electron/assets/snap-mind-app-icon-macOS.png' width="150" height="150" alt="snapmind icon"/>
</p>
<h1 align='center'>AI at the Speed of Thought</h1>
<p align="center">
  <a href="./README.md">English</a> | <a href="./README.zh.md">简体中文</a>
</p>
<p align="center">
  <a href="https://discord.gg/4bpEAKMUzw"><img src="https://img.shields.io/badge/Discord-Join-5865F2?logo=discord&logoColor=white" alt="Discord"></a>
  <a href="https://x.com/louisgh_7"><img src="https://img.shields.io/badge/X-Follow-000000?logo=x&logoColor=white" alt="X"></a>
  <a href="https://github.com/Snap-Mind/snap-mind/stargazers"><img src="https://img.shields.io/github/stars/Snap-Mind/snap-mind?style=social" alt="GitHub stars"></a>
  </br>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-Apache%202-blue.svg" alt="License"></a>
  <a href="https://github.com/Snap-Mind/snap-mind/releases"><img src="https://img.shields.io/github/v/release/Snap-Mind/snap-mind" alt="Release"></a>
  <a href="https://github.com/conventional-branch/conventional-branch"><img src="https://img.shields.io/badge/Conventional%20Branch-1.0.0-blue" alt="Conventional Branch"/></a>
  <a href="https://github.com/Snap-Mind/snap-mind/actions/workflows/build.yml"><img src="https://github.com/Snap-Mind/snap-mind/actions/workflows/build.yml/badge.svg?branch=main" alt="Build and Release"></a>
</p>

<p align="center">
  <a href="https://www.producthunt.com/products/snapmind?embed=true&utm_source=badge-featured&utm_medium=badge&utm_source=badge-snapmind" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1013860&theme=dark&t=1758464414199" alt="SnapMind - A&#0032;quick&#0032;prompt&#0032;launcher | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a>
</p>

SnapMind is a desktop AI assistant that lets you **instantly interact with LLMs** from anywhere in your system. Select text + hit a hotkey, and get translations, rewrites, summaries, explanations, and more — all without switching apps, keeping your workflow smooth and uninterrupted.

---

## Features

- ⚡ **Blazing Fast** — Trigger AI with a single keystroke
- 🎯 **Seamless Experience** — Works in any app without breaking your flow
- 🛠 **Highly Customizable** — Set your own prompts for recurring tasks
- 🔌 **Multiple Providers** — See supported providers below

### Supported providers

<p align="center">
  <img src="./resources/openai.svg" alt="OpenAI" />
  &nbsp;&nbsp;
  <img src="./resources/anthropic.svg" alt="Anthropic" />
  &nbsp;&nbsp;
  <img src="./resources/azureai.svg" alt="Azure OpenAI" />
  &nbsp;&nbsp;
  <img src="./resources/gemini.svg" alt="Google Gemini" />
  &nbsp;&nbsp;
  <img src="./resources/deepseek.svg" alt="DeepSeek" />
  &nbsp;&nbsp;
  <img src="./resources/qwen.svg" alt="Qwen" />
</p>

<p align="center"><sub>OpenAI · Anthropic · Azure OpenAI · Google Gemini · DeepSeek · Qwen</sub></p>

---

## Use Cases

- **Instant Translation** — Quickly translate selected text in any language
- **Polish & Rewrite** — Make text clearer, shorter, or more professional
- **Summarize in Seconds** — Turn long paragraphs or reports into key takeaways
- **Quick Explanations** — Highlight concepts, terms, or code for instant explanations
- **Smart Drafting** — Generate emails, replies, or text snippets quickly
- **Learning Companion** — Check grammar, simplify complex content, aid understanding
- **On-the-fly Brainstorming** — Transform notes or ideas into structured thoughts and action items

---

## Demo

<p align="center">
  <img src="./resources/snapmind-demo-en.gif" width="800" alt="SnapMind demo"/>
</p>

---

## Installation

### For Users

Download the latest installer from 👉 [snap-mind.github.io](https://snap-mind.github.io) or [Releases](https://github.com/Snap-Mind/snap-mind/releases).

> <u>Currently supports **macOS** and **Windows**.</u>

**On Windows**, you need to run this app with Administrator privileges (Run as Administrator).

**On MacOS**, after install the app

- You need to allow accessibility permissions, so the app can read your selected texts.
- You need to grant keychain access for the app to store your api keys.

### For Developers

Clone this repository:

```bash
git clone git@github.com:Snap-Mind/snap-mind.git
```

Install dependencies:

```
npm install
```

Build helper:

```
# on macOS:
npm run build:helper

# on Windows:
npm run build:win-helper
```

Start the dev server:

```
npm run dev:electron
```

Build on macOS:

```
npm run build:prod
```

Build on Windows:

```
npm run build:win-prod
```

## License

[Apache 2.0](./LICENSE)
