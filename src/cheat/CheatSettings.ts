import {
  litCountForMultiplier,
  MULTIPLIER_TIERS,
  MULTIPLIER_WEIGHTS,
  pickRandomLitTunnels,
  pickWeightedMultiplier,
  RoundResultData,
  rollRound,
  TUNNEL_COUNT,
} from '../rng/RoundResult';

export type CheatRollMode = 'game' | 'weighted' | 'manual';

export interface CheatSettings {
  /** When true, resolveRound() uses weighted/manual cheat rules. */
  overrideEnabled: boolean;
  mode: CheatRollMode;
  /** Percent weights aligned with MULTIPLIER_TIERS. */
  weights: number[];
  manualMultiplier: number;
  /** Per-slot lit state for manual mode. */
  manualTunnels: boolean[];
}

export const cheatSettings: CheatSettings = {
  overrideEnabled: false,
  mode: 'weighted',
  weights: [...MULTIPLIER_WEIGHTS],
  manualMultiplier: 10,
  manualTunnels: Array.from({ length: TUNNEL_COUNT }, () => false),
};

export function resetCheatSettings(): void {
  cheatSettings.overrideEnabled = false;
  cheatSettings.mode = 'weighted';
  cheatSettings.weights = [...MULTIPLIER_WEIGHTS];
  cheatSettings.manualMultiplier = 10;
  cheatSettings.manualTunnels = Array.from({ length: TUNNEL_COUNT }, () => false);
}

export function normalizeCheatWeights(): number[] {
  const sum = cheatSettings.weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    return [...MULTIPLIER_WEIGHTS];
  }
  return cheatSettings.weights.map((w) => (w / sum) * 100);
}

export function resolveRound(rng: () => number = Math.random): RoundResultData {
  if (!cheatSettings.overrideEnabled || cheatSettings.mode === 'game') {
    return rollRound(rng);
  }

  if (cheatSettings.mode === 'manual') {
    const winningTunnels = cheatSettings.manualTunnels
      .map((lit, index) => (lit ? index : -1))
      .filter((index) => index >= 0);
    return {
      winningTunnels,
      multiplier: cheatSettings.manualMultiplier,
    };
  }

  const weights = normalizeCheatWeights();
  const multiplier = pickWeightedMultiplier(rng, weights);
  const litCount = litCountForMultiplier(multiplier);
  return {
    winningTunnels: pickRandomLitTunnels(litCount, rng),
    multiplier,
  };
}

export function setManualTunnel(index: number, lit: boolean): void {
  if (index < 0 || index >= TUNNEL_COUNT) return;
  cheatSettings.manualTunnels[index] = lit;
}

export function toggleManualTunnel(index: number): void {
  setManualTunnel(index, !cheatSettings.manualTunnels[index]);
}

export function setManualLitCountFromMultiplier(multiplier: number): void {
  cheatSettings.manualMultiplier = multiplier;
  const litCount = litCountForMultiplier(multiplier);
  cheatSettings.manualTunnels = Array.from({ length: TUNNEL_COUNT }, (_, i) => i < litCount);
}

export type { RoundResultData } from '../rng/RoundResult';
export { MULTIPLIER_TIERS, TUNNEL_COUNT };
