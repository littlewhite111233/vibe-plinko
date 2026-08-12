import { describe, expect, it } from 'vitest';
import { applyBeadLoss, calcPointsFromPayout } from './PointsEconomy';

describe('calcPointsFromPayout', () => {
  it('awards 1 point per 30 beads capped at 5', () => {
    expect(calcPointsFromPayout(29)).toBe(0);
    expect(calcPointsFromPayout(30)).toBe(1);
    expect(calcPointsFromPayout(90)).toBe(3);
    expect(calcPointsFromPayout(150)).toBe(5);
    expect(calcPointsFromPayout(180)).toBe(5);
  });
});

describe('applyBeadLoss', () => {
  it('adds energy every 100 lost beads with remainder', () => {
    const state = { lossAccumulator: 0, energy: 0 };
    applyBeadLoss(50, state);
    expect(state.lossAccumulator).toBe(50);
    expect(state.energy).toBe(0);

    applyBeadLoss(60, state);
    expect(state.lossAccumulator).toBe(10);
    expect(state.energy).toBe(1);
  });

  it('triggers mini-game at 10 energy', () => {
    const state = { lossAccumulator: 0, energy: 9 };
    const result = applyBeadLoss(100, state);
    expect(state.energy).toBe(10);
    expect(result.triggerMiniGame).toBe(true);
  });
});
