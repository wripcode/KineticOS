/**
 * GlobalRenderer — the single WebGL2 canvas that serves all KineticOS effects.
 *
 * Architecture:
 * - One <canvas> fixed to the viewport (z-index: -1, pointer-events: none)
 * - One WebGL2RenderingContext shared across all RenderNode instances
 * - Two compiled WebGLPrograms: one for dots-shader, one for image-particle
 * - One requestAnimationFrame loop with two passes (dots → particles)
 * - Each node gets scissor+viewport set to its host element's screen rect before draw
 */
export interface DotsProgram {
    program: WebGLProgram;
    aPosition: number;
    aSt2: number;
    uResolution: WebGLUniformLocation;
    uTime: WebGLUniformLocation;
    uDpr: WebGLUniformLocation;
    uDotSize: WebGLUniformLocation;
    uTotalSize: WebGLUniformLocation;
    uOpacities: WebGLUniformLocation;
    uColors: WebGLUniformLocation;
    uOpacityMul: WebGLUniformLocation;
    uCornerRadius: WebGLUniformLocation;
}
export interface ParticleProgram {
    program: WebGLProgram;
    aPosition: number;
    aColorIndex: number;
    uResolution: WebGLUniformLocation;
    uDpr: WebGLUniformLocation;
    uDotSize: WebGLUniformLocation;
    uColors: WebGLUniformLocation;
    uOpacityMul: WebGLUniformLocation;
    uCornerRadius: WebGLUniformLocation;
}
/** @deprecated Alias kept for DotsRenderNode compatibility — points to DotsProgram. */
export type SharedProgram = DotsProgram;
export interface RenderNode {
    readonly hostElement: Element;
    readonly programType: 'dots' | 'particle';
    isVisible: boolean;
    mount(el: Element): void;
    getRect(): DOMRect;
    markDirty(): void;
    tick(dt: number, ts: number): void;
    draw(gl: WebGL2RenderingContext, cssW: number, cssH: number, ts: number): void;
    onContextRestored(gl: WebGL2RenderingContext): void;
    destroy(): void;
}
export declare class GlobalRenderer {
    private static instance;
    readonly canvas: HTMLCanvasElement;
    readonly gl: WebGL2RenderingContext;
    readonly dpr: number;
    readonly dotsProgram: DotsProgram;
    readonly particleProgram: ParticleProgram;
    private readonly nodes;
    private rafId;
    private lastFrameTs;
    private boundVisibilityChange;
    private boundReducedMotionChange;
    private boundContextLost;
    private boundContextRestored;
    private prefersReducedMotion;
    private paused;
    private constructor();
    static getInstance(): GlobalRenderer;
    register(node: RenderNode): void;
    unregister(node: RenderNode): void;
    destroy(): void;
    private scheduleFrame;
    private frame;
    private drawNodesByType;
    private pause;
    private resume;
    private resizeCanvas;
    private setupGlobalObservers;
    private compileDotsProgram;
    private compileParticleProgram;
}
