/**
 * PixelBlastRenderNode — fullscreen-quad shader effect for the Global Canvas.
 *
 * Renders a Bayer-dithered FBM noise pattern with configurable pixel shapes,
 * click ripples, and edge fade. Uses its own WebGL program (not shared with dots/particle).
 */

import type { PixelBlastConfig } from '../../types.js';
import type { GlobalRenderer, PixelBlastProgram } from '../../renderer/global-renderer.js';
import { createBuffer } from '../../webgl/buffer.js';

const SHAPE_MAP: Record<string, number> = {
  square: 0,
  circle: 1,
  triangle: 2,
  diamond: 3,
};

const MAX_CLICKS = 10;
const OPACITY_LERP = 0.08;

export class PixelBlastRenderNode {
  readonly hostElement!: Element;
  readonly programType = 'pixel-blast' as const;

  isVisible = true;

  private readonly config: PixelBlastConfig;
  private readonly renderer: GlobalRenderer;

  private quadBuffer: WebGLBuffer | null = null;
  private totalTime = 0;
  private hoverTime = 0;
  private timeOffset: number;
  private cornerRadius = 0;

  private currentOpacity = 1;
  private targetOpacity = 1;

  private rectCache: DOMRect = new DOMRect();
  private isDirty = true;
  private lastCssW = 0;
  private lastCssH = 0;

  private intersectionObserver: IntersectionObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private resizeDebounceId = 0;

  private clickPositions: Float32Array;
  private clickTimes: Float32Array;
  private clickIndex = 0;

  private mousePosX = -1;
  private mousePosY = -1;

  private boundPointerDown: ((e: PointerEvent) => void) | null = null;
  private boundPointerMove: ((e: PointerEvent) => void) | null = null;
  private boundPointerLeave: (() => void) | null = null;
  private clickTarget: HTMLElement | Window | null = null;
  private moveTarget: HTMLElement | Window | null = null;

  constructor(config: PixelBlastConfig, renderer: GlobalRenderer) {
    this.config = config;
    this.renderer = renderer;
    this.timeOffset = this.secureRandom() * 1000;
    this.hoverTime = config.hoverTarget === 'container' ? 0 : 1e6;
    this.clickPositions = new Float32Array(MAX_CLICKS * 2).fill(-1);
    this.clickTimes = new Float32Array(MAX_CLICKS);
  }

  mount(el: Element): void {
    (this as unknown as { hostElement: Element }).hostElement = el;
    (el as HTMLElement).style.position = 'relative';

    if (this.config.hoverTarget === 'container') {
      this.currentOpacity = 0;
      this.targetOpacity = 0;
      (el as HTMLElement).addEventListener('pointerenter', () => {
        this.hoverTime = 0;
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

    const { gl } = this.renderer;
    this.uploadQuad(gl);

    if (this.config.mouseEnabled) {
      this.setupMouseHandler(el);
    }

    this.setupObservers(el);
    this.renderer.register(this);
  }

  tick(dt: number, _ts: number): void {
    this.totalTime += dt * this.config.speed;
    this.hoverTime = Math.min(this.hoverTime + dt, 1e6);

    if (this.config.hoverTarget === 'container') {
      this.currentOpacity += (this.targetOpacity - this.currentOpacity) * OPACITY_LERP;
      if (Math.abs(this.targetOpacity - this.currentOpacity) < 0.001) {
        this.currentOpacity = this.targetOpacity;
      }
    }
  }

  draw(
    gl: WebGL2RenderingContext,
    cssW: number,
    cssH: number,
    _ts: number,
  ): void {
    const prog = this.renderer.pixelBlastProgram;
    if (!this.quadBuffer) return;

    const { dpr } = this.renderer;
    const pxW = cssW * dpr;
    const pxH = cssH * dpr;

    // Compute element bottom-left in physical canvas pixels (WebGL y-up origin).
    // rectCache is always fresh — getRect() is called by drawNodesByType before draw().
    const vpH = this.renderer.canvas.height;
    const physX = Math.round(this.rectCache.left * dpr);
    const physY = Math.round(vpH - this.rectCache.bottom * dpr);

    gl.uniform2f(prog.uResolution, pxW, pxH);
    gl.uniform2f(prog.uOffset, physX, physY);
    gl.uniform1f(prog.uTime, this.timeOffset + this.totalTime);
    gl.uniform1f(prog.uHoverTime, this.hoverTime);
    gl.uniform2f(prog.uMousePos, this.mousePosX, this.mousePosY);
    gl.uniform1f(prog.uMouseRadius, this.config.mouseRadius * dpr);
    gl.uniform1f(prog.uMouseStrength, this.config.mouseEnabled ? this.config.mouseStrength : 0.0);
    gl.uniform3f(prog.uColor, this.config.colorRgb[0], this.config.colorRgb[1], this.config.colorRgb[2]);
    gl.uniform1f(prog.uPixelSize, this.config.pixelSize * dpr);
    gl.uniform1f(prog.uScale, this.config.patternScale);
    gl.uniform1f(prog.uDensity, this.config.patternDensity);
    gl.uniform1f(prog.uPixelJitter, this.config.pixelSizeJitter);
    gl.uniform1f(prog.uEdgeFade, this.config.edgeFade);
    gl.uniform1f(prog.uOpacityMul, this.currentOpacity);
    gl.uniform1f(prog.uCornerRadius, this.cornerRadius * dpr);
    gl.uniform1i(prog.uShapeType, SHAPE_MAP[this.config.variant] ?? 0);
    gl.uniform1i(prog.uEnableRipples, this.config.rippleEnabled ? 1 : 0);
    gl.uniform1f(prog.uRippleSpeed, this.config.rippleSpeed);
    gl.uniform1f(prog.uRippleThickness, this.config.rippleThickness);
    gl.uniform1f(prog.uRippleIntensity, this.config.rippleIntensity);
    gl.uniform2fv(prog.uClickPos, this.clickPositions);
    gl.uniform1fv(prog.uClickTimes, this.clickTimes);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(prog.aPosition);
    gl.vertexAttribPointer(prog.aPosition, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
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
      }
    }
    return this.rectCache;
  }

  markDirty(): void {
    this.isDirty = true;
  }

  onContextRestored(gl: WebGL2RenderingContext): void {
    this.uploadQuad(gl);
  }

  destroy(): void {
    this.renderer.unregister(this);
    this.intersectionObserver?.disconnect();
    this.resizeObserver?.disconnect();
    clearTimeout(this.resizeDebounceId);

    if (this.boundPointerMove && this.moveTarget) {
      this.moveTarget.removeEventListener('pointermove', this.boundPointerMove as EventListener);
    }
    if (this.boundPointerLeave) {
      (this.hostElement as HTMLElement).removeEventListener('pointerleave', this.boundPointerLeave);
    }
    if (this.boundPointerDown && this.clickTarget) {
      this.clickTarget.removeEventListener('pointerup', this.boundPointerDown as EventListener);
    }

    const { gl } = this.renderer;
    if (this.quadBuffer) gl.deleteBuffer(this.quadBuffer);
    this.quadBuffer = null;
  }

  // ---------------------------------------------------------------------------
  // Fullscreen quad
  // ---------------------------------------------------------------------------

  private uploadQuad(gl: WebGL2RenderingContext): void {
    if (this.quadBuffer) gl.deleteBuffer(this.quadBuffer);
    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    this.quadBuffer = createBuffer(gl, vertices, gl.STATIC_DRAW);
  }

  // ---------------------------------------------------------------------------
  // Mouse tracking + click ripples
  // ---------------------------------------------------------------------------

  private setupMouseHandler(el: Element): void {
    const hostEl = el as HTMLElement;

    // Track cursor position for repulsion uniform
    this.moveTarget = this.config.hoverTarget === 'container' ? hostEl : window;
    this.boundPointerMove = (e: PointerEvent) => {
      const rect = this.rectCache;
      const { dpr } = this.renderer;
      this.mousePosX = (e.clientX - rect.left) * dpr;
      this.mousePosY = (rect.height - (e.clientY - rect.top)) * dpr;
    };
    this.boundPointerLeave = () => {
      this.mousePosX = -1;
      this.mousePosY = -1;
    };
    this.moveTarget.addEventListener('pointermove', this.boundPointerMove as EventListener);
    hostEl.addEventListener('pointerleave', this.boundPointerLeave);

    // Click ripples
    if (this.config.rippleEnabled) {
      this.clickTarget = this.config.hoverTarget === 'container' ? hostEl : window;
      this.boundPointerDown = (e: PointerEvent) => {
        const rect = this.rectCache;
        const { dpr } = this.renderer;
        const fx = (e.clientX - rect.left) * dpr;
        const fy = (rect.height - (e.clientY - rect.top)) * dpr;
        const ix = this.clickIndex;
        this.clickPositions[ix * 2] = fx;
        this.clickPositions[ix * 2 + 1] = fy;
        this.clickTimes[ix] = this.timeOffset + this.totalTime;
        this.clickIndex = (ix + 1) % MAX_CLICKS;
      };
      this.clickTarget.addEventListener('pointerup', this.boundPointerDown as EventListener);
    }
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

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private secureRandom(): number {
    if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
      const u32 = new Uint32Array(1);
      window.crypto.getRandomValues(u32);
      return u32[0]! / 0xffffffff;
    }
    return Math.random();
  }
}
