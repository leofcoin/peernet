import { execSync } from 'child_process';
import json from '@rollup/plugin-json'

export default [{
	input: 'src/peernet.js',
	output: {
		file: 'client.js',
		format: 'cjs'
	},
	plugins: [
		json()
	]
}, {
	input: 'src/codec/codec.js',
	output: {
		file: 'dist/codec/codec.js',
		format: 'cjs'
	},
	plugins: [
		json()
	]
}, {
	input: 'src/hash/hash.js',
	output: {
		file: 'dist/hash/hash.js',
		format: 'cjs'
	},
	plugins: [
		json()
	]
}, {
	input: 'src/messages/dht.js',
	output: {
		file: 'dist/messages/dht.js',
		format: 'cjs'
	},
	plugins: [
		json()
	]
}, {
	input: 'src/messages/peernet.js',
	output: {
		file: 'dist/messages/peernet.js',
		format: 'cjs'
	},
	plugins: [
		json()
	]
}, {
	input: 'src/messages/dht-response.js',
	output: {
		file: 'dist/messages/dht-response.js',
		format: 'cjs'
	},
	plugins: [
		json()
	]
}]