import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import wasm from '@rollup/plugin-wasm'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { extname, relative, sep } from 'node:path'
import rimraf from 'rimraf'
import typescript from '@rollup/plugin-typescript'

const toPosix = (value) => value.split(sep).join('/')

const walk = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = `${dir}/${entry.name}`
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)))
      continue
    }
    files.push(fullPath)
  }

  return files
}

const isHashedChunk = (runtimePath) => /-[A-Za-z0-9_-]{8,}\.js$/.test(runtimePath)

const normalizeNodePromptImport = () => ({
  name: 'normalize-node-prompt-import',
  writeBundle: async () => {
    const filePath = 'exports/identity.js'
    const code = await readFile(filePath, 'utf8')
    const normalized = code
      .replaceAll("'./src/prompts/password.js'", "'./prompts/password.js'")
      .replace(/(["'])\.\/Users\/[^"']*\/src\/prompts\/password\.js\1/g, '$1./prompts/password.js$1')

    if (normalized !== code) {
      await writeFile(filePath, normalized)
    }
  }
})

const runtimeFirstExports = ({ exportsDir = 'exports', declarationsDir = 'exports/types' } = {}) => ({
  name: 'runtime-first-exports',
  writeBundle: async () => {
    const runtimeFiles = (await walk(exportsDir))
      .map((file) => toPosix(relative(exportsDir, file)))
      .filter((file) => extname(file) === '.js')
      .filter((file) => !file.startsWith('types/'))
      .filter((file) => !isHashedChunk(file))
      .sort((a, b) => a.localeCompare(b))

    const declarationFiles = (await walk(declarationsDir))
      .map((file) => toPosix(relative(declarationsDir, file)))
      .filter((file) => extname(file) === '.ts' && file.endsWith('.d.ts'))

    const declarationByRuntime = new Map(declarationFiles.map((file) => [file.slice(0, -'.d.ts'.length), file]))

    const declarationAliases = {
      'prompts/password': 'prompts/password/node',
      'browser/prompts/password': 'prompts/password/browser',
      'browser/peernet': 'peernet',
      'browser/identity': 'identity'
    }

    const packageExports = {
      '.': { import: './exports/peernet.js', types: './exports/types/peernet.d.ts' },
      './browser': { import: './exports/browser/peernet.js', types: './exports/types/peernet.d.ts' },
      './browser.js': { import: './exports/browser/peernet.js', types: './exports/types/peernet.d.ts' },
      './node': { import: './exports/prompts/password.js', types: './exports/types/prompts/password/node.d.ts' },
      './node.js': { import: './exports/prompts/password.js', types: './exports/types/prompts/password/node.d.ts' }
    }

    for (const runtimeFile of runtimeFiles) {
      const runtimeKey = runtimeFile.slice(0, -'.js'.length)
      const exportKey = `./${runtimeKey}`
      const exportJsKey = `./${runtimeKey}.js`
      const importPath = `./${exportsDir}/${runtimeFile}`
      const declarationKey = declarationAliases[runtimeKey] || runtimeKey
      const declarationPath = declarationByRuntime.get(declarationKey)
      const typesPath = declarationPath ? `./${declarationsDir}/${declarationPath}` : undefined

      packageExports[exportKey] = typesPath ? { import: importPath, types: typesPath } : { import: importPath }
      packageExports[exportJsKey] = typesPath ? { import: importPath, types: typesPath } : { import: importPath }
    }

    const packageJson = JSON.parse(await readFile('./package.json', 'utf8'))
    packageJson.exports = packageExports
    await writeFile('./package.json', `${JSON.stringify(packageJson, null, '  ')}\n`)
  }
})

rimraf.sync('./exports/**')

export default [
  {
    input: ['./src/peernet.ts', './src/identity.ts', './node_modules/@leofcoin/storage/exports/browser-store.js'],
    output: {
      format: 'es',
      dir: 'exports/browser',
      chunkFileNames: (chunkInfo) =>
        chunkInfo.name === 'prompts/password' ? 'prompts/password.js' : '[name]-[hash].js',
      manualChunks: (id) => (id.endsWith('/src/prompts/password.js') ? 'prompts/password' : undefined)
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

      typescript({ compilerOptions: { outDir: 'exports/browser', declaration: false } })
    ]
  },
  {
    input: ['./src/peernet.ts', './src/identity.ts', './node_modules/@leofcoin/storage/exports/store.js'],
    output: {
      format: 'es',
      dir: 'exports',
      paths: (id) => (id === './src/prompts/password.js' ? './prompts/password.js' : id)
    },
    plugins: [
      typescript({
        compilerOptions: {
          outDir: 'exports',
          declarationDir: 'exports/types'
        }
      }),
      normalizeNodePromptImport()
    ],
    external: [
      './prompts/password.js',
      './src/prompts/password.js',
      './prompts/password/browser.js',
      './prompts/password/node.js'
    ]
  },
  {
    input: ['./src/prompts/password/browser.js'],
    output: {
      format: 'es',
      file: 'exports/browser/prompts/password.js'
    }
  },
  {
    input: ['./src/prompts/password/node.js'],
    output: {
      format: 'es',
      file: 'exports/prompts/password.js'
    },
    plugins: [runtimeFirstExports()]
  }
]
