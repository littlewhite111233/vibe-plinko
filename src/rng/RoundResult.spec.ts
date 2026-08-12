import { describe, expect, it } from 'vitest';
import {
  litCountForMultiplier,
  MULTIPLIER_TIERS,
  pickRandomLitTunnels,
  pickWeightedMultiplier,
  rollRound,
  TUNNEL_COUNT,
} from './RoundResult';

describe('litCountForMultiplier', () => {
  it('maps payout tier to lit tunnel count', () => {
    expect(litCountForMultiplier(2)).toBe(4);
    expect(litCountForMultiplier(4)).toBe(3);
    expect(litCountForMultiplier(6)).toBe(2);
    expect(litCountForMultiplier(8)).toBe(1);
    expect(litCountForMultiplier(10)).toBe(1);
  });
});

describe('pickRandomLitTunnels', () => {
  it('returns unique in-range slots', () => {
    const tunnels = pickRandomLitTunnels(4, () => 0.3);
    expect(tunnels).toHaveLength(4);
    expect(new Set(tunnels).size).toBe(4);
    for (const t of tunnels) {
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThan(TUNNEL_COUNT);
    }
  });
});

describe('pickWeightedMultiplier', () => {
  it('selects tier by cumulative weight', () => {
    expect(pickWeightedMultiplier(() => 0)).toBe(2);
    expect(pickWeightedMultiplier(() => 0.39)).toBe(2);
    expect(pickWeightedMultiplier(() => 0.4)).toBe(4);
    expect(pickWeightedMultiplier(() => 0.69)).toBe(4);
    expect(pickWeightedMultiplier(() => 0.7)).toBe(6);
    expect(pickWeightedMultiplier(() => 0.89)).toBe(6);
    expect(pickWeightedMultiplier(() => 0.9)).toBe(8);
    expect(pickWeightedMultiplier(() => 0.94)).toBe(8);
    expect(pickWeightedMultiplier(() => 0.95)).toBe(10);
  });
});

describe('rollRound', () => {
  it('pairs tier lit count with uniformly picked positions', () => {
    for (let i = 0; i < 50; i++) {
      const result = rollRound();
      expect(MULTIPLIER_TIERS).toContain(result.multiplier);
      expect(result.winningTunnels).toHaveLength(litCountForMultiplier(result.multiplier));
      expect(new Set(result.winningTunnels).size).toBe(result.winningTunnels.length);
    }
  });
});
