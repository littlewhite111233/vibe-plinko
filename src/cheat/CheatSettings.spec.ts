import { describe, expect, it } from 'vitest';
import { cheatSettings, resolveRound, resetCheatSettings } from './CheatSettings';

describe('resolveRound cheat', () => {
  it('uses manual multiplier and tunnel picks', () => {
    resetCheatSettings();
    cheatSettings.overrideEnabled = true;
    cheatSettings.mode = 'manual';
    cheatSettings.manualMultiplier = 6;
    cheatSettings.manualTunnels = [
      false,
      true,
      false,
      true,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ];

    const result = resolveRound(() => 0);
    expect(result.multiplier).toBe(6);
    expect(result.winningTunnels).toEqual([1, 3]);
  });
});
