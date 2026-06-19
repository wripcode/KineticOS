import { describe, it, expect, beforeEach } from 'vitest';
import { WebGLResourceManager } from './resource-manager';

// ---------------------------------------------------------------------------
// Mock WebGL2 context — minimal stub for resource manager tests
// ---------------------------------------------------------------------------

function makeGl() {
  const buffers = new Set<object>();
  const programs = new Set<object>();

  const gl = {
    ARRAY_BUFFER: 0x8892,
    STATIC_DRAW: 0x88b4,
    createBuffer: () => {
      const buf = {};
      buffers.add(buf);
      return buf;
    },
    deleteBuffer: (buf: object | null) => {
      if (buf) buffers.delete(buf);
    },
    bindBuffer: () => {},
    bufferData: () => {},
    createProgram: () => {
      const prog = {};
      programs.add(prog);
      return prog;
    },
    deleteProgram: (prog: object | null) => {
      if (prog) programs.delete(prog);
    },
    _buffers: buffers,
    _programs: programs,
  };

  return gl as unknown as WebGL2RenderingContext & { _buffers: Set<object>; _programs: Set<object> };
}

// ---------------------------------------------------------------------------
// WebGLResourceManager — buffer tracking
// ---------------------------------------------------------------------------

describe('WebGLResourceManager — buffer creation', () => {
  let gl: ReturnType<typeof makeGl>;
  let manager: WebGLResourceManager;

  beforeEach(() => {
    gl = makeGl();
    manager = new WebGLResourceManager(gl);
  });

  it('creates a buffer and tracks it', () => {
    const data = new Float32Array([1, 2, 3]);
    const buf = manager.createBuffer(data, gl.STATIC_DRAW);
    expect(buf).toBeTruthy();
    expect(manager.getStats().bufferCount).toBe(1);
    expect(manager.getStats().bufferBytes).toBe(data.byteLength);
  });

  it('deletes a buffer and removes it from tracking', () => {
    const data = new Float32Array([1, 2, 3]);
    const buf = manager.createBuffer(data, gl.STATIC_DRAW);
    manager.deleteBuffer(buf);
    expect(manager.getStats().bufferCount).toBe(0);
    expect(manager.getStats().bufferBytes).toBe(0);
  });

  it('deleteBuffer(null) is a no-op', () => {
    expect(() => manager.deleteBuffer(null)).not.toThrow();
    expect(manager.getStats().bufferCount).toBe(0);
  });

  it('tracks multiple buffers independently', () => {
    const a = manager.createBuffer(new Float32Array(10), gl.STATIC_DRAW);
    const b = manager.createBuffer(new Float32Array(20), gl.STATIC_DRAW);
    expect(manager.getStats().bufferCount).toBe(2);
    expect(manager.getStats().bufferBytes).toBe((10 + 20) * 4);
    manager.deleteBuffer(a);
    expect(manager.getStats().bufferCount).toBe(1);
    expect(manager.getStats().bufferBytes).toBe(20 * 4);
    manager.deleteBuffer(b);
    expect(manager.getStats().bufferCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// WebGLResourceManager — memory limit enforcement
// ---------------------------------------------------------------------------

describe('WebGLResourceManager — memory limits', () => {
  it('throws when total buffer memory would exceed 256 MB', () => {
    const gl = makeGl();
    const manager = new WebGLResourceManager(gl);

    // Allocate just under the limit (256 MB - 1 float)
    const bigData = new Float32Array(256 * 1024 * 1024 / 4 - 1);
    manager.createBuffer(bigData, gl.STATIC_DRAW);

    // Next allocation should exceed the limit
    expect(() => {
      manager.createBuffer(new Float32Array(10), gl.STATIC_DRAW);
    }).toThrow(/memory limit/i);
  });
});

// ---------------------------------------------------------------------------
// WebGLResourceManager — program tracking
// ---------------------------------------------------------------------------

describe('WebGLResourceManager — program tracking', () => {
  let gl: ReturnType<typeof makeGl>;
  let manager: WebGLResourceManager;

  beforeEach(() => {
    gl = makeGl();
    manager = new WebGLResourceManager(gl);
  });

  it('tracks programs via trackProgram()', () => {
    const prog = {} as WebGLProgram;
    manager.trackProgram(prog);
    expect(manager.getStats().programCount).toBe(1);
  });

  it('deleteProgram() removes from tracking', () => {
    const prog = {} as WebGLProgram;
    manager.trackProgram(prog);
    manager.deleteProgram(prog);
    expect(manager.getStats().programCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// WebGLResourceManager — dispose and clearTracking
// ---------------------------------------------------------------------------

describe('WebGLResourceManager — dispose', () => {
  it('dispose() zeroes all stats', () => {
    const gl = makeGl();
    const manager = new WebGLResourceManager(gl);
    manager.createBuffer(new Float32Array(100), gl.STATIC_DRAW);
    manager.trackProgram({} as WebGLProgram);
    manager.dispose();
    const stats = manager.getStats();
    expect(stats.bufferCount).toBe(0);
    expect(stats.programCount).toBe(0);
    expect(stats.bufferBytes).toBe(0);
  });

  it('clearTracking() clears stats without calling gl.delete*', () => {
    const gl = makeGl();
    const manager = new WebGLResourceManager(gl);
    manager.createBuffer(new Float32Array(10), gl.STATIC_DRAW);
    manager.clearTracking();
    expect(manager.getStats().bufferCount).toBe(0);
    // gl._buffers still has the object (clearTracking doesn't call deleteBuffer)
    expect(gl._buffers.size).toBe(1);
  });
});
