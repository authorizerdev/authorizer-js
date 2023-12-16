import { defineConfig } from 'tsup';
import pkg from './package.json';
const external = [...Object.keys(pkg.dependencies || {})];

export default defineConfig(() => [
  {
    entryPoints: ['src/index.ts'],
    outDir: 'lib',
    target: 'node16',
    format: ['esm', 'cjs'],
    clean: true,
    dts: true,
    minify: true,
    external,
  },
  {
    entry: { bundle: 'src/index.ts' },
    outDir: 'lib',
    format: ['iife'],
    globalName: 'authorizerdev',
    clean: false,
    minify: true,
    platform: 'browser',
    dts: false,
    name: 'authorizer',
    // esbuild `globalName` option generates `var authorizerdev = (() => {})()`
    // and var is not guaranteed to assign to the global `window` object so we make sure to assign it
    footer: {
      js: 'window.__TAURI__ = authorizerdev',
    },
    outExtension() {
      return {
        js: '.min.js',
      };
    },
    esbuildOptions(options) {
      options.entryNames = 'authorizer';
    },
  },
]);
