/** A single click ripple — stores origin and birth timestamp. */
export interface Ripple {
  x: number;
  y: number;
  /** performance.now() at creation time. */
  start: number;
}

/**
 * Pure function that computes the ripple ring force on a single dot at index i.
 *
 * The ripple is an expanding ring of width `width` px. A dot only feels force
 * when it falls within the ring band. Force fades linearly over ripple lifetime.
 *
 * @param rippleMul - Amplification factor when multiple ripples are active.
 */
export function applyRippleForce(
  i: number,
  baseX: Float32Array,
  baseY: Float32Array,
  ripple: Ripple,
  now: number,
  speed: number,
  width: number,
  force: number,
  duration: number,
  rippleMul: number,
): { fx: number; fy: number } {
  const elapsed = now - ripple.start;
  const radius = (elapsed / 1000) * speed;
  const life = 1 - elapsed / duration;

  const sx = (baseX[i] ?? 0) - ripple.x;
  const sy = (baseY[i] ?? 0) - ripple.y;
  const d = Math.sqrt(sx * sx + sy * sy);

  if (d < 0.1) return { fx: 0, fy: 0 };

  const band = Math.abs(d - radius);
  if (band >= width) return { fx: 0, fy: 0 };

  const wf = (1 - band / width) * life * force * rippleMul;
  return { fx: (sx / d) * wf, fy: (sy / d) * wf };
}

/**
 * Removes expired ripples in-place (mutates the array).
 * Call this once per frame before processing forces.
 */
export function pruneExpiredRipples(ripples: Ripple[], now: number, duration: number): void {
  for (let k = ripples.length - 1; k >= 0; k--) {
    if (now - (ripples[k]?.start ?? 0) >= duration) ripples.splice(k, 1);
  }
}
