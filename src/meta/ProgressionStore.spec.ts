import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  addPoints,
  getProgressionState,
  loadProgression,
  resetProgressionForTests,
  saveProgression,
  spendPoints,
} from './ProgressionStore';

describe('ProgressionStore', () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
    });
    resetProgressionForTests();
  });

  it('adds and spends points', () => {
    addPoints(50);
    expect(getProgressionState().points).toBe(50);
    expect(spendPoints(20)).toBe(true);
    expect(getProgressionState().points).toBe(30);
    expect(spendPoints(40)).toBe(false);
  });

  it('persists to localStorage', () => {
    addPoints(12);
    saveProgression();
    resetProgressionForTests();
    loadProgression();
    expect(getProgressionState().points).toBe(12);
  });
});
