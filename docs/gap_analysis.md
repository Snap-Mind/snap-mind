# Supporting Skills in SnapMind — Gap Analysis

A "skill" (Claude-Code-style) = `name + description + instructions + optional bundled resources/tools`, invoked by name or auto-selected by the LLM. Here's where SnapMind stands today vs. what's missing.

## What already fits the model

- **Prompt-as-config pattern** — `hotkeys.json` already stores `{id, key, prompt, enabled}` and ships defaults via `hotkeys.default.json`. A skill registry is the same shape, one level richer.
- **Clean provider abstraction** — `ProviderFactory` composes `RequestBuilder` + `ResponseParser`. Adding tool schemas to the request body is a per-adapter change, not an architectural one.
- **Message-role discipline** — `TextSelectionService` already builds `Message[]` with system/user roles correctly (Anthropic even special-cases system).
- **Capability declaration exists** — models carry `capabilities: ['tool-use', ...]`. Declared but never read.
- **Encrypted secrets pipeline** — `SafeStorageService` + `processApiKeys` is reusable if skills need their own credentials (e.g., a web-search API key).

## Gaps, ranked by blast radius

### 1. No tool-call plumbing (biggest gap)

`tool-use` capability is declared but unused. Request builders never emit a `tools` field; response parsers never extract `tool_use` blocks; `AIService` has no agentic loop (call → run tool → append result → call again). This is the largest piece of new code and touches every adapter.

### 2. No skill data model or storage

Today a hotkey's `prompt` is a flat string. A skill needs at minimum: `id, name, description, instructions, allowedTools?, resources?`. Decide:

- Store in a new `skills.json` (+ `skills.default.json`) parallel to hotkeys, or
- Promote the existing `prompt` field on a hotkey into `skillId` reference.

The second is cleaner long-term but breaks existing user configs — needs a migration in `SettingsService`.

### 3. No resource/asset loader

`SettingsService` only does JSON I/O from `userData`. Claude-Code-style skills bundle markdown + scripts in a folder. You'd need:

- A directory layout (`userData/skills/<name>/SKILL.md` + sibling files)
- A loader that reads `SKILL.md` frontmatter (name/description) for the index, lazy-loads the body when invoked
- Safe-path handling so a skill can't read outside its own folder

### 4. No skill-selection mechanism

Two patterns to choose between:

- **Explicit**: hotkey points at a skill by id (low-risk, fits current UX).
- **Auto-select**: feed all skill `name + description` pairs into the system prompt, let the LLM pick (requires tool-use to be wired up first).

Recommend explicit first; auto-select layered on after tool-use lands.

### 5. No IPC channels or UI

`preload.ts` has `hotkeys:*` / `settings:*` but no `skills:*`. Settings UI (`src/pages/Settings/`) has no skill browser/editor. Both are mechanical to add once (2) is decided.

### 6. No tool sandbox / permission model

If skills can execute tools (shell, HTTP, file read), you need a permission prompt akin to Claude Code's. macOS already gates accessibility via `SystemPermissionService`; per-skill tool consent would be a new surface.

## Suggested phasing

1. **Phase 1 — Skills-as-prompts**: data model + storage + UI + hotkey→skill reference. No tool use. Ships value immediately; unblocks everything else.
2. **Phase 2 — Tool use in one adapter**: wire Anthropic's `tools` end-to-end (request → parse → loop in `AIService`). Validate the loop before fanning out.
3. **Phase 3 — Bundled resources**: folder-based skills with `SKILL.md` + assets, loader, and frontmatter index.
4. **Phase 4 — Auto-selection & permissions**: LLM picks skill from registry; per-tool consent UI.

The architecture is friendlier to this than most Electron apps — the adapter pattern and clean IPC contract mean Phase 1 is mostly additive, and Phase 2's risk is contained to `AIService` + one adapter pair.
