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
  // Extract and stash preprocessor directives (#version, #extension, #define, etc.).
  // They MUST end with a real newline — whitespace collapsing would break them.
  const directives = [];
  const withoutDirectives = src.replace(/^[ \t]*#[^\n]*/gm, (match) => {
    directives.push(match.trim());
    return '';
  });

  const body = withoutDirectives
    // Remove single-line comments
    .replace(/\/\/[^\n]*/g, '')
    // Remove block comments
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Collapse all whitespace
    .replace(/\s+/g, ' ')
    // Remove spaces around operators
    .replace(/\s*([{}();,=+\-*/<>!&|^~?:])\s*/g, '$1')
    // Restore mandatory space after GLSL keywords — word boundary on both sides
    // prevents matching inside longer identifiers (e.g. 'random', 'uniform', 'intro')
    .replace(/\b(void|float|int|uint|bool|vec[2-4]|ivec[2-4]|uvec[2-4]|mat[2-4]|inout|in|out|uniform|attribute|varying|precision|return|if|else|for|while|do|struct|layout|const|mediump|highp|lowp)\b(?=[a-zA-Z0-9_])/g, '$1 ')
    .trim();

  // Prepend directives, each on its own line, then the minified body.
  return directives.length > 0 ? `${directives.join('\n')}\n${body}` : body;
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
