import type { KineticOSConfig } from '../types.js';
import { MAX_DPR } from '../constants.js';

/**
 * Abstract base class for all KineticOS effects.
 *
 * Handles:
 * - Canvas creation and CSS positioning inside the host element
 * - ResizeObserver-based resize handling
 * - IntersectionObserver-based pause/resume (saves CPU/GPU off-screen)
 * - Page visibility API pause/resume (saves resources on tab switch)
 * - FPS-throttled rAF loop with accumulated dt for u_time
 * - Full lifecycle: mount → init → loop → pause/resume → destroy
 */
export abstract class CanvasEffect {
  protected readonly canvas: HTMLCanvasElement;
  protected readonly dpr: number;
  protected hostElement!: Element;

  // Time accumulation — only advances while active (fixes u_time jump on tab-switch)
  protected totalTime = 0;
  private lastFrameTs = 0;
  private lastThrottleTs = 0;

  private rafId = 0;
  private paused = false;

  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;

  constructor(protected readonly config: KineticOSConfig) {
    this.canvas = document.createElement('canvas');
    this.dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, MAX_DPR));
  }

  // ---------------------------------------------------------------------------
  // Subclass contract
  // ---------------------------------------------------------------------------

  /** Called once after canvas is mounted and sized. Set up WebGL/Canvas2D here. */
  protected abstract init(): void;

  /** Called each frame. `dt` is seconds elapsed since last rendered frame. */
  protected abstract renderFrame(dt: number): void;

  /** Called on canvas resize. `cssW` and `cssH` are the new CSS pixel dimensions. */
  protected abstract onResize(cssW: number, cssH: number): void;

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Mounts the effect into `el`.
   * - Creates the canvas and appends it
   * - Sets `position: relative` on host (Webflow gotcha: sections default to static)
   * - Sizes the canvas
   * - Calls init() then starts the rAF loop
   */
  mount(el: Element): void {
    this.hostElement = el;

    // Force relative positioning on host so absolute canvas is contained
    (el as HTMLElement).style.position = 'relative';

    // Canvas fills the host, sits behind content, ignores pointer events
    Object.assign(this.canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '0',
    });

    if (this.config.hoverTarget === 'container') {
      this.canvas.style.opacity = '0';
      this.canvas.style.transition = 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
      (el as HTMLElement).addEventListener('pointerenter', () => {
        this.totalTime = 0;
        this.canvas.style.opacity = '1';
      });
      (el as HTMLElement).addEventListener('pointerleave', () => {
        this.canvas.style.opacity = '0';
      });
    }

    el.appendChild(this.canvas);

    this.sizeCanvas();
    this.init();
    this.setupResizeObserver();
    this.setupVisibilityObservers();
    this.scheduleFrame();
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    // Reset last frame timestamp to avoid time jump
    this.lastFrameTs = 0;
    this.scheduleFrame();
  }

  /** Fully tears down the effect — event listeners, observers, canvas, GPU resources. */
  destroy(): void {
    this.pause();
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    this.canvas.remove();
  }

  // ---------------------------------------------------------------------------
  // Canvas sizing
  // ---------------------------------------------------------------------------

  protected sizeCanvas(): void {
    const cssW = this.canvas.offsetWidth || (this.hostElement as HTMLElement).offsetWidth;
    const cssH = this.canvas.offsetHeight || (this.hostElement as HTMLElement).offsetHeight;

    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);

    this.onResize(cssW, cssH);
  }

  // ---------------------------------------------------------------------------
  // Animation loop
  // ---------------------------------------------------------------------------

  private scheduleFrame(): void {
    this.rafId = requestAnimationFrame((ts) => this.frame(ts));
  }

  private frame(ts: number): void {
    const maxFps = this.config.maxFps;

    // FPS throttle
    if (maxFps !== Infinity && ts - this.lastThrottleTs < 1000 / maxFps) {
      this.rafId = requestAnimationFrame((t) => this.frame(t));
      return;
    }
    this.lastThrottleTs = ts;

    // Delta time in seconds — capped at 100ms to prevent huge jumps after tab-switch
    const dt = this.lastFrameTs > 0 ? Math.min((ts - this.lastFrameTs) / 1000, 0.1) : 0;
    this.lastFrameTs = ts;

    // Accumulate only when active
    if (!this.paused) this.totalTime += dt;

    this.renderFrame(dt);
    this.rafId = requestAnimationFrame((t) => this.frame(t));
  }

  // ---------------------------------------------------------------------------
  // Observers
  // ---------------------------------------------------------------------------

  private setupResizeObserver(): void {
    this.resizeObserver = new ResizeObserver(() => this.sizeCanvas());
    this.resizeObserver.observe(this.canvas);
  }

  private setupVisibilityObservers(): void {
    // Pause/resume based on viewport visibility — 1% threshold to handle large sections
    this.intersectionObserver = new IntersectionObserver(
      ([entry]) => (entry?.isIntersecting ? this.resume() : this.pause()),
      { threshold: 0.01 },
    );
    this.intersectionObserver.observe(this.canvas);

    // Also pause when the tab is hidden
    document.addEventListener('visibilitychange', () => {
      document.hidden ? this.pause() : this.resume();
    });
  }
}
