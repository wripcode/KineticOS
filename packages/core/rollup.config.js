import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import glsl from 'rollup-plugin-glsl';

const input = 'src/index.ts';

const glslPlugin = glsl({ include: '**/*.glsl' });

function tsPlugin(declaration) {
  return typescript({
    tsconfig: './tsconfig.json',
    declaration,
    declarationDir: declaration ? 'dist' : undefined,
    sourceMap: true,
  });
}

/** @type {import('rollup').RollupOptions[]} */
export default [
  // ESM — minified (CDN default, for type="module" script tags)
  {
    input,
    plugins: [glslPlugin, tsPlugin(true), terser()],
    output: {
      file: 'dist/kineticos.min.js',
      format: 'esm',
      sourcemap: true,
    },
  },
  // IIFE — minified (legacy <script> tag without type="module")
  {
    input,
    plugins: [glslPlugin, tsPlugin(false), terser()],
    output: {
      file: 'dist/kineticos.iife.min.js',
      format: 'iife',
      name: 'KineticOS',
      sourcemap: true,
    },
  },
];
