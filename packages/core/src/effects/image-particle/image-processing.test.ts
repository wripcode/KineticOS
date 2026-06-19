import { describe, it, expect } from 'vitest';
import {
  errorDiffusionDither,
  applyMaskInversion,
  buildParticleData,
} from './image-processing';

// ---------------------------------------------------------------------------
// errorDiffusionDither
// ---------------------------------------------------------------------------

describe('errorDiffusionDither', () => {
  it('returns empty array for fully transparent image', () => {
    const w = 4;
    const h = 4;
    const grayscale = new Uint8Array(w * h).fill(255);
    const alpha = new Uint8Array(w * h).fill(0); // fully transparent
    const result = errorDiffusionDither(grayscale, w, h, 128, 1.0, true, alpha);
    expect(result.length).toBe(0);
  });

  it('returns points for a fully white opaque image above threshold', () => {
    const w = 4;
    const h = 4;
    const grayscale = new Uint8Array(w * h).fill(255);
    const alpha = new Uint8Array(w * h).fill(255);
    const result = errorDiffusionDither(grayscale, w, h, 128, 1.0, true, alpha);
    // All pixels are white (255 > threshold 128) — should produce points
    expect(result.length).toBeGreaterThan(0);
    expect(result.length % 2).toBe(0); // pairs of (x, y)
  });

  it('returns no points for a fully black opaque image below threshold', () => {
    const w = 4;
    const h = 4;
    const grayscale = new Uint8Array(w * h).fill(0);
    const alpha = new Uint8Array(w * h).fill(255);
    const result = errorDiffusionDither(grayscale, w, h, 128, 1.0, true, alpha);
    expect(result.length).toBe(0);
  });

  it('produces coordinates within bounds', () => {
    const w = 8;
    const h = 8;
    const grayscale = new Uint8Array(w * h).fill(200);
    const alpha = new Uint8Array(w * h).fill(255);
    const result = errorDiffusionDither(grayscale, w, h, 128, 1.0, false, alpha);
    for (let i = 0; i < result.length; i += 2) {
      expect(result[i]).toBeGreaterThanOrEqual(0);
      expect(result[i]).toBeLessThan(w);
      expect(result[i + 1]).toBeGreaterThanOrEqual(0);
      expect(result[i + 1]).toBeLessThan(h);
    }
  });

  it('serpentine scanning produces the same point count as left-to-right', () => {
    const w = 6;
    const h = 6;
    const grayscale = new Uint8Array(w * h).fill(200);
    const alpha = new Uint8Array(w * h).fill(255);
    const ltr = errorDiffusionDither(grayscale, w, h, 128, 1.0, false, alpha);
    const serpentine = errorDiffusionDither(grayscale, w, h, 128, 1.0, true, alpha);
    // Point counts can differ slightly due to error propagation direction,
    // but should be in the same ballpark (within 20%)
    expect(Math.abs(ltr.length - serpentine.length)).toBeLessThan(ltr.length * 0.2);
  });
});

// ---------------------------------------------------------------------------
// applyMaskInversion
// ---------------------------------------------------------------------------

describe('applyMaskInversion', () => {
  it('produces more points than the original when most pixels are empty', () => {
    const w = 10;
    const h = 10;
    const alpha = new Uint8Array(w * h).fill(255);
    // Only one point in the grid
    const points = new Float32Array([5, 5]);
    const inverted = applyMaskInversion(points, w, h, 0, alpha);
    // Inversion fills the rest of the grid (minus the original point)
    expect(inverted.length / 2).toBeGreaterThan(1);
  });

  it('returns empty when all pixels are already filled', () => {
    const w = 2;
    const h = 2;
    const alpha = new Uint8Array(w * h).fill(255);
    // All 4 positions filled
    const points = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
    const inverted = applyMaskInversion(points, w, h, 0, alpha);
    expect(inverted.length).toBe(0);
  });

  it('respects alpha channel — skips transparent pixels', () => {
    const w = 4;
    const h = 4;
    const alpha = new Uint8Array(w * h).fill(0); // all transparent
    const points = new Float32Array([]);
    const inverted = applyMaskInversion(points, w, h, 0, alpha);
    expect(inverted.length).toBe(0); // transparent pixels are skipped
  });
});

// ---------------------------------------------------------------------------
// buildParticleData
// ---------------------------------------------------------------------------

describe('buildParticleData', () => {
  it('correctly converts grid positions to canvas coordinates', () => {
    // 2 points at (1, 0) and (0, 1) in grid space
    const points = new Float32Array([1, 0, 0, 1]);
    const scale = 2;
    const dotScale = 1;
    const ox = 10;
    const oy = 20;
    const data = buildParticleData(points, scale, dotScale, ox, oy, 1);

    expect(data.count).toBe(2);
    expect(data.baseX[0]).toBeCloseTo(10 + 1 * 2); // ox + x * scale
    expect(data.baseY[0]).toBeCloseTo(20 + 0 * 2);
    expect(data.baseX[1]).toBeCloseTo(10 + 0 * 2);
    expect(data.baseY[1]).toBeCloseTo(20 + 1 * 2);
  });

  it('sets dotSize to scaleFactor * dotScale', () => {
    const points = new Float32Array([0, 0]);
    const data = buildParticleData(points, 3, 2, 0, 0, 1);
    expect(data.dotSize).toBeCloseTo(6);
  });

  it('assigns colorIndices within [0, colorsCount) range', () => {
    const w = 4;
    const h = 4;
    const points = new Float32Array(Array.from({ length: w * h * 2 }, (_, i) => i % 4));
    const data = buildParticleData(points, 1, 1, 0, 0, 3);
    for (let i = 0; i < data.count; i++) {
      expect(data.colorIndices[i]).toBeGreaterThanOrEqual(0);
      expect(data.colorIndices[i]).toBeLessThan(3);
    }
  });

  it('returns zero-count for empty points array', () => {
    const data = buildParticleData(new Float32Array(0), 1, 1, 0, 0, 1);
    expect(data.count).toBe(0);
  });
});
