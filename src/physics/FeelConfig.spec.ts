import { describe, expect, it } from 'vitest';
import {
  chargePullRatio,
  computeLaunchVelocity,
  curveLaunchPower,
  FEEL,
  pegClearsLaneWall,
  pegClearsLeftWall,
  pegFitsInField,
} from './FeelConfig';

describe('curveLaunchPower', () => {
  it('smoothsteps 0→1 with softer low end', () => {
    expect(curveLaunchPower(0)).toBe(0);
    expect(curveLaunchPower(1)).toBe(1);
    expect(curveLaunchPower(0.5)).toBeGreaterThan(0.4);
    expect(curveLaunchPower(0.5)).toBeLessThan(0.6);
  });
});

describe('chargePullRatio', () => {
  it('ramps linearly 0→1→0 over one full cycle', () => {
    const half = FEEL.charge.halfCycleMs;
    expect(chargePullRatio(0)).toBe(0);
    expect(chargePullRatio(half / 2)).toBeCloseTo(0.5);
    expect(chargePullRatio(half)).toBeCloseTo(1);
    expect(chargePullRatio(half * 1.5)).toBeCloseTo(0.5);
    expect(chargePullRatio(half * 2)).toBeCloseTo(0);
  });
});

describe('computeLaunchVelocity', () => {
  it('returns null for tap pulls and scales quadratically to max', () => {
    expect(computeLaunchVelocity(0)).toBeNull();
    expect(computeLaunchVelocity(0.04)).toBeNull();
    const mid = computeLaunchVelocity(0.5);
    const full = computeLaunchVelocity(1);
    expect(mid).not.toBeNull();
    expect(full).not.toBeNull();
    expect(Math.abs(mid!.vx)).toBeLessThan(Math.abs(full!.vx));
    expect(Math.abs(mid!.vy)).toBeLessThan(Math.abs(full!.vy));
    expect(full!.vx).toBeCloseTo(FEEL.launch.maxVx);
    expect(full!.vy).toBeCloseTo(FEEL.launch.maxVy);
  });
});

describe('pegClearsLaneWall', () => {
  it('rejects right-column pegs that wedge against the lane divider', () => {
    expect(pegClearsLaneWall(412, FEEL.washer.circleRadius)).toBe(false);
    expect(pegClearsLaneWall(388, FEEL.peg.circleRadius)).toBe(true);
  });
});

describe('pegClearsLeftWall', () => {
  it('rejects left-column pegs that wedge against the left rail', () => {
    expect(pegClearsLeftWall(28, FEEL.washer.circleRadius)).toBe(false);
    expect(pegClearsLeftWall(52, FEEL.peg.circleRadius)).toBe(true);
  });
});

describe('pegFitsInField', () => {
  it('requires clearance on both sides', () => {
    expect(pegFitsInField(28, FEEL.washer.circleRadius)).toBe(false);
    expect(pegFitsInField(412, FEEL.washer.circleRadius)).toBe(false);
    expect(pegFitsInField(76, FEEL.peg.circleRadius)).toBe(true);
  });
});
