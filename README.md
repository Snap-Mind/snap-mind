# SnapMind

This is an Electron + Vite + React application for translating selected words using OpenAI or user-selected LLM APIs. The app monitors the clipboard and supports hotkeys to trigger translation. UI includes language/model selection and translation display.

## Features

- Clipboard monitoring: Automatically translates copied words.
- Hotkey support: Trigger translation with Cmd+Shift+T.
- LLM integration: Uses OpenAI by default, user can select other models.
- Language/model selection UI.
- Translation display via popup/notification.

## Getting Started

1. Install dependencies:
   ```sh
   npm install
   ```
2. Start the Vite dev server:
   ```sh
   npm run dev
   ```
3. In another terminal, start Electron:
   ```sh
   npm run electron
   ```

## Development

- Frontend: React + Vite
- Main process: Electron (see `main.js`)
- Preload script: Electron context bridge (see `preload.js`)

---

Replace this README as the project evolves.
