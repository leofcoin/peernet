import { execSync } from 'child_process';
import lint from '@rollup/plugin-eslint'
import resolve from '@rollup/plugin-node-resolve'
import cjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import modify from 'rollup-plugin-modify'
import nativePlugin from 'rollup-plugin-natives';
import polyfills from 'rollup-plugin-node-polyfills'

try {
	execSync('rm dist -r')
} catch (e) {

}
export default [{
	input: ['src/peernet.js', 'src/codec/codec.js', 'src/hash/hash.js', 'src/messages/dht.js',
'src/messages/peernet-message.js', 'src/messages/dht-response.js', 'src/messages/request.js',
'src/messages/response.js', 'src/codec/codec-format-interface.js'],
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
	    }`
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
			HTTP_IMPORT: ``
		}),
		// nativePlugin(),
		// polyfills(),
		// resolve({
		// 	preferBuiltins: true,
		// 	mainFields: ["browser", "module", "main"],
		// 	extensions: ['.mjs', '.js', '.json']
		// }),
		// cjs({
		// 	exclude: ['*.node'],
		// 	extensions: ['.js']
		// }),
		// lint({
		//   fix: true,
		// 	exclude: ['package.json', "package-lock.json"]
		// })


	]
}, {
	input: 'src/peernet.js',
	output: {
		dir: 'dist/module/',
		format: 'es'
	},
	plugins: [
		json(),
		modify({
			FETCH_IMPORT: ''
		})
	]
}]
