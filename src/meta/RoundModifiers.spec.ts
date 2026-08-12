import { describe, expect, it } from 'vitest';
import { applyInventoryModifiers, consumeInventory } from './RoundModifiers';

describe('applyInventoryModifiers', () => {
  it('adds one lit tunnel when extraLight in inventory', () => {
    const base = { winningTunnels: [0, 1, 2, 3], multiplier: 2 };
    const { round, usage } = applyInventoryModifiers(base, { extraLight: 1, doubleMult: 0 }, () => 0);
    expect(round.winningTunnels).toHaveLength(5);
    expect(usage.usedExtraLight).toBe(true);
  });

  it('doubles multiplier capped at 20', () => {
    const base = { winningTunnels: [5], multiplier: 10 };
    const { round, usage } = applyInventoryModifiers(base, { extraLight: 0, doubleMult: 1 }, () => 0);
    expect(round.multiplier).toBe(20);
    expect(usage.usedDoubleMult).toBe(true);
  });

  it('consumes inventory only when modifier applied', () => {
    const usage = { usedExtraLight: true, usedDoubleMult: false };
    const next = consumeInventory({ extraLight: 2, doubleMult: 1 }, usage);
    expect(next.extraLight).toBe(1);
    expect(next.doubleMult).toBe(1);
  });
});
