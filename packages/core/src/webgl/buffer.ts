/**
 * Allocates a GPU buffer and uploads data.
 * @param usage - gl.STATIC_DRAW or gl.DYNAMIC_DRAW
 */
export function createBuffer(
  gl: WebGL2RenderingContext,
  data: Float32Array,
  usage: number,
): WebGLBuffer {
  const buffer = gl.createBuffer();
  if (!buffer) throw new Error('[KineticOS] gl.createBuffer failed');

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, usage);

  return buffer;
}

/**
 * Uploads new data to an already-allocated DYNAMIC_DRAW buffer.
 * Uses bufferSubData to avoid re-allocating GPU memory each frame.
 */
export function updateBuffer(
  gl: WebGL2RenderingContext,
  buffer: WebGLBuffer,
  data: Float32Array,
): void {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
}

/**
 * Convenience: binds a buffer and wires up a vec2 vertex attribute pointer.
 * Used for both static (st2) and dynamic (positions) arrays.
 */
export function bindVec2Attrib(
  gl: WebGL2RenderingContext,
  buffer: WebGLBuffer,
  location: number,
): void {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
}
