/**
 * ImageParticleRenderNode — per-element state holder for image-particle in the Global Canvas.
 *
 * Owns: config, particle positions, physics, per-node GPU buffers, opacity state, cached rect.
 * Does NOT own: a canvas, a WebGL context, or a rAF loop (all shared via GlobalRenderer).
 */

import type { ImageParticleConfig } from '../types.js';
import { PhysicsModule } from '../physics/index.js';
import { createBuffer, updateBuffer, bindVec2Attrib } from '../webgl/buffer.js';
import type { GlobalRenderer, ParticleProgram } from './global-renderer.js';
import {
  fetchImage,
  toGrayscaleGrid,
  errorDiffusionDither,
  applyMaskInversion,
  buildParticleData,
} from './image-processing.js';

const OPACITY_LERP = 0.08;

export class ImageParticleRenderNode {
  readonly hostElement!: Element;
  readonly programType = 'particle' as const;

  isVisible = true;

  private readonly config: ImageParticleConfig;
  private readonly renderer: GlobalRenderer;

  private physics: PhysicsModule | null = null;

  private count = 0;
  private baseX: Float32Array | null = null;
  private baseY: Float32Array | null = null;
  private offsetX: Float32Array | null = null;
  private offsetY: Float32Array | null = null;
  private positions: Float32Array | null = null;
  private dotSize = 1;

  private positionBuffer: WebGLBuffer | null = null;
  private colorIndexBuffer: WebGLBuffer | null = null;

  private currentOpacity = 1;
  private targetOpacity = 1;
  private cornerRadius = 0;

  private rectCache: DOMRect = new DOMRect();
  private isDirty = true;
  private lastCssW = 0;
  private lastCssH = 0;

  private intersectionObserver: IntersectionObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private resizeDebounceId = 0;
  private rebuildGen = 0;

  constructor(config: ImageParticleConfig, renderer: GlobalRenderer) {
    this.config = config;
    this.renderer = renderer;
  }

  mount(el: Element): void {
    (this as unknown as { hostElement: Element }).hostElement = el;
    (el as HTMLElement).style.position = 'relative';

    if (this.config.hoverTarget === 'container') {
      this.currentOpacity = 0;
      this.targetOpacity = 0;
      (el as HTMLElement).addEventListener('pointerenter', () => {
        this.targetOpacity = 1;
        this.currentOpacity = 1;
      });
      (el as HTMLElement).addEventListener('pointerleave', () => {
        this.targetOpacity = 0;
      });
    }

    const style = window.getComputedStyle(el);
    this.cornerRadius = parseFloat(style.borderRadius) || 0;

    this.rectCache = el.getBoundingClientRect();
    this.lastCssW = this.rectCache.width;
    this.lastCssH = this.rectCache.height;
    this.isDirty = false;

    if (this.config.mouseEnabled) {
      this.physics = new PhysicsModule(this.config.physicsValues, this.config.rippleEnabled);
      this.physics.attach(el as HTMLElement, this.config.hoverTarget);
    }

    this.setupObservers(el);
    this.renderer.register(this);

    void this.rebuild();
  }

  tick(dt: number, _ts: number): void {
    if (this.config.hoverTarget === 'container') {
      this.currentOpacity += (this.targetOpacity - this.currentOpacity) * OPACITY_LERP;
      if (Math.abs(this.targetOpacity - this.currentOpacity) < 0.001) {
        this.currentOpacity = this.targetOpacity;
      }
    }
  }

  draw(gl: WebGL2RenderingContext, cssW: number, cssH: number, _ts: number): void {
    if (this.count === 0 || !this.positions || !this.positionBuffer || !this.colorIndexBuffer) return;

    const prog = this.renderer.particleProgram;
    const { dpr } = this.renderer;

    if (this.physics && this.baseX && this.baseY && this.offsetX && this.offsetY) {
      const hasMotion = this.physics.tick(
        this.baseX, this.baseY, this.offsetX, this.offsetY, this.count,
      );
      if (hasMotion) {
        for (let i = 0; i < this.count; i++) {
          this.positions[i * 2] = (this.baseX[i] ?? 0) + (this.offsetX[i] ?? 0);
          this.positions[i * 2 + 1] = (this.baseY[i] ?? 0) + (this.offsetY[i] ?? 0);
        }
        updateBuffer(gl, this.positionBuffer, this.positions);
      }
    }

    gl.uniform2f(prog.uResolution, cssW, cssH);
    gl.uniform1f(prog.uDpr, dpr);
    gl.uniform1f(prog.uDotSize, this.dotSize);
    gl.uniform1f(prog.uOpacityMul, this.currentOpacity);
    gl.uniform1f(prog.uCornerRadius, this.cornerRadius);

    const flatColors = this.resolveColors();
    gl.uniform3fv(prog.uColors, flatColors);

    bindVec2Attrib(gl, this.positionBuffer, prog.aPosition);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorIndexBuffer);
    gl.enableVertexAttribArray(prog.aColorIndex);
    gl.vertexAttribPointer(prog.aColorIndex, 1, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.POINTS, 0, this.count);
  }

  getRect(): DOMRect {
    if (this.isDirty) {
      this.rectCache = this.hostElement.getBoundingClientRect();
      this.isDirty = false;

      if (
        Math.abs(this.rectCache.width - this.lastCssW) > 0.5 ||
        Math.abs(this.rectCache.height - this.lastCssH) > 0.5
      ) {
        const style = window.getComputedStyle(this.hostElement);
        this.cornerRadius = parseFloat(style.borderRadius) || 0;
        this.lastCssW = this.rectCache.width;
        this.lastCssH = this.rectCache.height;
        void this.rebuild();
      }
    }
    return this.rectCache;
  }

  markDirty(): void {
    this.isDirty = true;
  }

  onContextRestored(gl: WebGL2RenderingContext): void {
    if (this.count === 0 || !this.positions) return;
    this.offsetX?.fill(0);
    this.offsetY?.fill(0);
    this.uploadBuffers(gl);
  }

  destroy(): void {
    this.renderer.unregister(this);
    this.intersectionObserver?.disconnect();
    this.resizeObserver?.disconnect();
    clearTimeout(this.resizeDebounceId);
    this.physics?.detach();

    const { gl } = this.renderer;
    if (this.positionBuffer) gl.deleteBuffer(this.positionBuffer);
    if (this.colorIndexBuffer) gl.deleteBuffer(this.colorIndexBuffer);
    this.positionBuffer = null;
    this.colorIndexBuffer = null;
  }

  // ---------------------------------------------------------------------------
  // Async image processing pipeline
  // ---------------------------------------------------------------------------

  private async rebuild(): Promise<void> {
    const gen = ++this.rebuildGen;

    const { src, invert } = this.config;
    if (!src) {
      console.warn('[KineticOS] image-particle: ko-src attribute is required');
      return;
    }

    try {
      const img = await fetchImage(src);
      if (gen !== this.rebuildGen) return;

      const processed = toGrayscaleGrid(
        img,
        this.config.gridSize,
        this.config.contrast,
        this.config.gamma,
        this.config.blur,
      );
      if (gen !== this.rebuildGen) return;

      const { width: gw, height: gh } = processed;

      let points = errorDiffusionDither(
        processed.grayscale, gw, gh,
        this.config.threshold,
        this.config.diffusionStrength,
        this.config.serpentine,
        processed.alpha,
      );

      if (invert) {
        points = applyMaskInversion(points, gw, gh, this.config.cornerRadius, processed.alpha);
      }

      const cssW = this.lastCssW || this.rectCache.width;
      const cssH = this.lastCssH || this.rectCache.height;
      const isMobile = window.innerWidth <= 640;

      const scale = Math.max(
        0.5,
        (Math.min(cssW, cssH) * this.config.scale) / Math.max(gw, gh),
      );
      const ox = Math.round((cssW - gw * scale) / 2);
      const oy = Math.round((cssH - gh * scale) / 2);
      const dotScale = isMobile ? this.config.dotScale * 0.8 : this.config.dotScale;
      const colorsCount = this.config.colors ? this.config.colors.length : 0;

      const data = buildParticleData(points, scale, dotScale, ox, oy, colorsCount);

      this.count = data.count;
      this.baseX = data.baseX;
      this.baseY = data.baseY;
      this.dotSize = data.dotSize;
      this.offsetX = new Float32Array(data.count);
      this.offsetY = new Float32Array(data.count);
      this.positions = new Float32Array(data.count * 2);

      for (let i = 0; i < data.count; i++) {
        this.positions[i * 2] = data.baseX[i] ?? 0;
        this.positions[i * 2 + 1] = data.baseY[i] ?? 0;
      }

      this.uploadBuffers(this.renderer.gl, data.colorIndices);

      if (this.physics) {
        this.physics.rebuildSpatial(this.baseX, this.baseY, this.count);
      }
    } catch (err) {
      console.error('[KineticOS] image-particle: failed to process image', err);
    }
  }

  // ---------------------------------------------------------------------------
  // GPU buffer management
  // ---------------------------------------------------------------------------

  private uploadBuffers(gl: WebGL2RenderingContext, colorIndices?: Float32Array): void {
    if (this.positionBuffer) gl.deleteBuffer(this.positionBuffer);
    if (this.colorIndexBuffer && colorIndices) gl.deleteBuffer(this.colorIndexBuffer);

    if (!this.positions) return;

    const usage = this.physics ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW;
    this.positionBuffer = createBuffer(gl, this.positions, usage);

    if (colorIndices) {
      this.colorIndexBuffer = createBuffer(gl, colorIndices, gl.STATIC_DRAW);
    }
  }

  // ---------------------------------------------------------------------------
  // Color resolution — matches old Canvas2D behavior
  // ---------------------------------------------------------------------------

  private resolveColors(): number[] {
    const colors = this.config.colors;
    if (colors && colors.length > 0) {
      const flat: number[] = [];
      for (let i = 0; i < 6; i++) {
        const c = colors[Math.min(i, colors.length - 1)]!;
        flat.push(c[0], c[1], c[2]);
      }
      return flat;
    }

    const def = this.config.invert ? [0, 0, 0] : [0.541, 0.561, 0.596];
    const flat: number[] = [];
    for (let i = 0; i < 6; i++) flat.push(def[0]!, def[1]!, def[2]!);
    return flat;
  }

  // ---------------------------------------------------------------------------
  // Observers
  // ---------------------------------------------------------------------------

  private setupObservers(el: Element): void {
    this.intersectionObserver = new IntersectionObserver(
      ([entry]) => { this.isVisible = entry?.isIntersecting ?? false; },
      { threshold: 0.01 },
    );
    this.intersectionObserver.observe(el);

    this.resizeObserver = new ResizeObserver(() => {
      clearTimeout(this.resizeDebounceId);
      this.resizeDebounceId = window.setTimeout(() => this.markDirty(), 100);
    });
    this.resizeObserver.observe(el);
  }
}
