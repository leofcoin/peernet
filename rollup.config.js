import { execSync } from 'child_process';
import lint from '@rollup/plugin-eslint'
import cjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import modify from 'rollup-plugin-modify';

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
			FETCH_IMPORT: `const fetch = require('node-fetch');`
		})
	]
}, {
	input: 'src/peernet.js',
	output: {
		dir: 'browser',
		format: 'cjs'
	},
	plugins: [
		json(),
		modify({
			FETCH_IMPORT: ``
		}),
		lint({
		  fix: true,
			exclude: ['package.json', "package-lock.json"]
		})

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
