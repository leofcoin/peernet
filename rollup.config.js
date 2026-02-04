import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import wasm from '@rollup/plugin-wasm'
import rimraf from 'rimraf'
import typescript from '@rollup/plugin-typescript'
import autoExports from 'rollup-plugin-auto-exports'

rimraf.sync('./exports/**')

export default [
  {
    input: ['./src/peernet.ts', './src/identity.ts', './node_modules/@leofcoin/storage/exports/browser-store.js'],
    output: {
      format: 'es',
      dir: './exports/browser'
    },
    plugins: [
      json(),
      wasm(),
      resolve({
        browser: true,
        preferBuiltins: false,
        mainFields: ['browser', 'module', 'main']
      }),
      commonjs({
        mainFields: ['browser', 'module', 'main']
      }),

      typescript({ compilerOptions: { outDir: './exports/browser', declaration: false } })
    ],
    external: ['./prompts/password.js']
  },
  {
    input: ['./src/peernet.ts', './src/identity.ts', './node_modules/@leofcoin/storage/exports/store.js'],
    output: {
      format: 'es',
      dir: './exports'
    },
    plugins: [
      typescript({
        compilerOptions: {
          outDir: './exports',
          declarationDir: './exports/types'
        }
      }),
      autoExports({
        defaultExports: {
          '.': { import: './exports/peernet.js', types: './exports/types/peernet.d.ts' }
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
