import type { ImageParticleConfig } from '../types.js';
import { CanvasEffect } from './base.js';
/**
 * Converts an SVG or image into an interactive dithered particle field.
 * Uses Canvas2D for rendering — the particle counts are low enough that
 * Canvas2D is performant and avoids WebGL texture complexity.
 */
export declare class ImageParticleEffect extends CanvasEffect {
    private readonly particleConfig;
    private ctx;
    private system;
    private physics;
    private isMobile;
    private cachedCssW;
    private cachedCssH;
    private rebuildGen;
    constructor(particleConfig: ImageParticleConfig);
    protected init(): void;
    protected onResize(cssW: number, cssH: number): void;
    protected renderFrame(_dt: number): void;
    destroy(): void;
    private rebuild;
}
