/**
 * ImageParticleRenderNode — per-element state holder for image-particle in the Global Canvas.
 *
 * Owns: config, particle positions, physics, per-node GPU buffers, opacity state, cached rect.
 * Does NOT own: a canvas, a WebGL context, or a rAF loop (all shared via GlobalRenderer).
 */
import type { ImageParticleConfig } from '../types.js';
import type { GlobalRenderer } from './global-renderer.js';
export declare class ImageParticleRenderNode {
    readonly hostElement: Element;
    readonly programType: "particle";
    isVisible: boolean;
    private readonly config;
    private readonly renderer;
    private physics;
    private count;
    private baseX;
    private baseY;
    private offsetX;
    private offsetY;
    private positions;
    private dotSize;
    private positionBuffer;
    private colorIndexBuffer;
    private currentOpacity;
    private targetOpacity;
    private cornerRadius;
    private rectCache;
    private isDirty;
    private lastCssW;
    private lastCssH;
    private intersectionObserver;
    private resizeObserver;
    private resizeDebounceId;
    private rebuildGen;
    constructor(config: ImageParticleConfig, renderer: GlobalRenderer);
    mount(el: Element): void;
    tick(dt: number, _ts: number): void;
    draw(gl: WebGL2RenderingContext, cssW: number, cssH: number, _ts: number): void;
    getRect(): DOMRect;
    markDirty(): void;
    onContextRestored(gl: WebGL2RenderingContext): void;
    destroy(): void;
    private rebuild;
    private uploadBuffers;
    private resolveColors;
    private setupObservers;
}
