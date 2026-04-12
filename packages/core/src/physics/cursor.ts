/**
 * Pure function that computes the cursor repulsion force on a single dot.
 * Returns zero force when the dot is outside the cursor radius.
 *
 * Force model: cubic falloff — strongest at center, zero at radius edge.
 */
export function applyCursorForce(
  i: number,
  baseX: Float32Array,
  baseY: Float32Array,
  offsetX: Float32Array,
  offsetY: Float32Array,
  cursorX: number,
  cursorY: number,
  radius: number,
  force: number,
): { fx: number; fy: number } {
  const vx = (baseX[i] ?? 0) + (offsetX[i] ?? 0) - cursorX;
  const vy = (baseY[i] ?? 0) + (offsetY[i] ?? 0) - cursorY;
  const d2 = vx * vx + vy * vy;

  if (d2 < 0.1 || d2 >= radius * radius) return { fx: 0, fy: 0 };

  const d = Math.sqrt(d2);
  // Cubic falloff: (1 - d/r)³ — smooth and perceptually natural
  const f = Math.pow(1 - d / radius, 3) * force;

  return { fx: (vx / d) * f, fy: (vy / d) * f };
}
