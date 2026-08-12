import { ENERGY_MAX, LOSS_PER_ENERGY } from './ProgressionStore';

export interface LossTracker {
  lossAccumulator: number;
  energy: number;
}

export function calcPointsFromPayout(payout: number): number {
  if (payout < 30) return 0;
  return Math.min(5, Math.floor(payout / 30));
}

/** Accumulate lost beads; every 100 lost beads adds 1 energy (remainder kept). */
export function applyBeadLoss(
  loss: number,
  state: LossTracker
): { energyGained: number; triggerMiniGame: boolean } {
  if (loss <= 0) {
    return { energyGained: 0, triggerMiniGame: false };
  }

  state.lossAccumulator += loss;
  let energyGained = 0;
  while (state.lossAccumulator >= LOSS_PER_ENERGY) {
    state.lossAccumulator -= LOSS_PER_ENERGY;
    if (state.energy < ENERGY_MAX) {
      state.energy += 1;
      energyGained += 1;
    }
  }

  return {
    energyGained,
    triggerMiniGame: state.energy >= ENERGY_MAX,
  };
}
