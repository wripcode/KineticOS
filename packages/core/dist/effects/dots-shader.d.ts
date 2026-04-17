import type { DotsConfig } from '../types.js';
import { CanvasEffect } from './base.js';
/**
 * Renders an animated WebGL dot grid with optional mouse physics.
 *
 * Rendering approach:
 * - One canvas, direct WebGL2 context (no double-canvas/blit bug)
 * - GL_POINTS — one vertex per dot, position in vertex shader
 * - Physics buffers are DYNAMIC_DRAW; static grid IDs are STATIC_DRAW
 */
export declare class DotsShaderEffect extends CanvasEffect {
    private readonly dotsConfig;
    private gl;
    private program;
    private uResolution;
    private uTime;
    private uDpr;
    private positionBuffer;
    private st2Buffer;
    private aPosition;
    private aSt2;
    private grid;
    private physics;
    private boundContextLost;
    private boundContextRestored;
    constructor(dotsConfig: DotsConfig);
    protected init(): void;
    protected onResize(cssW: number, cssH: number): void;
    protected renderFrame(_dt: number): void;
    destroy(): void;
    /**
     * Generates the initial dot grid from CSS pixel dimensions.
     * Padding ensures dots are centered within the canvas (same Webflow behavior).
     */
    private buildGrid;
    private uploadGrid;
    private uploadStaticUniforms;
}
