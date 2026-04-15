import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import replace from '@rollup/plugin-replace';
import glsl from 'rollup-plugin-glsl';
import { createRequire } from 'node:module';

// Read version and metadata from package.json — single source of truth.
const _require = createRequire(import.meta.url);
const pkg = _require('./package.json');

const banner = `/*!
 * KineticOS v${pkg.version}
 * ${pkg.description}
 * (c) wripcode — https://github.com/wripcode/KineticOS
 * Released under the ${pkg.license} License
 */`;

const input = 'src/index.ts';

const glslPlugin = glsl({ include: '**/*.glsl' });

// Injects pkg.version into the __KINETICOS_VERSION__ placeholder in constants.ts
// so the runtime VERSION always matches package.json without manual sync.
const versionPlugin = replace({
  preventAssignment: true,
  values: {
    __KINETICOS_VERSION__: pkg.version,
  },
});

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
    plugins: [glslPlugin, versionPlugin, tsPlugin(true), terser()],
    output: {
      file: 'dist/kineticos.min.js',
      format: 'esm',
      sourcemap: true,
      banner,
    },
  },
  // IIFE — minified (legacy <script> tag without type="module")
  {
    input,
    plugins: [glslPlugin, versionPlugin, tsPlugin(false), terser()],
    output: {
      file: 'dist/kineticos.iife.min.js',
      format: 'iife',
      name: 'KineticOS',
      sourcemap: true,
      banner,
    },
  },
];
