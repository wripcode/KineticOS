// Type declaration for GLSL shader imports.
// rollup-plugin-glsl inlines these as string constants at build time.
declare module '*.glsl' {
  const source: string;
  export default source;
}
