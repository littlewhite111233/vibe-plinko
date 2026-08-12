export const TUNNEL_COUNT = 12;

export const MULTIPLIER_TIERS = [2, 4, 6, 8, 10] as const;

/** Tier weights in percent: 2×40%, 4×30%, 6×20%, 8×5%, 10×5%. */
export const MULTIPLIER_WEIGHTS: readonly number[] = [40, 30, 20, 5, 5];

export interface RoundResultData {
  winningTunnels: number[];
  multiplier: number;
}

/** 2×→4灯, 4×→3灯, 6×→2灯, 8×/10×→1灯 */
export function litCountForMultiplier(multiplier: number): number {
  if (multiplier === 2) return 4;
  if (multiplier === 4) return 3;
  if (multiplier === 6) return 2;
  return 1;
}

/** Uniform random subset of `litCount` slots from all tunnel positions. */
export function pickRandomLitTunnels(
  litCount: number,
  rng: () => number = Math.random
): number[] {
  const slots = Array.from({ length: TUNNEL_COUNT }, (_, i) => i);
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = slots[i]!;
    slots[i] = slots[j]!;
    slots[j] = tmp;
  }
  return slots.slice(0, litCount).sort((a, b) => a - b);
}

export function pickWeightedMultiplier(
  rng: () => number = Math.random,
  weights: readonly number[] = MULTIPLIER_WEIGHTS
): number {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) {
    return MULTIPLIER_TIERS[0] ?? 2;
  }
  const roll = rng() * total;
  let cumulative = 0;
  for (let i = 0; i < MULTIPLIER_TIERS.length; i++) {
    cumulative += weights[i] ?? 0;
    if (roll < cumulative) {
      return MULTIPLIER_TIERS[i] ?? 2;
    }
  }
  return MULTIPLIER_TIERS[MULTIPLIER_TIERS.length - 1] ?? 2;
}

/**
 * Weighted random multiplier tier, then purely random lit positions among all 12 slots.
 */
export function rollRound(rng: () => number = Math.random): RoundResultData {
  const multiplier = pickWeightedMultiplier(rng);
  const litCount = litCountForMultiplier(multiplier);
  const winningTunnels = pickRandomLitTunnels(litCount, rng);

  return { winningTunnels, multiplier };
}
