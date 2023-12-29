import resolve, { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import wasm from '@rollup/plugin-wasm'
import rimraf from 'rimraf'
import typescript from '@rollup/plugin-typescript'
import modify from 'rollup-plugin-modify'

rimraf.sync('./exports/**')

export default [
  {
    input: ['./src/peernet.ts', './node_modules/@leofcoin/storage/exports/browser-store.js'],
    output: {
      format: 'es',
      dir: './exports/browser'
    },
    plugins: [
      json(),
      wasm(),
      modify({
        "await import('@netpeer/swarm/client')": (await import('@netpeer/swarm/browser')).default.toString()
      }),
      resolve({
        browser: true,
        preferBuiltins: false,
        mainFields: ['browser', 'module', 'main']
      }),
      commonjs({
        mainFields: ['browser', 'module', 'main']
      }),

      typescript({ compilerOptions: { outDir: './exports/browser' } })
    ],
    external: ['./prompts/password.js']
  },
  {
    input: ['./src/peernet.ts', './node_modules/@leofcoin/storage/exports/store.js'],
    output: {
      format: 'es',
      dir: './exports'
    },
    plugins: [
      modify({
        '@netpeer/swarm/client': '@netpeer/swarm/client'
      }),
      typescript({
        compilerOptions: {
          outDir: './exports',
          declarationDir: './exports/types'
        }
      })
    ],
    external: ['./prompts/password.js']
  },
  {
    input: ['./src/prompts/password/browser.js'],
    output: {
      format: 'es',
      file: './exports/browser/src/prompts/password.js'
    }
  },
  {
    input: ['./src/prompts/password/node.js'],
    output: {
      format: 'es',
      file: './exports/src/prompts/password.js'
    }
  }
]
