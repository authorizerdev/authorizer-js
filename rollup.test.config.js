import typescript from '@rollup/plugin-typescript';
import serve from 'rollup-plugin-serve';

export default {
	input: 'src/index.ts',
	watch: {
		include: 'src/*',
	},
	plugins: [
		typescript(),
		serve({
			contentBase: '__test__',
			verbose: true,
		}),
	],
	output: {
		file: `__test__/lib/authorizer.js`,
		format: 'umd',
		name: 'authorizerdev', // this is the name of the global object
		esModule: false,
		sourcemap: true,
	},
};
