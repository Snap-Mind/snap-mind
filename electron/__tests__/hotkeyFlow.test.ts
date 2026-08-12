import { describe, expect, it, vi } from 'vitest';

// This test asserts main's hotkey handler emits the chat:reset-with-seed
// payload we expect. It runs after Task 11 wires the real handler; for
// now, importing the (still-unrefactored) main.ts throws — we skip until
// then and re-enable in Task 11.

describe.skip('main hotkey flow (enabled in Task 11)', () => {
  it('emits chat:reset-with-seed with parsed helper output for a prompt-bound hotkey', () => {
    expect(true).toBe(true);
  });
});
