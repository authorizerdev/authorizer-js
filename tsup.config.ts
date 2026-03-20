import { defineConfig } from 'tsup';
import pkg from './package.json';

const external = [...Object.keys(pkg.dependencies || {})];

export default defineConfig(() => [
  // Node.js builds (ESM + CJS)
  {
    entryPoints: ['src/index.ts'],
    outDir: 'lib',
    target: 'node16',
    format: ['esm', 'cjs'],
    clean: true,
    dts: true,
    minify: false, // Don't minify Node.js builds for better debugging
    sourcemap: true,
    external,
  },
  // Browser IIFE build
  {
    entryPoints: ['src/index.ts'],
    outDir: 'lib',
    format: ['iife'],
    globalName: 'authorizerdev',
    clean: false,
    minify: true,
    platform: 'browser',
    dts: false,
    // esbuild's globalName creates `var authorizerdev = ...` which works in browsers
    // but we ensure it's also on window for compatibility
    footer: {
      js: 'if (typeof window !== "undefined") { window.authorizerdev = authorizerdev; }',
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
