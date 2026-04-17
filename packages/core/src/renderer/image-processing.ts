/**
 * CPU-side image processing pipeline for the image-particle effect.
 *
 * Pure functions extracted from the old Canvas2D ImageParticleEffect.
 * Runs once on mount/resize — not per-frame. The output feeds into
 * ImageParticleRenderNode which uploads positions to the GPU.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GrayscaleResult {
  grayscale: Uint8Array;
  alpha: Uint8Array;
  width: number;
  height: number;
}

export interface ParticleData {
  baseX: Float32Array;
  baseY: Float32Array;
  colorIndices: Float32Array;
  count: number;
  dotSize: number;
}

// ---------------------------------------------------------------------------
// Image loading
// ---------------------------------------------------------------------------

export function fetchImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (src.startsWith('http')) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error(`[KineticOS] Failed to load image: ${src} — ${err}`));
    img.src = src;
  });
}

// ---------------------------------------------------------------------------
// Grayscale conversion with contrast/gamma/blur
// ---------------------------------------------------------------------------

export function toGrayscaleGrid(
  img: HTMLImageElement,
  maxDim: number,
  contrast: number,
  gamma: number,
  blur: number,
): GrayscaleResult {
  const aspect = img.naturalWidth / img.naturalHeight;
  const outW = aspect >= 1 ? maxDim : Math.round(maxDim * aspect);
  const outH = aspect >= 1 ? Math.round(maxDim / aspect) : maxDim;

  const alphaCanvas = document.createElement('canvas');
  alphaCanvas.width = outW;
  alphaCanvas.height = outH;
  const alphaCtx = alphaCanvas.getContext('2d')!;
  alphaCtx.imageSmoothingEnabled = true;
  alphaCtx.imageSmoothingQuality = 'high';
  alphaCtx.drawImage(img, 0, 0, outW, outH);
  const alphaData = alphaCtx.getImageData(0, 0, outW, outH).data;

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

// ---------------------------------------------------------------------------
// Floyd-Steinberg error diffusion dithering
// ---------------------------------------------------------------------------

export function errorDiffusionDither(
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

// ---------------------------------------------------------------------------
// Mask inversion — fills dark areas instead of bright areas
// ---------------------------------------------------------------------------

export function applyMaskInversion(
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
// Particle data builder — produces GPU-ready arrays
// ---------------------------------------------------------------------------

export function buildParticleData(
  points: Float32Array,
  scaleFactor: number,
  dotScale: number,
  originX: number,
  originY: number,
  colorsCount: number,
): ParticleData {
  const count = points.length / 2;
  const baseX = new Float32Array(count);
  const baseY = new Float32Array(count);
  const colorIndices = new Float32Array(count);

  const effectiveColors = Math.max(1, Math.min(colorsCount, 6));

  for (let i = 0; i < count; i++) {
    baseX[i] = originX + (points[i * 2] ?? 0) * scaleFactor;
    baseY[i] = originY + (points[i * 2 + 1] ?? 0) * scaleFactor;
    colorIndices[i] = Math.floor(Math.random() * effectiveColors);
  }

  return {
    baseX,
    baseY,
    colorIndices,
    count,
    dotSize: scaleFactor * dotScale,
  };
}
