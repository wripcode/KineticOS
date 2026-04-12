import type { DotsConfig } from '../types.js';
import { CanvasEffect } from './base.js';
import { PhysicsModule } from '../physics/index.js';
import { compileShader, createProgram } from '../webgl/shader.js';
import { bindVec2Attrib, createBuffer, updateBuffer } from '../webgl/buffer.js';

// GLSL shader sources — inlined at build time by rollup-plugin-glsl
import vertSource from '../webgl/shaders/dots-shader.vert.glsl';
import fragSource from '../webgl/shaders/dots-shader.frag.glsl';

/** State for the generated dot grid. Rebuilt on each resize. */
interface GridState {
  count: number;
  baseX: Float32Array;
  baseY: Float32Array;
  offsetX: Float32Array;
  offsetY: Float32Array;
  positions: Float32Array; // interleaved x0,y0,x1,y1... for GPU upload
  st2: Float32Array;       // grid cell IDs, static
}

/**
 * Renders an animated WebGL dot grid with optional mouse physics.
 *
 * Rendering approach:
 * - One canvas, direct WebGL2 context (no double-canvas/blit bug)
 * - GL_POINTS — one vertex per dot, position in vertex shader
 * - Physics buffers are DYNAMIC_DRAW; static grid IDs are STATIC_DRAW
 */
export class DotsShaderEffect extends CanvasEffect {
  private gl!: WebGL2RenderingContext;
  private program!: WebGLProgram;

  // Uniform locations — cached at init to avoid per-frame getUniformLocation calls
  private uResolution!: WebGLUniformLocation;
  private uTime!: WebGLUniformLocation;
  private uDpr!: WebGLUniformLocation;

  // Buffers
  private positionBuffer!: WebGLBuffer;
  private st2Buffer!: WebGLBuffer;

  // Attribute locations
  private aPosition!: number;
  private aSt2!: number;

  private grid: GridState | null = null;
  private physics: PhysicsModule | null = null;

  constructor(private readonly dotsConfig: DotsConfig) {
    super(dotsConfig);
  }

  protected init(): void {
    const gl = this.canvas.getContext('webgl2');
    if (!gl) {
      console.error('[KineticOS] WebGL2 not available — dots-shader will not render.');
      return;
    }
    this.gl = gl;

    const vert = compileShader(gl, gl.VERTEX_SHADER, vertSource);
    const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSource);
    this.program = createProgram(gl, vert, frag);
    gl.useProgram(this.program);

    // Cache attribute locations
    this.aPosition = gl.getAttribLocation(this.program, 'a_position');
    this.aSt2 = gl.getAttribLocation(this.program, 'a_st2');

    // Cache uniform locations
    this.uResolution = gl.getUniformLocation(this.program, 'u_resolution')!;
    this.uTime = gl.getUniformLocation(this.program, 'u_time')!;
    this.uDpr = gl.getUniformLocation(this.program, 'u_dpr')!;

    // Upload static uniforms — these never change per-frame
    this.uploadStaticUniforms();

    // Blending — additive for a glowing light effect
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.disable(gl.DEPTH_TEST);

    // Create physics module only when mouse is enabled
    if (this.dotsConfig.mouseEnabled) {
      this.physics = new PhysicsModule(
        this.dotsConfig.physicsValues,
        this.dotsConfig.rippleEnabled,
      );
      this.physics.attach(this.canvas);
    }
  }

  protected onResize(cssW: number, cssH: number): void {
    if (!this.gl) return;
    const { gl, program, dpr } = this;

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(program);
    gl.uniform2f(this.uResolution, cssW, cssH);
    gl.uniform1f(this.uDpr, dpr);

    this.grid = this.buildGrid(cssW, cssH);
    this.uploadGrid(this.grid);

    // Rebuild spatial hash after grid change
    if (this.physics && this.grid) {
      this.physics.rebuildSpatial(this.grid.baseX, this.grid.baseY, this.grid.count);
    }
  }

  protected renderFrame(_dt: number): void {
    if (!this.gl || !this.grid) return;
    const { gl, grid } = this;

    gl.useProgram(this.program);
    gl.uniform1f(this.uTime, this.totalTime);

    let dirty = false;

    // When physics is active, advance simulation and update positions buffer
    if (this.physics) {
      const hasMotion = this.physics.tick(
        grid.baseX,
        grid.baseY,
        grid.offsetX,
        grid.offsetY,
        grid.count,
      );

      if (hasMotion) {
        // Write current positions (base + offset) into flat array for GPU upload
        for (let i = 0; i < grid.count; i++) {
          grid.positions[i * 2] = (grid.baseX[i] ?? 0) + (grid.offsetX[i] ?? 0);
          grid.positions[i * 2 + 1] = (grid.baseY[i] ?? 0) + (grid.offsetY[i] ?? 0);
        }
        dirty = true;
      }
    }

    if (dirty) {
      updateBuffer(gl, this.positionBuffer, grid.positions);
      // Re-bind attrib after buffer update
      bindVec2Attrib(gl, this.positionBuffer, this.aPosition);
    }

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, grid.count);
  }

  override destroy(): void {
    this.physics?.detach();
    super.destroy();
  }

  // ---------------------------------------------------------------------------
  // Grid generation
  // ---------------------------------------------------------------------------

  /**
   * Generates the initial dot grid from CSS pixel dimensions.
   * Padding ensures dots are centered within the canvas (same Webflow behavior).
   */
  private buildGrid(cssW: number, cssH: number): GridState {
    const { totalSize, dotSize } = this.dotsConfig;

    const gridX = Math.ceil(cssW / totalSize) + 1;
    const gridY = Math.ceil(cssH / totalSize) + 1;
    const count = gridX * gridY;

    const baseX = new Float32Array(count);
    const baseY = new Float32Array(count);
    const offsetX = new Float32Array(count);
    const offsetY = new Float32Array(count);
    const positions = new Float32Array(count * 2);
    const st2 = new Float32Array(count * 2);

    // Center the grid within the canvas
    const padX = Math.abs(Math.floor(((cssW % totalSize) - dotSize) * 0.5));
    const padY = Math.abs(Math.floor(((cssH % totalSize) - dotSize) * 0.5));

    let i = 0;
    for (let y = 0; y < gridY; y++) {
      for (let x = 0; x < gridX; x++) {
        const px = x * totalSize + padX + dotSize * 0.5;
        const py = y * totalSize + padY + dotSize * 0.5;

        baseX[i] = px;
        baseY[i] = py;
        positions[i * 2] = px;
        positions[i * 2 + 1] = py;
        st2[i * 2] = x;
        st2[i * 2 + 1] = y;

        i++;
      }
    }

    return { count, baseX, baseY, offsetX, offsetY, positions, st2 };
  }

  // ---------------------------------------------------------------------------
  // Buffer management
  // ---------------------------------------------------------------------------

  private uploadGrid(grid: GridState): void {
    const { gl, aPosition, aSt2 } = this;
    const usage = this.physics ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW;

    // Positions buffer — DYNAMIC if physics, STATIC if not
    this.positionBuffer = createBuffer(gl, grid.positions, usage);
    bindVec2Attrib(gl, this.positionBuffer, aPosition);

    // st2 buffer — always static (grid cell IDs never change)
    this.st2Buffer = createBuffer(gl, grid.st2, gl.STATIC_DRAW);
    bindVec2Attrib(gl, this.st2Buffer, aSt2);
  }

  private uploadStaticUniforms(): void {
    const { gl, program, dotsConfig, dpr } = this;
    gl.useProgram(program);

    gl.uniform1f(gl.getUniformLocation(program, 'u_dot_size')!, dotsConfig.dotSize);
    gl.uniform1f(gl.getUniformLocation(program, 'u_total_size')!, dotsConfig.totalSize);
    gl.uniform1f(this.uDpr, dpr);

    // Upload 10-element opacity array
    gl.uniform1fv(
      gl.getUniformLocation(program, 'u_opacities')!,
      dotsConfig.opacities as number[],
    );

    // Upload 6 vec3 colors as a flat float array
    const flatColors = (dotsConfig.colors as [number, number, number][]).flatMap((c) => c);
    gl.uniform3fv(gl.getUniformLocation(program, 'u_colors')!, flatColors);
  }
}
