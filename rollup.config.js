import { execSync } from 'child_process';
import json from '@rollup/plugin-json'
import modify from 'rollup-plugin-modify'
import resolve from 'rollup-plugin-node-resolve'

try {
	execSync('rm dist -r')
} catch (e) {

}
export default [{
	input: ['src/peernet.js', 'src/messages/dht.js',
'src/messages/peernet.js', 'src/messages/dht-response.js', 'src/messages/request.js',
'src/messages/response.js'],
	output: {
		dir: 'dist/commonjs',
		format: 'cjs'
	},
	plugins: [
		json(),
		modify({
			HTTP_IMPORT: ``,
			SUBTLE_IMPORT: `const { subtle } = require('crypto').webcrypto`
		})
	]
}, {
	input: 'src/peernet.js',
	output: {
		dir: 'dist/module',
		format: 'cjs',
		externals: ["@leofcoin/storage"]
	},
	plugins: [
		json(),
		modify({
			"import fetch from 'node-fetch'": '',
			HTTP_IMPORT: ``,
			SUBTLE_IMPORT: `const { subtle } = crypto`
		}),
	]
}]
