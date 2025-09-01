# SnapMind

<p align='center'>
<img src='./electron/assets/snap-mind-app-icon-macOS.png' width="150" height="150" alt="snapmind icon"/>
</p>
<h1 align='center'>AI at the Speed of Thought</h1>
<p align="center">
  <a href="./README.md">English</a> | <a href="./README.zh.md">简体中文</a>
</p>
<p align="center">
<a href="./LICENSE"><img src="https://img.shields.io/badge/license-Apache%202-blue.svg" alt="License"></a>
  <a href="https://github.com/Snap-Mind/snap-mind/stargazers"><img src="https://img.shields.io/github/stars/Snap-Mind/snap-mind?style=social" alt="GitHub stars"></a>
  <a href="https://github.com/Snap-Mind/snap-mind/releases"><img src="https://img.shields.io/github/v/release/Snap-Mind/snap-mind" alt="Release"></a>
</p>



SnapMind is a desktop AI assistant that lets you **instantly interact with LLMs** from anywhere in your system. Select text + hit a hotkey, and get translations, rewrites, summaries, explanations, and more — all without switching apps, keeping your workflow smooth and uninterrupted.

---

## Features

- ⚡ **Blazing Fast** — Trigger AI with a single keystroke
- 🎯 **Seamless Experience** — Works in any app without breaking your flow
- 🛠 **Highly Customizable** — Set your own prompts for recurring tasks

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
  <img src="./electron/assets/snapmind-demo-en.gif" width="800" alt="SnapMind demo"/>
</p>

---

## Installation

### For Users
Download the latest installer from 👉 [snap-mind.github.io](https://snap-mind.github.io) or [Releases](https://github.com/Snap-Mind/snap-mind/releases).

> <u>Currently supports **macOS** and **Windows**.</u>

**On Windows**, you need to run this app with Administrator privileges (Run as Administrator).

**On MacOS**, after install the app

- Remove quarantine to bypass Gatekeeper. (or build the app by yourself)
  ```shell
  xattr -cr /Applications/SnapMind.app
  ```
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

