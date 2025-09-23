import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Input } from '@heroui/react';

/**
 * HotkeyRecorder
 *  - Start listening when the input is focused.
 *  - The final hotkey = up to 2 modifier keys + 1 non-modifier key (must include at least 1 modifier and 1 non-modifier).
 *  - Modifier key order: (mac) Cmd > Shift > Option > Ctrl; (others) Ctrl > Shift > Alt > Meta.
 *  - Commit automatically after keys are released if rule satisfied (>=1 modifier + 1 main key).
 *  - Use the input clear button to reset.
 *  - Keep the logic as simple as possible (no external confirm button, no controlled value prop).
 */

export interface HotkeyRecorderProps {
  onChange?: (val: string | null) => void; // fired when a valid combo captured
  onReset?: () => void; // user clears via clear button
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
}

// We only allow these modifier keys (KeyboardEvent.key lowercased)
const MOD_KEYS = ['meta', 'shift', 'alt', 'control'];
const MOD_SET = new Set(MOD_KEYS);

// Fixed whitelist: letters (a-z), digits (0-9) + limited safe symbols.
const ALLOWED_MAIN_REGEX = /^[a-z0-9]$/i;
const ALLOWED_SYMBOL_KEYS = new Set(['[', ']', ';', "'", ',', '.', '/', '\\', '`']);

function isAllowedMainKey(key: string) {
  if (key.length === 1) {
    if (ALLOWED_MAIN_REGEX.test(key)) return true;
    if (ALLOWED_SYMBOL_KEYS.has(key)) return true;
  }
  return false; // Any multi-char key (Enter, Tab, F1...) rejected by default.
}

function isModifier(key: string) {
  return MOD_SET.has(key.toLowerCase());
}

function orderModifiers(mods: string[], platform: 'mac' | 'other') {
  const rankMac: Record<string, number> = { meta: 1, shift: 2, alt: 3, control: 4 };
  const rankOther: Record<string, number> = { control: 1, shift: 2, alt: 3, meta: 4 };
  const rank = platform === 'mac' ? rankMac : rankOther;
  return [...mods].sort((a, b) => (rank[a.toLowerCase()] ?? 99) - (rank[b.toLowerCase()] ?? 99));
}

function formatDisplay(mods: string[], main: string | null, platform: 'mac' | 'other') {
  if (!main) return orderModifiers(mods, platform).map(printModifier).join('+');
  const ordered = orderModifiers(mods, platform).map(printModifier);
  return [...ordered, normalizeMain(main)].join('+');
}

function printModifier(k: string) {
  switch (k.toLowerCase()) {
    case 'meta':
      return 'Command';
    case 'alt':
      return 'Option';
    case 'control':
      return 'Ctrl';
    case 'shift':
      return 'Shift';
    default:
      return k;
  }
}

function normalizeMain(k: string) {
  if (k.length === 1) return /^[a-z]$/i.test(k) ? k.toUpperCase() : k; // letters uppercase
  if (/^f\d{1,2}$/i.test(k)) return k.toUpperCase();
  const map: Record<string, string> = {
    escape: 'Esc',
    ' ': 'Space',
    arrowup: 'Up',
    arrowdown: 'Down',
    arrowleft: 'Left',
    arrowright: 'Right',
    enter: 'Enter',
    tab: 'Tab',
    backspace: 'Backspace',
  };
  return map[k.toLowerCase()] || k;
}

export const HotkeyRecorder: React.FC<HotkeyRecorderProps> = ({
  placeholder = 'Press a shortcut',
  disabled,
  className,
  autoFocus,
  onChange,
  onReset,
}) => {
  const platform: 'mac' | 'other' = /mac/i.test(navigator.userAgent) ? 'mac' : 'other';
  const [keybindings, setKeybindings] = useState<string | null>(null);
  const [modKeys, setModKeys] = useState<Set<string>>(new Set()); // active modifiers captured (max 2)
  const [mainKey, setMainKey] = useState<string | null>(null); // main (non-modifier) key
  const [recording, setRecording] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const commit = useCallback(
    (val: string | null) => {
      setKeybindings(val);
      onChange?.(val);
    },
    [onChange]
  );

  const clearAttempt = useCallback(() => {
    setModKeys(new Set());
    setMainKey(null);
  }, []);

  const handleFocus = () => {
    if (disabled) return;
    if (keybindings) return;
    setRecording(true);
  };

  const handleBlur = () => {
    if (disabled) return;
    if (keybindings) return;
    setRecording(false);
  };

  const attemptCommit = useCallback(
    (mods: Set<string>, main: string | null) => {
      if (main && mods.size > 0) {
        const combo = formatDisplay(Array.from(mods), main, platform);
        commit(combo);
        setRecording(false);
      }
    },
    [commit, platform]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!recording || disabled || keybindings) return;
    e.preventDefault();
    const k = e.key;

    const nextMods = new Set(modKeys);
    let nextMain = mainKey;

    if (isModifier(k)) {
      const lower = k.toLowerCase();
      if (nextMods.has(lower) || nextMods.size < 2) {
        nextMods.add(lower);
      }
    } else if (!nextMain && isAllowedMainKey(k)) {
      nextMain = k;
    }

    // Update state if changed
    if (nextMain !== mainKey) setMainKey(nextMain);
    if (nextMods.size !== modKeys.size || Array.from(nextMods).some((m) => !modKeys.has(m))) {
      setModKeys(nextMods);
    }

    // Attempt to finalize immediately once we have both parts
    attemptCommit(nextMods, nextMain);
  };

  const handleReset = () => {
    clearAttempt();
    commit(null);
    setRecording(false);
    inputRef.current?.blur();
    onReset?.();
  };

  // Display logic: while recording show current partial, else committed binding
  const partialDisplay = formatDisplay(Array.from(modKeys), mainKey, platform);
  const shown = recording ? partialDisplay || '' : keybindings || '';

  // Description messaging
  let description: React.ReactNode;
  if (keybindings) {
    description = 'Hotkey captured. Click Reset to change.';
  } else if (recording) {
    if (!modKeys.size && !mainKey)
      description = "Waiting for keys...";
    else if (mainKey && !modKeys.size)
      description = 'At least one modifier key is required. Up to 2 allowed.';
    else if (modKeys.size > 0 && !mainKey) description = 'At least one main key is required.';
    else description = 'Hotkey captured';
  } else {
    description = 'Click the input to start recording a hotkey.';
  }

  return (
    <>
      <div className={`flex items-center gap-2 ${className || ''}`}>
        <Input
          ref={inputRef}
          value={shown}
          placeholder={placeholder}
          readOnly
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={onKeyDown}
          disabled={!!disabled}
          autoFocus={autoFocus}
          aria-label="Hotkey recorder"
          className="max-w-[260px]"
          variant="bordered"
        />
        <Button onPress={handleReset}>Reset</Button>
      </div>
      <div className="text-xs text-gray-500 ml-1">{description}</div>
    </>
  );
};

export default HotkeyRecorder;
