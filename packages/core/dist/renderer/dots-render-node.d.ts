/**
 * DotsRenderNode — per-element state holder for dots-shader in the Global Canvas model.
 *
 * Owns: config, dot grid, physics, per-node GPU buffers, opacity state, cached rect.
 * Does NOT own: a canvas, a WebGL context, or a rAF loop (all shared via GlobalRenderer).
 */
import type { DotsConfig } from '../types.js';
import type { GlobalRenderer } from './global-renderer.js';
export declare class DotsRenderNode {
    readonly hostElement: Element;
    readonly programType: "dots";
    isVisible: boolean;
    private readonly config;
    private readonly renderer;
    private grid;
    private physics;
    private positionBuffer;
    private st2Buffer;
    private totalTime;
    private cornerRadius;
    private currentOpacity;
    private targetOpacity;
    private rectCache;
    private isDirty;
    private lastCssW;
    private lastCssH;
    private intersectionObserver;
    private resizeObserver;
    private resizeDebounceId;
    constructor(config: DotsConfig, renderer: GlobalRenderer);
    /** Mounts the node into `el` and registers with GlobalRenderer. */
    mount(el: Element): void;
    /** Advances physics and opacity lerp. Called by GlobalRenderer each rAF tick. */
    tick(dt: number, _ts: number): void;
    /**
     * Uploads per-node uniforms and draws into the currently scissored viewport.
     * Called by GlobalRenderer after scissor+viewport are already set.
     */
    draw(gl: WebGL2RenderingContext, cssW: number, cssH: number, ts: number): void;
    /** Returns cached rect; refreshes from DOM if dirty. */
    getRect(): DOMRect;
    /** Marks this node's rect as stale. Called by GlobalRenderer on scroll/resize. */
    markDirty(): void;
    /** Called after WebGL context is restored. Recreates GPU buffers. */
    onContextRestored(gl: WebGL2RenderingContext): void;
    /** Fully tears down the node: deregisters, disconnects observers, deletes GPU buffers. */
    destroy(): void;
    private buildGrid;
    private rebuildGrid;
    private uploadGrid;
    private setupObservers;
}
