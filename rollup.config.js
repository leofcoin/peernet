import { execSync } from 'child_process';
import lint from '@rollup/plugin-eslint'
import json from '@rollup/plugin-json'
import modify from 'rollup-plugin-modify'

try {
	execSync('rm dist -r')
} catch (e) {

}
export default [{
	input: ['src/peernet.js', 'src/messages/dht.js',
'src/messages/peernet-message.js', 'src/messages/dht-response.js', 'src/messages/request.js',
'src/messages/response.js'],
	output: {
		dir: 'dist/commonjs',
		format: 'cjs'
	},
	plugins: [
		json(),
		modify({
			HTTP_IMPORT: `if (this.hasDaemon) {
				const httpClient = await import('./http/client/client.js')
				globalThis.peernet.client = await httpClient.default({
					protocol: 'peernet-v0.1.0', host: '127.0.0.1', port: options.port
				})
			} else {
				const http = await import('./http/http.js')
	      if (environment !== 'browser') http.default(options)
	    }`,
			SUBTLE_IMPORT: `const { subtle } = require('crypto').webcrypto`
		})
	]
}, {
	input: 'src/peernet.js',
	output: {
		dir: 'dist/browser/',
		format: 'cjs'
	},
	plugins: [
		json(),
		modify({
			"import fetch from 'node-fetch'": '',
			HTTP_IMPORT: ``,
			SUBTLE_IMPORT: `const { subtle } = crypto`
		}),
		// lint({
		//   fix: true,
		// 	exclude: ['package.json', "package-lock.json"]
		// })
	]
}, {
	input: 'src/peernet.js',
	output: {
		file: 'dist/module/peernet.js',
		format: 'es'
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
