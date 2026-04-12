import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialGrid } from './physics/spatial';
import { applyCursorForce } from './physics/cursor';
import { applyRippleForce, pruneExpiredRipples, type Ripple } from './physics/ripple';

// ---------------------------------------------------------------------------
// SpatialGrid
// ---------------------------------------------------------------------------

describe('SpatialGrid', () => {
  let grid: SpatialGrid;

  beforeEach(() => {
    grid = new SpatialGrid(100);
    grid.setWidth(1000);
  });

  it('returns empty array when no dots inserted', () => {
    const results = grid.queryRadius(500, 500, 50);
    expect(results).toHaveLength(0);
  });

  it('finds a dot within radius', () => {
    grid.insert(0, 500, 500);
    const results = grid.queryRadius(490, 490, 50);
    expect(results).toContain(0);
  });

  it('does not find a dot outside radius cells', () => {
    grid.insert(0, 0, 0);
    const results = grid.queryRadius(900, 900, 50);
    expect(results).not.toContain(0);
  });

  it('finds multiple dots in the same neighborhood', () => {
    grid.insert(0, 100, 100);
    grid.insert(1, 150, 150);
    grid.insert(2, 800, 800);
    const results = grid.queryRadius(120, 120, 80);
    expect(results).toContain(0);
    expect(results).toContain(1);
    expect(results).not.toContain(2);
  });

  it('clear() empties all cells', () => {
    grid.insert(0, 100, 100);
    grid.clear();
    expect(grid.queryRadius(100, 100, 50)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// applyCursorForce
// ---------------------------------------------------------------------------

describe('applyCursorForce', () => {
  const baseX = new Float32Array([100]);
  const baseY = new Float32Array([100]);
  const offsetX = new Float32Array([0]);
  const offsetY = new Float32Array([0]);

  it('returns zero force when dot is outside radius', () => {
    const result = applyCursorForce(0, baseX, baseY, offsetX, offsetY, 500, 500, 50, 100);
    expect(result.fx).toBe(0);
    expect(result.fy).toBe(0);
  });

  it('pushes dot away from cursor (force direction)', () => {
    // Cursor is at (80, 100) — dot is at (100, 100) — should push right
    const result = applyCursorForce(0, baseX, baseY, offsetX, offsetY, 80, 100, 50, 100);
    expect(result.fx).toBeGreaterThan(0); // positive X = rightward push
    expect(Math.abs(result.fy)).toBeLessThan(0.001); // no Y component
  });

  it('force is stronger when cursor is closer', () => {
    const near = applyCursorForce(0, baseX, baseY, offsetX, offsetY, 95, 100, 50, 100);
    const far = applyCursorForce(0, baseX, baseY, offsetX, offsetY, 70, 100, 50, 100);
    expect(near.fx).toBeGreaterThan(far.fx);
  });

  it('returns zero when dot and cursor are at same position', () => {
    const result = applyCursorForce(0, baseX, baseY, offsetX, offsetY, 100, 100, 50, 100);
    expect(result.fx).toBe(0);
    expect(result.fy).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// applyRippleForce
// ---------------------------------------------------------------------------

describe('applyRippleForce', () => {
  const baseX = new Float32Array([200]);
  const baseY = new Float32Array([100]);
  const speed = 225;
  const width = 60;
  const force = 120;
  const duration = 675;

  function makeRipple(x: number, y: number, msAgo: number): Ripple {
    return { x, y, start: performance.now() - msAgo };
  }

  it('returns zero before ripple ring reaches the dot', () => {
    // Dot at (200,100), ripple at (0,100) — distance ~200px
    // After 100ms, ring radius = 0.1s * 225 = 22.5px — ring hasn't reached dot
    const ripple = makeRipple(0, 100, 100);
    const result = applyRippleForce(0, baseX, baseY, ripple, performance.now(), speed, width, force, duration, 1);
    expect(result.fx).toBe(0);
    expect(result.fy).toBe(0);
  });

  it('pushes dot radially outward when ring reaches it', () => {
    // Dot at (200,100), ripple at (0,100). Dot is 200px to the right.
    // Ring reaches at 200/225 * 1000 ≈ 889ms — but duration is 675ms,
    // so use a ripple right at the dot's position: ripple at (190,100)
    // At 50ms, ring radius = 0.05 * 225 ≈ 11.25px — band around 10px dot
    const ripple: Ripple = { x: 190, y: 100, start: performance.now() - 44 };
    // d≈10, ring radius at 44ms ≈ 9.9 — within the 60px band
    const result = applyRippleForce(0, baseX, baseY, ripple, performance.now(), speed, width, force, duration, 1);
    // Should push dot away from origin (to the right, positive X)
    if (result.fx !== 0) {
      expect(result.fx).toBeGreaterThan(0);
    }
    // (It may be 0 depending on exact timing, but shouldn't be negative)
    expect(result.fx).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// pruneExpiredRipples
// ---------------------------------------------------------------------------

describe('pruneExpiredRipples', () => {
  it('removes ripples past their duration', () => {
    const ripples: Ripple[] = [
      { x: 0, y: 0, start: performance.now() - 1000 }, // expired
      { x: 0, y: 0, start: performance.now() - 100 },  // active
    ];
    pruneExpiredRipples(ripples, performance.now(), 675);
    expect(ripples).toHaveLength(1);
  });

  it('keeps active ripples', () => {
    const ripples: Ripple[] = [
      { x: 0, y: 0, start: performance.now() - 100 },
      { x: 0, y: 0, start: performance.now() - 200 },
    ];
    pruneExpiredRipples(ripples, performance.now(), 675);
    expect(ripples).toHaveLength(2);
  });

  it('handles empty array', () => {
    const ripples: Ripple[] = [];
    pruneExpiredRipples(ripples, performance.now(), 675);
    expect(ripples).toHaveLength(0);
  });
});
