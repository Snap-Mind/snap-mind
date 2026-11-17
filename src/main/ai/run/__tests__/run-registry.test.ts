import { describe, it, expect } from 'vitest';
import { RunRegistry } from '../run-registry.js';

describe('RunRegistry', () => {
  it('abort parent aborts child signal', () => {
    const registry = new RunRegistry();
    registry.open('parent', null);
    const childSignal = registry.open('child', 'parent');

    expect(childSignal.aborted).toBe(false);
    registry.abort('parent');
    expect(childSignal.aborted).toBe(true);
  });

  it('abort child leaves parent signal', () => {
    const registry = new RunRegistry();
    const parentSignal = registry.open('parent', null);
    registry.open('child', 'parent');

    registry.abort('child');
    expect(parentSignal.aborted).toBe(false);
  });

  it('abortAll aborts every open run', () => {
    const registry = new RunRegistry();
    const sig1 = registry.open('run1', null);
    const sig2 = registry.open('run2', null);
    const sig3 = registry.open('run3', 'run1');

    registry.abortAll();
    expect(sig1.aborted).toBe(true);
    expect(sig2.aborted).toBe(true);
    expect(sig3.aborted).toBe(true);
  });

  it('close removes run (isOpen false)', () => {
    const registry = new RunRegistry();
    registry.open('run1', null);
    expect(registry.isOpen('run1')).toBe(true);

    registry.close('run1');
    expect(registry.isOpen('run1')).toBe(false);
  });

  it('open child of an already-aborted parent returns an aborted signal', () => {
    const registry = new RunRegistry();
    registry.open('parent', null);
    registry.abort('parent');

    const childSignal = registry.open('child', 'parent');
    expect(childSignal.aborted).toBe(true);
  });

  it('abort unknown id is a no-op', () => {
    const registry = new RunRegistry();
    // Should not throw
    expect(() => registry.abort('nonexistent')).not.toThrow();
  });
});
