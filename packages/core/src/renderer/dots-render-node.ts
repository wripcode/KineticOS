/**
 * DotsRenderNode — per-element state holder for dots-shader in the Global Canvas model.
 *
 * Owns: config, dot grid, physics, per-node GPU buffers, opacity state, cached rect.
 * Does NOT own: a canvas, a WebGL context, or a rAF loop (all shared via GlobalRenderer).
 */

import type { DotsConfig } from '../types.js';
import { PhysicsModule } from '../physics/index.js';
import { bindVec2Attrib, createBuffer, updateBuffer } from '../webgl/buffer.js';
import type { GlobalRenderer, DotsProgram } from './global-renderer.js';

interface GridState {
  count: number;
  baseX: Float32Array;
  baseY: Float32Array;
  offsetX: Float32Array;
  offsetY: Float32Array;
  positions: Float32Array;
  st2: Float32Array;
}

const OPACITY_LERP = 0.08; // Speed of container hover fade

export class DotsRenderNode {
  readonly hostElement!: Element;
  readonly programType = 'dots' as const;

  isVisible = true;

  private readonly config: DotsConfig;
  private readonly renderer: GlobalRenderer;

  private grid: GridState | null = null;
  private physics: PhysicsModule | null = null;

  private positionBuffer: WebGLBuffer | null = null;
  private st2Buffer: WebGLBuffer | null = null;

  // Per-node time — independent of other nodes
  private totalTime = 0;
  private cornerRadius = 0;

  // Container hover opacity
  private currentOpacity = 1;
  private targetOpacity = 1;

  // Cached screen rect — only refreshed when isDirty=true
  private rectCache: DOMRect = new DOMRect();
  private isDirty = true;

  // Last known CSS dimensions — used to detect actual size changes on resize
  private lastCssW = 0;
  private lastCssH = 0;

  private intersectionObserver: IntersectionObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private resizeDebounceId = 0;

  constructor(config: DotsConfig, renderer: GlobalRenderer) {
    this.config = config;
    this.renderer = renderer;
  }

  /** Mounts the node into `el` and registers with GlobalRenderer. */
  mount(el: Element): void {
    (this as unknown as { hostElement: Element }).hostElement = el;

    // Ensure host element is positioned (same Webflow gotcha as before)
    (el as HTMLElement).style.position = 'relative';

    if (this.config.hoverTarget === 'container') {
      this.currentOpacity = 0;
      this.targetOpacity = 0;
      (el as HTMLElement).addEventListener('pointerenter', () => {
        this.totalTime = 0;
        this.targetOpacity = 1;
        // Instantly make it opaque so the time-based radial wave is visible as it expands!
        this.currentOpacity = 1;
      });
      (el as HTMLElement).addEventListener('pointerleave', () => {
        this.targetOpacity = 0;
      });
    }

    const { gl } = this.renderer;

    // Force initial rect read and extract border-radius for SDF clipping
    const style = window.getComputedStyle(el);
    this.cornerRadius = parseFloat(style.borderRadius) || 0;

    this.rectCache = el.getBoundingClientRect();
    this.lastCssW = this.rectCache.width;
    this.lastCssH = this.rectCache.height;
    this.isDirty = false;

    this.grid = this.buildGrid(this.rectCache.width, this.rectCache.height);
    this.uploadGrid(gl, this.grid);

    if (this.config.mouseEnabled) {
      this.physics = new PhysicsModule(this.config.physicsValues, this.config.rippleEnabled);
      this.physics.attach(el as HTMLElement, this.config.hoverTarget);
      this.physics.rebuildSpatial(this.grid.baseX, this.grid.baseY, this.grid.count);
    }

    this.setupObservers(el);
    this.renderer.register(this);
  }

  /** Advances physics and opacity lerp. Called by GlobalRenderer each rAF tick. */
  tick(dt: number, _ts: number): void {
    // dt is already in seconds (GlobalRenderer divides by 1000 before passing)
    this.totalTime += dt;

    if (this.config.hoverTarget === 'container') {
      this.currentOpacity += (this.targetOpacity - this.currentOpacity) * OPACITY_LERP;
      if (Math.abs(this.targetOpacity - this.currentOpacity) < 0.001) {
        this.currentOpacity = this.targetOpacity;
      }
    }
  }

  /**
   * Uploads per-node uniforms and draws into the currently scissored viewport.
   * Called by GlobalRenderer after scissor+viewport are already set.
   */
  draw(
    gl: WebGL2RenderingContext,
    cssW: number,
    cssH: number,
    ts: number,
  ): void {
    const shared = this.renderer.dotsProgram;
    if (!this.grid) return;

    const { grid } = this;
    const { dpr } = this.renderer;

    // Advance physics and upload position buffer if any dot moved
    if (this.physics) {
      const hasMotion = this.physics.tick(
        grid.baseX, grid.baseY, grid.offsetX, grid.offsetY, grid.count,
      );
      if (hasMotion) {
        for (let i = 0; i < grid.count; i++) {
          grid.positions[i * 2] = (grid.baseX[i] ?? 0) + (grid.offsetX[i] ?? 0);
          grid.positions[i * 2 + 1] = (grid.baseY[i] ?? 0) + (grid.offsetY[i] ?? 0);
        }
        updateBuffer(gl, this.positionBuffer!, grid.positions);
        bindVec2Attrib(gl, this.positionBuffer!, shared.aPosition);
      }
    }

    // Upload per-node uniforms (shared program, so must set before each draw call)
    gl.uniform2f(shared.uResolution, cssW, cssH);
    gl.uniform1f(shared.uTime, this.totalTime);
    gl.uniform1f(shared.uDpr, dpr);
    gl.uniform1f(shared.uDotSize, this.config.dotSize);
    gl.uniform1f(shared.uTotalSize, this.config.totalSize);
    gl.uniform1fv(shared.uOpacities, this.config.opacities as number[]);
    const flatColors = (this.config.colors as [number, number, number][]).flatMap((c) => c);
    gl.uniform3fv(shared.uColors, flatColors);
    gl.uniform1f(shared.uOpacityMul, this.currentOpacity);
    gl.uniform1f(shared.uCornerRadius, this.cornerRadius);

    // Bind per-node buffers before draw
    bindVec2Attrib(gl, this.positionBuffer!, shared.aPosition);
    bindVec2Attrib(gl, this.st2Buffer!, shared.aSt2);

    // GlobalRenderer already cleared the full canvas at frame start.
    // Per-node clear is not needed and would wipe other nodes.
    gl.drawArrays(gl.POINTS, 0, grid.count);
  }

  /** Returns cached rect; refreshes from DOM if dirty. */
  getRect(): DOMRect {
    if (this.isDirty) {
      this.rectCache = this.hostElement.getBoundingClientRect();
      this.isDirty = false;

      // If size changed, rebuild the grid and re-read corner radius
      if (
        Math.abs(this.rectCache.width - this.lastCssW) > 0.5 ||
        Math.abs(this.rectCache.height - this.lastCssH) > 0.5
      ) {
        const style = window.getComputedStyle(this.hostElement);
        this.cornerRadius = parseFloat(style.borderRadius) || 0;

        this.lastCssW = this.rectCache.width;
        this.lastCssH = this.rectCache.height;
        this.rebuildGrid(this.rectCache.width, this.rectCache.height);
      }
    }
    return this.rectCache;
  }

  /** Marks this node's rect as stale. Called by GlobalRenderer on scroll/resize. */
  markDirty(): void {
    this.isDirty = true;
  }

  /** Called after WebGL context is restored. Recreates GPU buffers. */
  onContextRestored(gl: WebGL2RenderingContext): void {
    if (!this.grid) return;
    this.grid.offsetX.fill(0);
    this.grid.offsetY.fill(0);
    this.uploadGrid(gl, this.grid);
  }

  /** Fully tears down the node: deregisters, disconnects observers, deletes GPU buffers. */
  destroy(): void {
    this.renderer.unregister(this);
    this.intersectionObserver?.disconnect();
    this.resizeObserver?.disconnect();
    clearTimeout(this.resizeDebounceId);
    this.physics?.detach();

    const { gl } = this.renderer;
    if (this.positionBuffer) gl.deleteBuffer(this.positionBuffer);
    if (this.st2Buffer) gl.deleteBuffer(this.st2Buffer);
    this.positionBuffer = null;
    this.st2Buffer = null;
    this.grid = null;
  }

  // ---------------------------------------------------------------------------
  // Grid
  // ---------------------------------------------------------------------------

  private buildGrid(cssW: number, cssH: number): GridState {
    const { totalSize, dotSize } = this.config;
    const gridX = Math.ceil(cssW / totalSize) + 1;
    const gridY = Math.ceil(cssH / totalSize) + 1;
    const count = gridX * gridY;

    const baseX = new Float32Array(count);
    const baseY = new Float32Array(count);
    const offsetX = new Float32Array(count);
    const offsetY = new Float32Array(count);
    const positions = new Float32Array(count * 2);
    const st2 = new Float32Array(count * 2);

    const padX = Math.abs(Math.floor(((cssW % totalSize) - dotSize) * 0.5));
    const padY = Math.abs(Math.floor(((cssH % totalSize) - dotSize) * 0.5));

    let i = 0;
    for (let y = 0; y < gridY; y++) {
      for (let x = 0; x < gridX; x++) {
        const px = x * totalSize + padX + dotSize * 0.5;
        const py = y * totalSize + padY + dotSize * 0.5;
        baseX[i] = px;
        baseY[i] = py;
        positions[i * 2] = px;
        positions[i * 2 + 1] = py;
        st2[i * 2] = x;
        st2[i * 2 + 1] = y;
        i++;
      }
    }

    return { count, baseX, baseY, offsetX, offsetY, positions, st2 };
  }

  private rebuildGrid(cssW: number, cssH: number): void {
    const { gl } = this.renderer;
    this.grid = this.buildGrid(cssW, cssH);
    this.uploadGrid(gl, this.grid);
    if (this.physics && this.grid) {
      this.physics.rebuildSpatial(this.grid.baseX, this.grid.baseY, this.grid.count);
    }
  }

  private uploadGrid(gl: WebGL2RenderingContext, grid: GridState): void {
    // Delete old buffers before creating new ones (avoid GPU leaks on resize)
    if (this.positionBuffer) gl.deleteBuffer(this.positionBuffer);
    if (this.st2Buffer) gl.deleteBuffer(this.st2Buffer);

    const usage = this.physics ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW;
    this.positionBuffer = createBuffer(gl, grid.positions, usage);
    this.st2Buffer = createBuffer(gl, grid.st2, gl.STATIC_DRAW);
  }

  // ---------------------------------------------------------------------------
  // Observers
  // ---------------------------------------------------------------------------

  private setupObservers(el: Element): void {
    // IntersectionObserver — skip off-screen nodes entirely (no GPU work)
    this.intersectionObserver = new IntersectionObserver(
      ([entry]) => { this.isVisible = entry?.isIntersecting ?? false; },
      { threshold: 0.01 },
    );
    this.intersectionObserver.observe(el);

    // ResizeObserver on host — debounce to avoid rapid-fire grid rebuilds
    this.resizeObserver = new ResizeObserver(() => {
      clearTimeout(this.resizeDebounceId);
      this.resizeDebounceId = window.setTimeout(() => this.markDirty(), 100);
    });
    this.resizeObserver.observe(el);
  }
}
