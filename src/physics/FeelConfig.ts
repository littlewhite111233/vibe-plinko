/** Tuned arcade feel — single place to tweak ball / peg / launch behavior. */
export const FEEL = {
  ball: {
    circleRadius: 7,
    restitution: 0.26,
    friction: 0.001,
    frictionAir: 0.007,
    density: 0.002,
  },
  peg: {
    circleRadius: 5,
    restitution: 0.24,
    friction: 0.008,
  },
  washer: {
    circleRadius: 6,
    restitution: 0.72,
    friction: 0.005,
  },
  launch: {
    maxVy: -48,
    maxVx: -10,
    /** Below this pull ratio the plunger does not release the ball. */
    minPull: 0.08,
    /** At minPull, vy is this fraction of maxVy — must reach laneGuideTopY from spring. */
    minVyFrac: 0.46,
    /** Horizontal impulse stays small until mid/high pull (right vs left slots). */
    minVxFrac: 0.05,
    vyPower: 1.15,
    vxPower: 2.25,
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
  /** Top of shooter-lane divider — start lower so ball can escape into playfield. */
  laneGuideTopY: 350,
  /** Curved deflector at top-right of shooter lane (visual + physics). */
  topTrack: {
    innerX: 380,
    topY: 154,
    outerX: 470,
    bottomY: 260,
    controlY: 180,
  },
  /** Shooter-lane divider — pegs must leave this much air for the ball. */
  laneGuideX: 436,
  playfieldLeftX: 10,
  laneWallClearance: 22,
  leftWallClearance: 22,
} as const;

export const LANE_GUIDE_X = FEEL.laneGuideX;
export const PLAYFIELD_LEFT_X = FEEL.playfieldLeftX;

/** Keep pegs out of the left rail crevice where the ball wedges. */
export function pegClearsLeftWall(
  px: number,
  pegRadius: number,
  clearance: number = FEEL.leftWallClearance
): boolean {
  return px - pegRadius - FEEL.ball.circleRadius - clearance > FEEL.playfieldLeftX;
}

/** Keep pegs out of the peg/lane crevice where the ball wedges. */
export function pegClearsLaneWall(
  px: number,
  pegRadius: number,
  clearance: number = FEEL.laneWallClearance
): boolean {
  return px + pegRadius + FEEL.ball.circleRadius + clearance < LANE_GUIDE_X;
}

export function pegFitsInField(px: number, pegRadius: number): boolean {
  return pegClearsLeftWall(px, pegRadius) && pegClearsLaneWall(px, pegRadius);
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

  const span = 1 - FEEL.launch.minPull;
  const u = span > 0 ? (t - FEEL.launch.minPull) / span : 1;

  const vyFrac =
    FEEL.launch.minVyFrac + (1 - FEEL.launch.minVyFrac) * Math.pow(u, FEEL.launch.vyPower);
  const vxFrac =
    FEEL.launch.minVxFrac + (1 - FEEL.launch.minVxFrac) * Math.pow(u, FEEL.launch.vxPower);

  return {
    vx: FEEL.launch.maxVx * vxFrac,
    vy: FEEL.launch.maxVy * vyFrac,
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
