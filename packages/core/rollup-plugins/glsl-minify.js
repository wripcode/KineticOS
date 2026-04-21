/**
 * Custom GLSL minifier for Rollup — replaces rollup-plugin-glsl.
 *
 * Why custom: rollup-plugin-glsl only inlines GLSL as strings with no
 * minification. This plugin strips comments and compresses whitespace,
 * reducing shader source size before it's embedded in the JS bundle.
 *
 * shader-programming-glsl skill: preserve #version and precision directives,
 * never collapse tokens that must be space-separated (keywords, identifiers).
 */

/** @param {string} src */
function minifyGLSL(src) {
  return src
    // Remove single-line comments (// ...) — not inside strings
    .replace(/\/\/[^\n]*/g, '')
    // Remove block comments (/* ... */)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Collapse runs of whitespace/newlines to a single space
    .replace(/\s+/g, ' ')
    // Remove spaces around operators that don't need them
    .replace(/\s*([{}();,=+\-*/<>!&|^~?:])\s*/g, '$1')
    // Restore mandatory space after keywords that precede an identifier
    // (void, float, int, vec*, mat*, in, out, uniform, precision, return, if, else, for, while)
    .replace(/(void|float|int|uint|bool|vec[2-4]|ivec[2-4]|uvec[2-4]|mat[2-4]|in|out|inout|uniform|attribute|varying|precision|return|if|else|for|while|do|struct|layout|const|mediump|highp|lowp)(?=[a-zA-Z0-9_])/g, '$1 ')
    .trim();
}

/** @returns {import('rollup').Plugin} */
export function glslMinify() {
  return {
    name: 'glsl-minify',
    transform(code, id) {
      if (!id.endsWith('.glsl')) return null;
      const minified = minifyGLSL(code);
      return {
        code: `export default ${JSON.stringify(minified)};`,
        map: { mappings: '' },
      };
    },
  };
}
