import type { KineticOSConfig } from '../types.js';
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
export declare abstract class CanvasEffect {
    protected readonly config: KineticOSConfig;
    protected readonly canvas: HTMLCanvasElement;
    protected readonly dpr: number;
    protected hostElement: Element;
    protected totalTime: number;
    private lastFrameTs;
    private lastThrottleTs;
    private rafId;
    private paused;
    private resizeObserver;
    private intersectionObserver;
    private boundVisibilityChange;
    private boundReducedMotionChange;
    private prefersReducedMotion;
    private resizeDebounceId;
    private hasAnimatedIn;
    constructor(config: KineticOSConfig);
    /** Called once after canvas is mounted and sized. Set up WebGL/Canvas2D here. */
    protected abstract init(): void;
    /** Called each frame. `dt` is seconds elapsed since last rendered frame. */
    protected abstract renderFrame(dt: number): void;
    /** Called on canvas resize. `cssW` and `cssH` are the new CSS pixel dimensions. */
    protected abstract onResize(cssW: number, cssH: number): void;
    /**
     * Mounts the effect into `el`.
     * - Creates the canvas and appends it
     * - Sets `position: relative` on host (Webflow gotcha: sections default to static)
     * - Sizes the canvas
     * - Calls init() then starts the rAF loop
     */
    mount(el: Element): void;
    pause(): void;
    resume(): void;
    /** Fully tears down the effect — event listeners, observers, canvas, GPU resources. */
    destroy(): void;
    protected sizeCanvas(): void;
    private scheduleFrame;
    private frame;
    private setupResizeObserver;
    private setupVisibilityObservers;
}
