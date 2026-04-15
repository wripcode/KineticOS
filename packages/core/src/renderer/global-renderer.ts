/**
 * GlobalRenderer — the single WebGL2 canvas that serves all dots-shader nodes.
 *
 * Architecture:
 * - One <canvas> fixed to the viewport (z-index: -1, pointer-events: none)
 * - One WebGL2RenderingContext shared across all DotsRenderNode instances
 * - One compiled WebGLProgram (all nodes share the same GLSL)
 * - One requestAnimationFrame loop iterating all visible nodes
 * - Each node gets scissor+viewport set to its host element's screen rect before draw
 */

import { compileShader, createProgram } from '../webgl/shader.js';
import { MAX_DPR } from '../constants.js';

import vertSource from '../webgl/shaders/dots-shader.vert.glsl';
import fragSource from '../webgl/shaders/dots-shader.frag.glsl';

export interface SharedProgram {
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
}

/** Minimal interface that GlobalRenderer needs from each render node. */
export interface RenderNode {
  readonly hostElement: Element;
  isVisible: boolean;
  getRect(): DOMRect;
  markDirty(): void;
  tick(dt: number, ts: number): void;
  draw(gl: WebGL2RenderingContext, shared: SharedProgram, cssW: number, cssH: number, ts: number): void;
  onContextRestored(gl: WebGL2RenderingContext): void;
  destroy(): void;
}

export class GlobalRenderer {
  private static instance: GlobalRenderer | null = null;

  readonly canvas: HTMLCanvasElement;
  readonly gl: WebGL2RenderingContext;
  readonly dpr: number;
  readonly shared: SharedProgram;

  private readonly nodes = new Map<Element, RenderNode>();
  private rafId = 0;
  private lastFrameTs = 0;

  // Stored refs for cleanup
  private boundVisibilityChange!: () => void;
  private boundReducedMotionChange!: (e: MediaQueryListEvent) => void;
  private boundContextLost!: (e: Event) => void;
  private boundContextRestored!: () => void;
  private prefersReducedMotion: MediaQueryList = window.matchMedia('(prefers-reduced-motion: reduce)');
  private paused = false;

  private constructor() {
    this.dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, MAX_DPR));

    this.canvas = document.createElement('canvas');
    Object.assign(this.canvas.style, {
      position: 'fixed',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '-1',
    });
    this.resizeCanvas();
    document.body.appendChild(this.canvas);

    const gl = this.canvas.getContext('webgl2');
    if (!gl) throw new Error('[KineticOS] WebGL2 is not available — dots-shader cannot render.');
    this.gl = gl;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.disable(gl.DEPTH_TEST);

    this.shared = this.compileProgram(gl);

    this.setupGlobalObservers();
    this.scheduleFrame();
  }

  static getInstance(): GlobalRenderer {
    GlobalRenderer.instance ??= new GlobalRenderer();
    return GlobalRenderer.instance;
  }

  /** Called by DotsRenderNode.mount() — registers the node for rendering. */
  register(node: RenderNode): void {
    this.nodes.set(node.hostElement, node);
    if (this.paused) this.resume();
  }

  /** Called by DotsRenderNode.destroy() — removes the node. */
  unregister(node: RenderNode): void {
    this.nodes.delete(node.hostElement);
    if (this.nodes.size === 0) this.pause();
  }

  /** Tears down the global canvas and resets singleton state. Call from KineticOS.destroyAll(). */
  destroy(): void {
    this.pause();
    document.removeEventListener('visibilitychange', this.boundVisibilityChange);
    this.prefersReducedMotion.removeEventListener('change', this.boundReducedMotionChange);
    this.canvas.removeEventListener('webglcontextlost', this.boundContextLost, false);
    this.canvas.removeEventListener('webglcontextrestored', this.boundContextRestored, false);
    this.canvas.remove();
    GlobalRenderer.instance = null;
  }

  // ---------------------------------------------------------------------------
  // rAF loop
  // ---------------------------------------------------------------------------

  private scheduleFrame(): void {
    this.rafId = requestAnimationFrame((ts) => this.frame(ts));
  }

  private frame(ts: number): void {
    if (this.paused) return;

    const dt = this.lastFrameTs > 0 ? Math.min((ts - this.lastFrameTs) / 1000, 0.1) : 0;
    this.lastFrameTs = ts;

    const { gl, shared, canvas, dpr } = this;
    const vpW = canvas.width;
    const vpH = canvas.height;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(shared.program);
    gl.enable(gl.SCISSOR_TEST);

    for (const node of this.nodes.values()) {
      if (!node.isVisible) continue;

      const rect = node.getRect();
      if (rect.width <= 0 || rect.height <= 0) continue;

      // Convert CSS rect to physical pixels, flipping Y (WebGL origin is bottom-left)
      const x = Math.round(rect.left * dpr);
      const y = Math.round(vpH - rect.bottom * dpr);
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);

      gl.scissor(x, y, w, h);
      gl.viewport(x, y, w, h);

      node.tick(dt, ts);
      node.draw(gl, shared, rect.width, rect.height, ts);
    }

    gl.disable(gl.SCISSOR_TEST);

    if (this.prefersReducedMotion.matches) {
      this.pause();
      return;
    }

    this.scheduleFrame();
  }

  // ---------------------------------------------------------------------------
  // Pause / Resume
  // ---------------------------------------------------------------------------

  private pause(): void {
    if (this.paused) return;
    this.paused = true;
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  private resume(): void {
    if (!this.paused) return;
    if (this.prefersReducedMotion.matches) return;
    this.paused = false;
    this.lastFrameTs = 0;
    this.scheduleFrame();
  }

  // ---------------------------------------------------------------------------
  // Canvas sizing
  // ---------------------------------------------------------------------------

  private resizeCanvas(): void {
    this.canvas.width = Math.round(window.innerWidth * this.dpr);
    this.canvas.height = Math.round(window.innerHeight * this.dpr);
  }

  // ---------------------------------------------------------------------------
  // Global observers
  // ---------------------------------------------------------------------------

  private setupGlobalObservers(): void {
    // Viewport resize — resize the global canvas and mark all nodes dirty
    const resizeObserver = new ResizeObserver(() => {
      this.resizeCanvas();
      for (const node of this.nodes.values()) node.markDirty();
    });
    resizeObserver.observe(document.documentElement);

    // Scroll — mark all nodes dirty so rects are recalculated next frame
    window.addEventListener('scroll', () => {
      for (const node of this.nodes.values()) node.markDirty();
    }, { passive: true });

    // Tab visibility
    this.boundVisibilityChange = () => {
      document.hidden ? this.pause() : this.resume();
    };
    document.addEventListener('visibilitychange', this.boundVisibilityChange);

    // Reduced motion
    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.boundReducedMotionChange = (e) => {
      e.matches ? this.pause() : this.resume();
    };
    this.prefersReducedMotion.addEventListener('change', this.boundReducedMotionChange);

    // Context loss recovery — re-compile the shared program on restore
    this.boundContextLost = (e: Event) => {
      e.preventDefault();
      this.pause();
    };
    this.boundContextRestored = () => {
      // Re-acquire program after context restore — old program object is invalid
      const newShared = this.compileProgram(this.gl);
      Object.assign(this.shared, newShared);
      for (const node of this.nodes.values()) node.onContextRestored(this.gl);
      this.resume();
    };
    this.canvas.addEventListener('webglcontextlost', this.boundContextLost, false);
    this.canvas.addEventListener('webglcontextrestored', this.boundContextRestored, false);
  }

  // ---------------------------------------------------------------------------
  // Program compilation
  // ---------------------------------------------------------------------------

  private compileProgram(gl: WebGL2RenderingContext): SharedProgram {
    const vert = compileShader(gl, gl.VERTEX_SHADER, vertSource);
    const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSource);
    const program = createProgram(gl, vert, frag);
    gl.useProgram(program);

    return {
      program,
      aPosition: gl.getAttribLocation(program, 'a_position'),
      aSt2: gl.getAttribLocation(program, 'a_st2'),
      uResolution: gl.getUniformLocation(program, 'u_resolution')!,
      uTime: gl.getUniformLocation(program, 'u_time')!,
      uDpr: gl.getUniformLocation(program, 'u_dpr')!,
      uDotSize: gl.getUniformLocation(program, 'u_dot_size')!,
      uTotalSize: gl.getUniformLocation(program, 'u_total_size')!,
      uOpacities: gl.getUniformLocation(program, 'u_opacities')!,
      uColors: gl.getUniformLocation(program, 'u_colors')!,
      uOpacityMul: gl.getUniformLocation(program, 'u_opacity_mul')!,
    };
  }
}
