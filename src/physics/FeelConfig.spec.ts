import { describe, expect, it } from 'vitest';
import { computeLaunchVelocity, curveLaunchPower } from './FeelConfig';

describe('curveLaunchPower', () => {
  it('smoothsteps 0→1 with softer low end', () => {
    expect(curveLaunchPower(0)).toBe(0);
    expect(curveLaunchPower(1)).toBe(1);
    expect(curveLaunchPower(0.5)).toBeGreaterThan(0.4);
    expect(curveLaunchPower(0.5)).toBeLessThan(0.6);
  });
});

describe('computeLaunchVelocity', () => {
  it('adds leftward vx and upward vy that scale with power', () => {
    const low = computeLaunchVelocity(0.1);
    const high = computeLaunchVelocity(1);
    expect(low.vx).toBeGreaterThan(high.vx);
    expect(low.vy).toBeGreaterThan(high.vy);
    expect(high.vx).toBeLessThan(0);
  });
});
