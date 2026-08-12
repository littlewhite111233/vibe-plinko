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
    minVy: -22,
    maxVy: -40,
    minVx: -2.5,
    maxVx: -6.5,
  },
  maxSpeed: 48,
  stuckAfterMs: 900,
  pegFieldTop: 317,
  pegFieldBottom: 648,
  tunnelY: 648,
} as const;

export function curveLaunchPower(raw: number): number {
  const t = Math.min(1, Math.max(0, raw));
  // Smoothstep — finer control at low charge, punchy at max.
  return t * t * (3 - 2 * t);
}

export function computeLaunchVelocity(power: number): { vx: number; vy: number } {
  const t = curveLaunchPower(power);
  return {
    vx: FEEL.launch.minVx + (FEEL.launch.maxVx - FEEL.launch.minVx) * t,
    vy: FEEL.launch.minVy + (FEEL.launch.maxVy - FEEL.launch.minVy) * t,
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
