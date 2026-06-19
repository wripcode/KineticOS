/**
 * Centralised GPU resource tracker for KineticOS.
 *
 * Every buffer and program created through this manager is registered so that:
 * - Total GPU memory stays below a configurable ceiling (default 256 MB).
 * - A single dispose() call reliably cleans up everything after context loss or teardown.
 */

const MAX_BUFFER_MEMORY = 256 * 1024 * 1024; // 256 MB

interface ResourceStats {
  bufferCount: number;
  programCount: number;
  bufferBytes: number;
}

export class WebGLResourceManager {
  private readonly gl: WebGL2RenderingContext;
  private readonly buffers = new Map<WebGLBuffer, number>(); // buffer → byte size
  private readonly programs = new Set<WebGLProgram>();
  private totalBufferBytes = 0;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }

  createBuffer(data: Float32Array, usage: number): WebGLBuffer {
    const byteSize = data.byteLength;

    if (this.totalBufferBytes + byteSize > MAX_BUFFER_MEMORY) {
      console.error(`[KineticOS] GPU buffer memory limit exceeded (${this.totalBufferBytes + byteSize} > ${MAX_BUFFER_MEMORY})`);
      throw new Error('[KineticOS] GPU buffer memory limit exceeded');
    }

    const buf = this.gl.createBuffer();
    if (!buf) throw new Error('[KineticOS] gl.createBuffer failed');

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buf);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, data, usage);

    this.buffers.set(buf, byteSize);
    this.totalBufferBytes += byteSize;

    return buf;
  }

  deleteBuffer(buf: WebGLBuffer | null): void {
    if (!buf) return;
    const byteSize = this.buffers.get(buf) ?? 0;
    this.gl.deleteBuffer(buf);
    this.buffers.delete(buf);
    this.totalBufferBytes = Math.max(0, this.totalBufferBytes - byteSize);
  }

  trackProgram(program: WebGLProgram): void {
    this.programs.add(program);
  }

  deleteProgram(program: WebGLProgram | null): void {
    if (!program) return;
    this.gl.deleteProgram(program);
    this.programs.delete(program);
  }

  /** Clears all tracked handles without calling gl.delete* — used after context loss when handles are already invalid. */
  clearTracking(): void {
    this.buffers.clear();
    this.programs.clear();
    this.totalBufferBytes = 0;
  }

  /** Deletes all tracked resources. Call on full teardown. */
  dispose(): void {
    for (const buf of this.buffers.keys()) this.gl.deleteBuffer(buf);
    for (const prog of this.programs) this.gl.deleteProgram(prog);
    this.clearTracking();
  }

  getStats(): ResourceStats {
    return {
      bufferCount: this.buffers.size,
      programCount: this.programs.size,
      bufferBytes: this.totalBufferBytes,
    };
  }
}
