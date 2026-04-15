import type { KineticOSConfig } from '../types.js';
import { MAX_DPR } from '../constants.js';

/**
 * Abstract base class for all KineticOS effects.
 *
 * Handles:
 * - Canvas creation and CSS positioning inside the host element
 * - ResizeObserver-based resize handling (debounced 100ms)
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

  // Stored so the same reference can be removed in destroy()
  private boundVisibilityChange!: () => void;
  private boundReducedMotionChange!: (e: MediaQueryListEvent) => void;

  private prefersReducedMotion: MediaQueryList | null = null;

  // Debounce handle for ResizeObserver — prevents thrashing during drag-resize
  private resizeDebounceId = 0;

  // Tracks whether the container-hover intro animation has played once
  private hasAnimatedIn = false;

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

    // Canvas fills the host, sits behind content, ignores pointer events.
    // will-change: transform promotes the canvas to its own compositor layer,
    // so the compositor thread handles repaints without main-thread involvement.
    Object.assign(this.canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '0',
      willChange: 'transform',
    });

    if (this.config.hoverTarget === 'container') {
      this.canvas.style.opacity = '0';
      this.canvas.style.transition = 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
      (el as HTMLElement).addEventListener('pointerenter', () => {
        // Reset totalTime only on first hover so the intro animation plays once,
        // not on every re-enter (which makes cards feel cheap on repeated hover).
        if (!this.hasAnimatedIn) {
          this.totalTime = 0;
          this.hasAnimatedIn = true;
        }
        this.canvas.style.opacity = '1';
      });
      (el as HTMLElement).addEventListener('pointerleave', () => {
        this.canvas.style.opacity = '0';
      });
    }

    el.appendChild(this.canvas);

    this.sizeCanvas();
    this.init();
    
    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.boundReducedMotionChange = (e) => {
      e.matches ? this.pause() : this.resume();
    };
    this.prefersReducedMotion.addEventListener('change', this.boundReducedMotionChange);

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
    if (this.prefersReducedMotion?.matches) return;
    this.paused = false;
    // Reset last frame timestamp to avoid time jump
    this.lastFrameTs = 0;
    this.scheduleFrame();
  }

  /** Fully tears down the effect — event listeners, observers, canvas, GPU resources. */
  destroy(): void {
    this.pause();
    clearTimeout(this.resizeDebounceId);
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    document.removeEventListener('visibilitychange', this.boundVisibilityChange);
    this.prefersReducedMotion?.removeEventListener('change', this.boundReducedMotionChange);
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
    // Exit immediately if paused — handles the race where pause() is called
    // while a frame is mid-execution; without this, one extra frame renders
    // after pause, which can touch a null canvas in async effects.
    if (this.paused) return;

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

    this.totalTime += dt;

    this.renderFrame(dt);

    if (this.prefersReducedMotion?.matches) {
      this.pause();
      return;
    }

    this.rafId = requestAnimationFrame((t) => this.frame(t));
  }

  // ---------------------------------------------------------------------------
  // Observers
  // ---------------------------------------------------------------------------

  private setupResizeObserver(): void {
    this.resizeObserver = new ResizeObserver(() => {
      // Debounce: ResizeObserver fires on every pixel during drag-resize.
      // 100ms delay is imperceptible but eliminates rapid-fire sizeCanvas() calls
      // which each trigger 8 Float32Array allocations + GPU buffer uploads.
      clearTimeout(this.resizeDebounceId);
      this.resizeDebounceId = window.setTimeout(() => this.sizeCanvas(), 100);
    });
    this.resizeObserver.observe(this.canvas);
  }

  private setupVisibilityObservers(): void {
    // Pause/resume based on viewport visibility — 1% threshold to handle large sections
    this.intersectionObserver = new IntersectionObserver(
      ([entry]) => (entry?.isIntersecting ? this.resume() : this.pause()),
      { threshold: 0.01 },
    );
    this.intersectionObserver.observe(this.canvas);

    // Store the bound handler so destroy() can remove the exact same reference.
    // Arrow functions passed directly to addEventListener cannot be removed.
    this.boundVisibilityChange = () => {
      document.hidden ? this.pause() : this.resume();
    };
    document.addEventListener('visibilitychange', this.boundVisibilityChange);
  }
}
