// The constant-radius arc law from lib/Motion/Motion.cpp, run as a plain
// simulation so the figures show what the law does, not a hand-drawn curve.
// Units: mm, seconds, degrees. Robot starts at (0, 0) heading +y (forward) and
// turns towards +x. Idealised: the wheels hold exactly `v`, the gyro is exact.

export interface ArcSample {
  t: number;
  x: number;
  y: number;
  heading: number; // deg
  omega: number; // deg/s
}

export interface ArcOptions {
  radius: number; // R, mm
  cap: number; // omega safety cap, deg/s
  speed?: number; // mm/s
  kp?: number; // heading P gain
  alpha?: number; // deg/s^2, slew and taper
  angle?: number; // deg
}

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

export function simulateArc({
  radius,
  cap,
  speed = 250,
  kp = 4,
  alpha = 4000,
  angle = 90,
}: ArcOptions): ArcSample[] {
  const dt = 0.002;
  let t = 0;
  let s = 0;
  let x = 0;
  let y = 0;
  let heading = 0;
  let omega = 0;
  const out: ArcSample[] = [{ t, x, y, heading, omega }];
  while (heading < angle - 1 && t < 3) {
    s += speed * dt;
    const sched = (s / radius) * R2D;
    const ff = (speed / radius) * R2D;
    let want = ff + kp * (sched - heading);
    want = Math.max(-cap, Math.min(cap, want));
    // Land on the angle: ramp omega down as the remaining angle shrinks.
    want = Math.min(want, Math.sqrt(2 * alpha * Math.max(angle - heading, 0)));
    const step = alpha * dt;
    omega = omega < want ? Math.min(omega + step, want) : Math.max(omega - step, want);
    heading += omega * dt;
    t += dt;
    x += speed * Math.sin(heading * D2R) * dt;
    y += speed * Math.cos(heading * D2R) * dt;
    out.push({ t, x, y, heading, omega });
  }
  return out;
}
