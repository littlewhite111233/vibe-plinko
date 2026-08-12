/** Tuned arcade feel — single place to tweak ball / peg / launch behavior. */
export const FEEL = {
  ball: {
    circleRadius: 7,
    restitution: 0.18,
    friction: 0.002,
    frictionAir: 0.007,
    density: 0.002,
  },
  peg: {
    circleRadius: 5,
    restitution: 0.14,
    friction: 0.03,
  },
  washer: {
    circleRadius: 6,
    restitution: 0.48,
    friction: 0.015,
  },
  launch: {
    maxVy: -44,
    maxVx: -7.2,
    /** Below this pull ratio the plunger does not release the ball. */
    minPull: 0.08,
  },
  /** Plunger-style charge: linear 0→full→0 loop while held. */
  charge: {
    halfCycleMs: 1200,
  },
  maxSpeed: 48,
  stuckAfterMs: 500,
  stuckMoveEpsilon: 2.5,
  pegFieldTop: 317,
  pegFieldBottom: 648,
  tunnelY: 648,
  /** Shooter-lane divider — pegs must leave this much air for the ball. */
  laneGuideX: 436,
  laneWallClearance: 22,
} as const;

export const LANE_GUIDE_X = FEEL.laneGuideX;

/** Keep pegs out of the peg/lane crevice where the ball wedges. */
export function pegClearsLaneWall(
  px: number,
  pegRadius: number,
  clearance: number = FEEL.laneWallClearance
): boolean {
  return px + pegRadius + FEEL.ball.circleRadius + clearance < LANE_GUIDE_X;
}

export function curveLaunchPower(raw: number): number {
  const t = Math.min(1, Math.max(0, raw));
  // Smoothstep — finer control at low charge, punchy at max.
  return t * t * (3 - 2 * t);
}

/** Triangle wave 0→1→0 for looping plunger pull (elapsed ms since hold began). */
export function chargePullRatio(
  elapsedMs: number,
  halfCycleMs: number = FEEL.charge.halfCycleMs
): number {
  const period = halfCycleMs * 2;
  const mod = ((elapsedMs % period) + period) % period;
  const phase = mod / halfCycleMs;
  if (phase <= 1) return phase;
  return 2 - phase;
}

export function computeLaunchVelocity(
  power: number
): { vx: number; vy: number } | null {
  const t = Math.min(1, Math.max(0, power));
  if (t < FEEL.launch.minPull) return null;
  // Quadratic-ish: tap stays weak, mid/full a bit punchier.
  const e = Math.pow(t, 1.75);
  return {
    vx: FEEL.launch.maxVx * e,
    vy: FEEL.launch.maxVy * e,
  };
}

export function ballBodyOptions(label = 'ball') {
  return {
    circleRadius: FEEL.ball.circleRadius,
    restitution: FEEL.ball.restitution,
    friction: FEEL.ball.friction,
    frictionAir: FEEL.ball.frictionAir,
    density: FEEL.ball.density,
    label,
  };
}
