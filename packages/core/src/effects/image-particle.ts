import type { ImageParticleConfig } from '../types.js';
import { CanvasEffect } from './base.js';
import { PhysicsModule } from '../physics/index.js';
import { LERP_FACTOR, SNAP_THRESHOLD } from '../constants.js';

// ---------------------------------------------------------------------------
// Image processing pipeline
// ---------------------------------------------------------------------------

interface GrayscaleResult {
  grayscale: Uint8Array;
  alpha: Uint8Array;
  width: number;
  height: number;
}

/**
 * Loads an image from `src`. Skips CORS for data URIs and local paths.
 * The user's updated prototype handles this pattern correctly.
 */
function fetchImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (src.startsWith('http')) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error(`[KineticOS] Failed to load image: ${src} — ${err}`));
    img.src = src;
  });
}

/**
 * Renders the image into a grayscale grid with contrast/gamma/blur applied.
 * Produces a flat Uint8Array of luminance values plus a separate alpha mask.
 */
function toGrayscaleGrid(
  img: HTMLImageElement,
  maxDim: number,
  contrast: number,
  gamma: number,
  blur: number,
): GrayscaleResult {
  const aspect = img.naturalWidth / img.naturalHeight;
  const outW = aspect >= 1 ? maxDim : Math.round(maxDim * aspect);
  const outH = aspect >= 1 ? Math.round(maxDim / aspect) : maxDim;

  // Alpha pass — no blur (we need sharp alpha for mask edges)
  const alphaCanvas = document.createElement('canvas');
  alphaCanvas.width = outW;
  alphaCanvas.height = outH;
  const alphaCtx = alphaCanvas.getContext('2d')!;
  alphaCtx.imageSmoothingEnabled = true;
  alphaCtx.imageSmoothingQuality = 'high';
  alphaCtx.drawImage(img, 0, 0, outW, outH);
  const alphaData = alphaCtx.getImageData(0, 0, outW, outH).data;

  // Blurred luma pass
  const pad = Math.ceil(blur * 3);
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = img.naturalWidth + pad * 2;
  srcCanvas.height = img.naturalHeight + pad * 2;
  const srcCtx = srcCanvas.getContext('2d')!;
  if (blur > 0) srcCtx.filter = `blur(${blur}px)`;
  srcCtx.drawImage(img, pad, pad, img.naturalWidth, img.naturalHeight);
  srcCtx.filter = 'none';

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext('2d')!;
  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = 'high';
  outCtx.drawImage(srcCanvas, pad, pad, img.naturalWidth, img.naturalHeight, 0, 0, outW, outH);

  const pixels = outCtx.getImageData(0, 0, outW, outH).data;
  const grayscale = new Uint8Array(outW * outH);
  const alpha = new Uint8Array(outW * outH);
  const cFactor = contrast !== 0 ? (259 * (contrast + 255)) / (255 * (259 - contrast)) : 1;

  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const idx = (y * outW + x) * 4;
      const blurAlpha = (pixels[idx + 3] ?? 0) / 255;
      alpha[y * outW + x] = alphaData[idx + 3] ?? 0;

      let luma =
        blurAlpha > 0.01
          ? (0.299 * (pixels[idx] ?? 0) +
              0.587 * (pixels[idx + 1] ?? 0) +
              0.114 * (pixels[idx + 2] ?? 0)) /
            blurAlpha
          : 0;

      if (contrast !== 0) luma = cFactor * (luma - 128) + 128;
      if (gamma !== 1.0) luma = 255 * Math.pow(Math.max(0, luma / 255), 1 / gamma);

      grayscale[y * outW + x] = Math.max(0, Math.min(255, Math.round(luma)));
    }
  }

  return { grayscale, alpha, width: outW, height: outH };
}

/**
 * Floyd-Steinberg error diffusion dithering.
 * Returns a flat float array: [x0, y0, x1, y1, ...] of white-dot positions.
 */
function errorDiffusionDither(
  grayscale: Uint8Array,
  width: number,
  height: number,
  threshold: number,
  diffusionStrength: number,
  serpentine: boolean,
  alpha: Uint8Array,
): Float32Array {
  const errors = new Float32Array(grayscale);
  const positions: number[] = [];

  for (let y = 0; y < height; y++) {
    const ltr = !serpentine || y % 2 === 0;
    const startX = ltr ? 0 : width - 1;
    const endX = ltr ? width : -1;
    const step = ltr ? 1 : -1;

    for (let x = startX; x !== endX; x += step) {
      const idx = y * width + x;
      if ((alpha[idx] ?? 0) < 128) continue;

      const oldVal = errors[idx] ?? 0;
      const newVal = oldVal > threshold ? 255 : 0;
      const err = (oldVal - newVal) * diffusionStrength;

      if (newVal > 0) positions.push(x, y);

      const spread = (nx: number, ny: number, weight: number) => {
        if (nx < 0 || nx >= width || ny >= height) return;
        const ni = ny * width + nx;
        if ((alpha[ni] ?? 0) < 128) return;
        errors[ni] = (errors[ni] ?? 0) + err * weight;
      };

      spread(x + step, y, 7 / 16);
      spread(x - step, y + 1, 3 / 16);
      spread(x, y + 1, 5 / 16);
      spread(x + step, y + 1, 1 / 16);
    }
  }

  return new Float32Array(positions);
}

/**
 * Inverts the dither result within a rounded-rect mask.
 * Produces dots where the image is dark, not where it's white.
 */
function applyMaskInversion(
  positions: Float32Array,
  gridW: number,
  gridH: number,
  radiusPct: number,
  alpha: Uint8Array,
): Float32Array {
  const r = Math.round(radiusPct * Math.min(gridW, gridH));
  const mask = new Set<number>();

  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      let inside: boolean;
      if (x >= r && x < gridW - r) {
        inside = true;
      } else if (y >= r && y < gridH - r) {
        inside = true;
      } else {
        const cx = x < r ? r : gridW - r - 1;
        const cy = y < r ? r : gridH - r - 1;
        const dx = x - cx;
        const dy = y - cy;
        inside = dx * dx + dy * dy <= r * r;
      }
      if (inside) mask.add(y * gridW + x);
    }
  }

  const filled = new Set<number>();
  for (let i = 0; i < positions.length; i += 2) {
    filled.add(Math.round(positions[i + 1] ?? 0) * gridW + Math.round(positions[i] ?? 0));
  }

  const result: number[] = [];
  for (const idx of mask) {
    if (!filled.has(idx)) {
      if ((alpha[idx] ?? 0) < 128) continue;
      result.push(idx % gridW, Math.floor(idx / gridW));
    }
  }

  return new Float32Array(result);
}

// ---------------------------------------------------------------------------
// Particle system
// ---------------------------------------------------------------------------

interface ParticleSystem {
  count: number;
  baseX: Float32Array;
  baseY: Float32Array;
  offsetX: Float32Array;
  offsetY: Float32Array;
  brightness: Float32Array;
  tint: Float32Array;
  size: number;
}

function buildParticleSystem(
  points: Float32Array,
  scaleFactor: number,
  dotScale: number,
  originX: number,
  originY: number,
): ParticleSystem {
  const count = points.length / 2;
  const baseX = new Float32Array(count);
  const baseY = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    baseX[i] = originX + (points[i * 2] ?? 0) * scaleFactor;
    baseY[i] = originY + (points[i * 2 + 1] ?? 0) * scaleFactor;
  }

  return {
    count,
    baseX,
    baseY,
    offsetX: new Float32Array(count),
    offsetY: new Float32Array(count),
    brightness: new Float32Array(count).fill(1),
    tint: new Float32Array(count).fill(1),
    size: scaleFactor * dotScale,
  };
}

/**
 * Canvas2D batch renderer for the particle system.
 * Groups particles by brightness/tint bucket to minimize fillStyle changes.
 */
function drawParticles(
  ctx: CanvasRenderingContext2D,
  sys: ParticleSystem,
  invert: boolean,
  canvasW: number,
  canvasH: number,
  dpr: number,
): void {
  ctx.clearRect(0, 0, canvasW * dpr, canvasH * dpr);

  // Invert = true → black dots (on light background)
  // Invert = false → gray dots (on dark background)
  const r = invert ? 0 : 138;
  const g = invert ? 0 : 143;
  const b = invert ? 0 : 152;

  const buckets: number[][] = Array.from({ length: 126 }, () => []);

  for (let i = 0; i < sys.count; i++) {
    const bucket = 6 * Math.round(20 * (sys.brightness[i] ?? 1)) + Math.round(5 * (sys.tint[i] ?? 1));
    const clamped = Math.max(0, Math.min(125, bucket));
    buckets[clamped]!.push(i);
  }

  const size = sys.size * dpr;
  const pad = 0.25 * dpr;
  const padSize = 0.5 * dpr;

  for (let z = 0; z < 126; z++) {
    const ids = buckets[z]!;
    if (ids.length === 0) continue;
    const a = Math.floor(z / 6) / 20;
    ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
    for (const i of ids) {
      const rx = ((sys.baseX[i] ?? 0) + (sys.offsetX[i] ?? 0)) * dpr;
      const ry = ((sys.baseY[i] ?? 0) + (sys.offsetY[i] ?? 0)) * dpr;
      ctx.fillRect(rx - pad, ry - pad, size + padSize, size + padSize);
    }
  }
}

// ---------------------------------------------------------------------------
// Effect class
// ---------------------------------------------------------------------------

/**
 * Converts an SVG or image into an interactive dithered particle field.
 * Uses Canvas2D for rendering — the particle counts are low enough that
 * Canvas2D is performant and avoids WebGL texture complexity.
 */
export class ImageParticleEffect extends CanvasEffect {
  private ctx: CanvasRenderingContext2D | null = null;
  private system: ParticleSystem | null = null;
  private physics: PhysicsModule | null = null;
  private isMobile = window.innerWidth <= 640;

  constructor(private readonly particleConfig: ImageParticleConfig) {
    super(particleConfig);
  }

  protected init(): void {
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) {
      console.error('[KineticOS] Canvas2D not available — image-particle will not render.');
      return;
    }

    this.physics = new PhysicsModule(
      this.particleConfig.physicsValues,
      this.particleConfig.rippleEnabled,
    );
    this.physics.attach(this.canvas);

    void this.rebuild();
  }

  protected onResize(cssW: number, cssH: number): void {
    this.isMobile = window.innerWidth <= 640;
    if (this.system && this.ctx) {
      drawParticles(this.ctx, this.system, this.particleConfig.invert, cssW, cssH, this.dpr);
    }
    // Debounce rebuild — avoid thrashing on resize events
    void this.rebuild();
  }

  protected renderFrame(_dt: number): void {
    if (!this.ctx || !this.system || !this.physics) return;

    const hasMotion = this.physics.tick(
      this.system.baseX,
      this.system.baseY,
      this.system.offsetX,
      this.system.offsetY,
      this.system.count,
    );

    if (hasMotion) {
      const rect = this.canvas.getBoundingClientRect();
      drawParticles(this.ctx, this.system, this.particleConfig.invert, rect.width, rect.height, this.dpr);
    }
  }

  override destroy(): void {
    this.physics?.detach();
    super.destroy();
  }

  // ---------------------------------------------------------------------------
  // Image processing pipeline
  // ---------------------------------------------------------------------------

  private async rebuild(): Promise<void> {
    const { src, invert } = this.particleConfig;
    if (!src) {
      console.warn('[KineticOS] image-particle: ko-src attribute is required');
      return;
    }

    try {
      const img = await fetchImage(src);
      const rect = this.canvas.getBoundingClientRect();

      const processed = toGrayscaleGrid(
        img,
        this.particleConfig.gridSize,
        this.particleConfig.contrast,
        this.particleConfig.gamma,
        this.particleConfig.blur,
      );
      const { width: gw, height: gh } = processed;

      let positions = errorDiffusionDither(
        processed.grayscale,
        gw,
        gh,
        this.particleConfig.threshold,
        this.particleConfig.diffusionStrength,
        this.particleConfig.serpentine,
        processed.alpha,
      );

      if (invert) {
        positions = applyMaskInversion(
          positions,
          gw,
          gh,
          this.particleConfig.cornerRadius,
          processed.alpha,
        );
      }

      const scale = Math.max(
        0.5,
        (Math.min(rect.width, rect.height) * this.particleConfig.scale) / Math.max(gw, gh),
      );
      const ox = Math.round((rect.width - gw * scale) / 2);
      const oy = Math.round((rect.height - gh * scale) / 2);
      const dotScale = this.isMobile
        ? this.particleConfig.dotScale * 0.8
        : this.particleConfig.dotScale;

      this.system = buildParticleSystem(positions, scale, dotScale, ox, oy);

      if (this.physics) {
        this.physics.rebuildSpatial(this.system.baseX, this.system.baseY, this.system.count);
      }
    } catch (err) {
      console.error('[KineticOS] image-particle: failed to process image', err);
    }
  }
}
