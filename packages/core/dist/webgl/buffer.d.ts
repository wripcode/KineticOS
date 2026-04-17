/**
 * Allocates a GPU buffer and uploads data.
 * @param usage - gl.STATIC_DRAW or gl.DYNAMIC_DRAW
 */
export declare function createBuffer(gl: WebGL2RenderingContext, data: Float32Array, usage: number): WebGLBuffer;
/**
 * Uploads new data to an already-allocated DYNAMIC_DRAW buffer.
 * Uses bufferSubData to avoid re-allocating GPU memory each frame.
 */
export declare function updateBuffer(gl: WebGL2RenderingContext, buffer: WebGLBuffer, data: Float32Array): void;
/**
 * Convenience: binds a buffer and wires up a vec2 vertex attribute pointer.
 * Used for both static (st2) and dynamic (positions) arrays.
 */
export declare function bindVec2Attrib(gl: WebGL2RenderingContext, buffer: WebGLBuffer, location: number): void;
