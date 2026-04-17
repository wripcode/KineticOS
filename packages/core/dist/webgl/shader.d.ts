/**
 * Compiles a single GLSL shader stage.
 * Throws in development with the full GLSL source echoed for easy debugging.
 */
export declare function compileShader(gl: WebGL2RenderingContext, type: typeof gl.VERTEX_SHADER | typeof gl.FRAGMENT_SHADER, source: string): WebGLShader;
/**
 * Links a compiled vertex + fragment shader pair into a WebGL program.
 * Deletes both shaders after linking (they are no longer needed on the GPU).
 */
export declare function createProgram(gl: WebGL2RenderingContext, vertShader: WebGLShader, fragShader: WebGLShader): WebGLProgram;
