import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import replace from '@rollup/plugin-replace';
import { glslMinify } from './rollup-plugins/glsl-minify.js';
import { visualizer } from 'rollup-plugin-visualizer';
import { createRequire } from 'node:module';

const _require = createRequire(import.meta.url);
const pkg = _require('./package.json');

const banner = `/*!
 * KineticOS v${pkg.version}
 * ${pkg.description}
 * (c) wripcode — https://github.com/wripcode/KineticOS
 * Released under the ${pkg.license} License
 */`;

const glslPlugin = glslMinify();

const analyzePlugins = process.env.ANALYZE
  ? [visualizer({ filename: 'bundle-analysis.html', open: true, gzipSize: true })]
  : [];

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

/** @type {import('rollup').RollupOptions} */
export default {
  input: {
    'kineticos':                    'src/index.ts',
    'effects/dots-shader/index':    'src/effects/dots-shader/index.ts',
    'effects/image-particle/index': 'src/effects/image-particle/index.ts',
  },
  output: {
    dir: 'dist',
    format: 'esm',
    entryFileNames: '[name].min.js',
    chunkFileNames: 'chunks/[name]-[hash].min.js',
    sourcemap: true,
    banner,
  },
  plugins: [glslPlugin, versionPlugin, tsPlugin(true), terser(), ...analyzePlugins],
};
