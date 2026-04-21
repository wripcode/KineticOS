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

import { compileShader, createProgram } from '../webgl/shader.js';
import { MAX_DPR } from '../constants.js';

import dotsVertSource from '../webgl/shaders/dots-shader.vert.glsl';
import dotsFragSource from '../webgl/shaders/dots-shader.frag.glsl';
import particleVertSource from '../webgl/shaders/image-particle.vert.glsl';
import particleFragSource from '../webgl/shaders/image-particle.frag.glsl';

// ---------------------------------------------------------------------------
// Program interfaces
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// RenderNode interface
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// GlobalRenderer
// ---------------------------------------------------------------------------

export class GlobalRenderer {
  private static instance: GlobalRenderer | null = null;

  readonly canvas: HTMLCanvasElement;
  readonly gl: WebGL2RenderingContext;
  readonly dpr: number;
  readonly dotsProgram: DotsProgram;
  readonly particleProgram: ParticleProgram;

  private readonly nodes = new Map<Element, RenderNode>();
  private rafId = 0;
  private lastFrameTs = 0;

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
    if (!gl) throw new Error('[KineticOS] WebGL2 is not available.');
    this.gl = gl;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.disable(gl.DEPTH_TEST);

    this.dotsProgram = this.compileDotsProgram(gl);
    this.particleProgram = this.compileParticleProgram(gl);

    this.setupGlobalObservers();
    this.scheduleFrame();
  }

  static getInstance(): GlobalRenderer {
    GlobalRenderer.instance ??= new GlobalRenderer();
    return GlobalRenderer.instance;
  }

  register(node: RenderNode): void {
    this.nodes.set(node.hostElement, node);
    if (this.paused) this.resume();
  }

  unregister(node: RenderNode): void {
    this.nodes.delete(node.hostElement);
    if (this.nodes.size === 0) this.pause();
  }

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
  // rAF loop — two-pass rendering (dots first, particles second)
  // ---------------------------------------------------------------------------

  private scheduleFrame(): void {
    this.rafId = requestAnimationFrame((ts) => this.frame(ts));
  }

  private frame(ts: number): void {
    if (this.paused) return;

    const dt = this.lastFrameTs > 0 ? Math.min((ts - this.lastFrameTs) / 1000, 0.1) : 0;
    this.lastFrameTs = ts;

    const { gl, canvas } = this;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.SCISSOR_TEST);

    // Pass 1: dots-shader nodes
    gl.useProgram(this.dotsProgram.program);
    this.drawNodesByType('dots', gl, dt, ts);

    // Pass 2: image-particle nodes
    gl.useProgram(this.particleProgram.program);
    this.drawNodesByType('particle', gl, dt, ts);

    gl.disable(gl.SCISSOR_TEST);

    if (this.prefersReducedMotion.matches) {
      this.pause();
      return;
    }

    this.scheduleFrame();
  }

  private drawNodesByType(
    type: 'dots' | 'particle',
    gl: WebGL2RenderingContext,
    dt: number,
    ts: number,
  ): void {
    const vpH = this.canvas.height;
    const { dpr } = this;

    for (const node of this.nodes.values()) {
      if (!node.isVisible || node.programType !== type) continue;

      const rect = node.getRect();
      if (rect.width <= 0 || rect.height <= 0) continue;

      const x = Math.round(rect.left * dpr);
      const y = Math.round(vpH - rect.bottom * dpr);
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);

      gl.scissor(x, y, w, h);
      gl.viewport(x, y, w, h);

      node.tick(dt, ts);
      node.draw(gl, rect.width, rect.height, ts);
    }
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
    const w = document.documentElement.clientWidth;
    const h = document.documentElement.clientHeight;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
  }

  // ---------------------------------------------------------------------------
  // Global observers
  // ---------------------------------------------------------------------------

  private setupGlobalObservers(): void {
    const resizeObserver = new ResizeObserver(() => {
      this.resizeCanvas();
      for (const node of this.nodes.values()) node.markDirty();
    });
    resizeObserver.observe(document.documentElement);

    window.addEventListener('scroll', () => {
      for (const node of this.nodes.values()) node.markDirty();
    }, { passive: true });

    this.boundVisibilityChange = () => {
      document.hidden ? this.pause() : this.resume();
    };
    document.addEventListener('visibilitychange', this.boundVisibilityChange);

    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.boundReducedMotionChange = (e) => {
      e.matches ? this.pause() : this.resume();
    };
    this.prefersReducedMotion.addEventListener('change', this.boundReducedMotionChange);

    this.boundContextLost = (e: Event) => {
      e.preventDefault();
      this.pause();
    };
    this.boundContextRestored = () => {
      const newDots = this.compileDotsProgram(this.gl);
      Object.assign(this.dotsProgram, newDots);
      const newParticle = this.compileParticleProgram(this.gl);
      Object.assign(this.particleProgram, newParticle);
      for (const node of this.nodes.values()) node.onContextRestored(this.gl);
      this.resume();
    };
    this.canvas.addEventListener('webglcontextlost', this.boundContextLost, false);
    this.canvas.addEventListener('webglcontextrestored', this.boundContextRestored, false);
  }

  // ---------------------------------------------------------------------------
  // Program compilation
  // ---------------------------------------------------------------------------

  private compileDotsProgram(gl: WebGL2RenderingContext): DotsProgram {
    const vert = compileShader(gl, gl.VERTEX_SHADER, dotsVertSource);
    const frag = compileShader(gl, gl.FRAGMENT_SHADER, dotsFragSource);
    const program = createProgram(gl, vert, frag);

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
      uCornerRadius: gl.getUniformLocation(program, 'u_corner_radius')!,
    };
  }

  private compileParticleProgram(gl: WebGL2RenderingContext): ParticleProgram {
    const vert = compileShader(gl, gl.VERTEX_SHADER, particleVertSource);
    const frag = compileShader(gl, gl.FRAGMENT_SHADER, particleFragSource);
    const program = createProgram(gl, vert, frag);

    return {
      program,
      aPosition: gl.getAttribLocation(program, 'a_position'),
      aColorIndex: gl.getAttribLocation(program, 'a_color_index'),
      uResolution: gl.getUniformLocation(program, 'u_resolution')!,
      uDpr: gl.getUniformLocation(program, 'u_dpr')!,
      uDotSize: gl.getUniformLocation(program, 'u_dot_size')!,
      uColors: gl.getUniformLocation(program, 'u_colors')!,
      uOpacityMul: gl.getUniformLocation(program, 'u_opacity_mul')!,
      uCornerRadius: gl.getUniformLocation(program, 'u_corner_radius')!,
    };
  }
}
