/**
 * Compiles a single GLSL shader stage.
 * Throws in development with the full GLSL source echoed for easy debugging.
 */
export function compileShader(
  gl: WebGL2RenderingContext,
  type: typeof gl.VERTEX_SHADER | typeof gl.FRAGMENT_SHADER,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('[KineticOS] gl.createShader failed');

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'unknown error';
    gl.deleteShader(shader);
    throw new Error(`[KineticOS] Shader compile error:\n${log}`);
  }

  return shader;
}

/**
 * Links a compiled vertex + fragment shader pair into a WebGL program.
 * Deletes both shaders after linking (they are no longer needed on the GPU).
 */
export function createProgram(
  gl: WebGL2RenderingContext,
  vertShader: WebGLShader,
  fragShader: WebGLShader,
): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error('[KineticOS] gl.createProgram failed');

  gl.attachShader(program, vertShader);
  gl.attachShader(program, fragShader);
  gl.linkProgram(program);

  // Shaders are now baked into the program — free GPU side-objects
  gl.deleteShader(vertShader);
  gl.deleteShader(fragShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'unknown error';
    gl.deleteProgram(program);
    throw new Error(`[KineticOS] Program link error:\n${log}`);
  }

  return program;
}
