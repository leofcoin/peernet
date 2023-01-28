import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import wasm from '@rollup/plugin-wasm'
import rimraf from 'rimraf';
import typescript from '@rollup/plugin-typescript';
import tsconfig from './tsconfig.json' assert { type: 'json'}

rimraf.sync('./exports/**')


export default [{
  input: ['./src/peernet.ts', './src/prompts/password/browser.js', './node_modules/@leofcoin/storage/exports/browser-store.js'],
  output: {
    format: 'es',
    dir: './exports/browser'
  },
  plugins: [
    json(),
    wasm(),
    commonjs(),
    resolve({
      mainFields: ["browser", "module", "main"]
    }),
    typescript({...tsconfig, outDir: './exports/browser'})
  ],
  external: [
    './prompts/password/node.js'
  ]
}, {
  input: ['./src/peernet.ts', './src/prompts/password/node.js', './node_modules/@leofcoin/storage/exports/store.js'],
  output: {
    format: 'es',
    dir: './exports'
  },
  plugins: [
    typescript({...tsconfig, outDir: './exports'})
  ],
  external: [
    './prompts/password/browser.js'
  ]
}]