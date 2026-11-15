import { lstat, open, readFile, realpath } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { Storage } from '@leofcoin/storage'
import Identity from '../exports/identity.js'
import { migrateLegacyIdentity } from './migrate-v3-identity.js'

const args = process.argv.slice(2)
const value = flag => {
  const index = args.indexOf(flag)
  if (index < 0 || !args[index + 1] || args[index + 1].startsWith('--'))
    throw new Error(`${flag} is required`)
  return args[index + 1]
}
const decode = bytes => new TextDecoder().decode(bytes)
const root = await realpath(value('--root'))
const password = (await readFile(resolve(value('--password-file')), 'utf8')).trim()
const network = value('--network')
const apply = args.includes('--apply')
if (!password) throw new Error('Empty password file')
for (const name of ['account', 'wallet']) {
  if (!(await lstat(join(root, name, 'CURRENT'))).isFile()) throw new Error(`Missing existing ${name} store`)
}
const accountStore = new Storage('account', root, { homedir: false })
const walletStore = new Storage('wallet', root, { homedir: false })
await accountStore.init()
await walletStore.init()
try {
  if (!await accountStore.has('public') || !await walletStore.has('identity'))
    throw new Error('Existing identity is required')
  const publicIdentity = JSON.parse(decode(await accountStore.get('public')))
  const identity = JSON.parse(decode(await walletStore.get('identity')))
  const accounts = JSON.parse(decode(await walletStore.get('accounts')))
  const selected = decode(await walletStore.get('selected-account'))
  if (!identity.walletId || publicIdentity.walletId !== identity.walletId) throw new Error('Wallet ID mismatch')
  const migrated = await migrateLegacyIdentity(identity, accounts, selected, password, network)

  const originalAccountStore = globalThis.accountStore, originalWalletStore = globalThis.walletStore
  const memoryWallet = {
    has: async key => walletStore.has(key),
    get: async key => key === 'identity' ? new TextEncoder().encode(JSON.stringify(migrated)) : walletStore.get(key)
  }
  try {
    globalThis.accountStore = accountStore
    globalThis.walletStore = memoryWallet
    const restored = new Identity(network)
    await restored.load(password)
    if (restored.selectedAccount !== selected) throw new Error('Migrated selected account mismatch')
    const signature = await restored.sign(new Uint8Array(32).fill(42))
    if (!(signature instanceof Uint8Array) || !signature.length) throw new Error('Migrated signer failed')
  } finally {
    globalThis.accountStore = originalAccountStore
    globalThis.walletStore = originalWalletStore
  }

  if (apply) {
    const backupPath = resolve(value('--backup-file'))
    const snapshot = {}
    for (const [name, store] of [['account', accountStore], ['wallet', walletStore]]) {
      snapshot[name] = (await store.entries()).map(([key, bytes]) => [key, Buffer.from(bytes).toString('base64')])
    }
    const data = JSON.stringify({ schema: 'peernet:identity-store-backup:v1', network, stores: snapshot })
    const backup = await open(backupPath, 'wx', 0o600)
    try { await backup.writeFile(data); await backup.sync() } finally { await backup.close() }
    if (await readFile(backupPath, 'utf8') !== data) throw new Error('Identity backup verification failed')
    await walletStore.put('identity', JSON.stringify(migrated))
    if (decode(await walletStore.get('identity')) !== JSON.stringify(migrated))
      throw new Error('Migrated identity verification failed; retain the backup')
    console.log('Identity migrated; original account and wallet stores backed up.')
  } else console.log('Migration validated; no changes made.')
} finally {
  await Promise.all([accountStore.db.db.close(), walletStore.db.db.close()])
}
