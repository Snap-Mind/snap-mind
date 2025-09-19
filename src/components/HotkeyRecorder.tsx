import React, { useCallback, useRef, useState } from 'react';
import { Input, Button } from '@heroui/react';

/**
 * HotkeyRecorder
 *  - Start listening when the input is focused.
 *  - The final hotkey = up to 2 modifier keys + 1 non-modifier key (must include at least 1 modifier and 1 non-modifier).
 *  - Modifier key order: (mac) Cmd > Shift > Option > Ctrl; (others) Ctrl > Shift > Alt > Meta.
 *  - Only confirm an attempt after all keys are released; if the rule is satisfied on release, trigger onChange.
 *  - Provide Reset / Confirm buttons.
 *  - Keep the logic as simple as possible.
 */

export interface HotkeyRecorderProps {
  value?: string | null;            // controlled value
  defaultValue?: string | null;     // uncontrolled default
  onChange?: (val: string | null) => void; // fired when a valid combo captured
  onConfirm?: (val: string | null) => void; // user clicks Confirm
  onReset?: () => void;             // user clicks Reset
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
  confirmLabel?: string;
  resetLabel?: string;
}

// We only allow these modifier keys (KeyboardEvent.key lowercased)
const MOD_KEYS = ['meta', 'shift', 'alt', 'control'];
const MOD_SET = new Set(MOD_KEYS);

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
  if (!main) return mods.map(printModifier).join('+');
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
    backspace: 'Backspace'
  };
  return map[k.toLowerCase()] || k;
}

export const HotkeyRecorder: React.FC<HotkeyRecorderProps> = ({
  value,
  defaultValue = null,
  onChange,
  onConfirm,
  onReset,
  placeholder = 'Press a shortcut',
  disabled,
  className,
  autoFocus,
  confirmLabel = 'Confirm',
  resetLabel = 'Reset'
}) => {
  const platform: 'mac' | 'other' = /mac/i.test(navigator.userAgent) ? 'mac' : 'other';
  const [internal, setInternal] = useState<string | null>(defaultValue);
  const currentValue = value !== undefined ? value : internal;

  // Recording buffers
  const pressed = useRef<Set<string>>(new Set());
  const modsRef = useRef<Set<string>>(new Set());
  const mainRef = useRef<string | null>(null);
  const [display, setDisplay] = useState('');
  const [recording, setRecording] = useState(false);

  const commit = useCallback((val: string | null) => {
    if (value === undefined) setInternal(val);
    onChange?.(val);
  }, [onChange, value]);

  const clearAttempt = () => {
    pressed.current.clear();
    modsRef.current.clear();
    mainRef.current = null;
    setDisplay('');
  };

  const handleFocus = () => {
    if (disabled) return;
    setRecording(true);
    clearAttempt();
  };

  const handleBlur = () => {
    setRecording(false);
    clearAttempt();
  };

  function finalizeIfReleased() {
    if (pressed.current.size > 0) return; // still holding something
    // Need at least 1 modifier + 1 main
    if (mainRef.current && modsRef.current.size >= 1) {
      const mods = orderModifiers(Array.from(modsRef.current), platform);
      const combo = formatDisplay(mods, mainRef.current, platform);
      commit(combo);
    }
    clearAttempt();
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!recording || disabled) return;
    e.preventDefault();
    e.stopPropagation();
    const k = e.key;
    if (pressed.current.has(k)) return; // ignore repeats while held
    pressed.current.add(k);

    if (isModifier(k)) {
      if (modsRef.current.size < 2 || modsRef.current.has(k.toLowerCase())) {
        modsRef.current.add(k.toLowerCase());
      }
    } else if (!mainRef.current) {
      mainRef.current = k;
    } else {
      // already have a main key -> ignore any additional non-modifier to keep logic simple
    }

    // Update temporary display
    const mods = Array.from(modsRef.current);
    setDisplay(formatDisplay(mods, mainRef.current, platform));
  };

  const onKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!recording || disabled) return;
    e.preventDefault();
    e.stopPropagation();
    pressed.current.delete(e.key);
    // when all released -> finalize
    finalizeIfReleased();
  };

  const handleReset = () => {
    clearAttempt();
    commit(null);
    onReset?.();
  };

  const handleConfirm = () => {
    onConfirm?.(currentValue ?? null);
  };

  const shown = recording ? (display || '') : (currentValue || '');

  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      <Input
        value={shown}
        placeholder={placeholder}
        readOnly
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        disabled={!!disabled}
        autoFocus={autoFocus}
        aria-label="Hotkey recorder"
        className="max-w-[260px]"
        variant="bordered"
      />
      <Button size="sm" variant="flat" isDisabled={disabled} onPress={handleReset}>{resetLabel}</Button>
      <Button size="sm" color="primary" variant="solid" isDisabled={disabled || !currentValue} onPress={handleConfirm}>{confirmLabel}</Button>
    </div>
  );
};

export default HotkeyRecorder;
