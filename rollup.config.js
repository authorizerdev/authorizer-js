import typescript from '@rollup/plugin-typescript';
import filesize from 'rollup-plugin-filesize';
import { terser } from 'rollup-plugin-terser';

const input = `src/index.ts`;

export default [
	{
		// UMD
		input,
		plugins: [typescript(), filesize(), terser()],
		output: {
			file: `lib/authorizer.min.js`,
			format: 'umd',
			name: 'Authorizer', // this is the name of the global object
			esModule: false,
			sourcemap: true,
		},
	},
	// ESM
	{
		input,
		plugins: [typescript({ outDir: 'lib/esm' })],
		output: [
			{
				dir: 'lib/esm',
				format: 'esm',
				exports: 'default',
				sourcemap: true,
			},
		],
	},
	// cjs
	{
		input,
		plugins: [typescript({ outDir: 'lib/cjs' })],
		output: [
			{
				dir: 'lib/cjs',
				format: 'cjs',
				exports: 'default',
				sourcemap: true,
			},
		],
	},
];
