import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import wasm from '@rollup/plugin-wasm'
import rimraf from 'rimraf'
import typescript from '@rollup/plugin-typescript'
rimraf.sync('./exports/**')


export default [{
  input: ['./src/peernet.ts', './node_modules/@leofcoin/storage/exports/browser-store.js'],
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
    })
  ]
}, {
  input: ['./src/peernet.ts', './node_modules/@leofcoin/storage/exports/store.js'],
  output: {
    format: 'es',
    dir: './exports'
  }
}]