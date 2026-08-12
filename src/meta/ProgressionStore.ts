import { applyBeadLoss } from './PointsEconomy';

export const ENERGY_MAX = 10;
export const LOSS_PER_ENERGY = 100;export const STORAGE_KEY = 'superball_meta';

export interface InventoryState {
  extraLight: number;
  doubleMult: number;
}

export interface ProgressionState {
  points: number;
  energy: number;
  lossAccumulator: number;
  inventory: InventoryState;
}

const DEFAULT_STATE: ProgressionState = {
  points: 0,
  energy: 0,
  lossAccumulator: 0,
  inventory: { extraLight: 0, doubleMult: 0 },
};

let _state: ProgressionState = { ...DEFAULT_STATE, inventory: { ...DEFAULT_STATE.inventory } };

export function getProgressionState(): Readonly<ProgressionState> {
  return _state;
}

export function setProgressionState(next: ProgressionState): void {
  _state = {
    points: Math.max(0, next.points),
    energy: Math.min(ENERGY_MAX, Math.max(0, next.energy)),
    lossAccumulator: Math.max(0, Math.min(LOSS_PER_ENERGY - 1, next.lossAccumulator)),
    inventory: {
      extraLight: Math.max(0, next.inventory.extraLight),
      doubleMult: Math.max(0, next.inventory.doubleMult),
    },
  };
  saveProgression();
}

export function addPoints(amount: number): void {
  if (amount <= 0) return;
  _state.points += amount;
  saveProgression();
}

export function spendPoints(amount: number): boolean {
  if (amount <= 0 || _state.points < amount) return false;
  _state.points -= amount;
  saveProgression();
  return true;
}

export function addInventoryItem(key: keyof InventoryState, amount = 1): void {
  _state.inventory[key] += amount;
  saveProgression();
}

export function updateInventory(next: InventoryState): void {
  _state.inventory = {
    extraLight: Math.max(0, next.extraLight),
    doubleMult: Math.max(0, next.doubleMult),
  };
  saveProgression();
}

export function consumeEnergyForMiniGame(): boolean {
  if (_state.energy < ENERGY_MAX) return false;
  _state.energy = 0;
  saveProgression();
  return true;
}

export function recordBeadLoss(amount: number): { triggerMiniGame: boolean } {
  const result = applyBeadLoss(amount, _state);
  saveProgression();
  return { triggerMiniGame: result.triggerMiniGame };
}

export function loadProgression(): ProgressionState {  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setProgressionState(DEFAULT_STATE);
      return getProgressionState() as ProgressionState;
    }
    const parsed = JSON.parse(raw) as Partial<ProgressionState>;
    setProgressionState({
      points: parsed.points ?? 0,
      energy: parsed.energy ?? 0,
      lossAccumulator: parsed.lossAccumulator ?? 0,
      inventory: {
        extraLight: parsed.inventory?.extraLight ?? 0,
        doubleMult: parsed.inventory?.doubleMult ?? 0,
      },
    });
  } catch {
    setProgressionState(DEFAULT_STATE);
  }
  return getProgressionState() as ProgressionState;
}

export function saveProgression(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
  } catch {
    // Graceful fail per AGENTS.md
  }
}

/** Test helper */
export function resetProgressionForTests(): void {
  _state = {
    points: 0,
    energy: 0,
    lossAccumulator: 0,
    inventory: { extraLight: 0, doubleMult: 0 },
  };
}
