import { RoundResultData, TUNNEL_COUNT } from '../rng/RoundResult';
import { InventoryState } from './ProgressionStore';

export interface ModifierUsage {
  usedExtraLight: boolean;
  usedDoubleMult: boolean;
}

export function applyInventoryModifiers(
  round: RoundResultData,
  inventory: InventoryState,
  rng: () => number = Math.random
): { round: RoundResultData; usage: ModifierUsage } {
  let next = round;
  const usage: ModifierUsage = { usedExtraLight: false, usedDoubleMult: false };

  if (inventory.extraLight > 0) {
    const unlit: number[] = [];
    for (let i = 0; i < TUNNEL_COUNT; i++) {
      if (!next.winningTunnels.includes(i)) {
        unlit.push(i);
      }
    }
    if (unlit.length > 0) {
      const pick = unlit[Math.floor(rng() * unlit.length)]!;
      next = {
        ...next,
        winningTunnels: [...next.winningTunnels, pick].sort((a, b) => a - b),
      };
      usage.usedExtraLight = true;
    }
  }

  if (inventory.doubleMult > 0) {
    next = {
      ...next,
      multiplier: Math.min(20, next.multiplier * 2),
    };
    usage.usedDoubleMult = true;
  }

  return { round: next, usage };
}

export function consumeInventory(inventory: InventoryState, usage: ModifierUsage): InventoryState {
  return {
    extraLight: usage.usedExtraLight ? inventory.extraLight - 1 : inventory.extraLight,
    doubleMult: usage.usedDoubleMult ? inventory.doubleMult - 1 : inventory.doubleMult,
  };
}
