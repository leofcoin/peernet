import assert from 'node:assert/strict'
import test from 'node:test'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { Storage } from '@leofcoin/storage'
import LegacyWallet from '@leofcoin/multi-wallet-legacy'
import MultiWallet from '@leofcoin/multi-wallet'
import base58 from '@vandeurenglenn/base58'
import { decrypt, encrypt } from '@leofcoin/identity-utils'
import Identity from '../exports/identity.js'
import { migrateLegacyIdentity } from '../scripts/migrate-v3-identity.js'

const password = 'migration-test-password'
const network = 'leofcoin:peach'
const encode = value => new TextEncoder().encode(value)

async function fixture(accountIndex, addressIndex) {
  const legacy = new LegacyWallet(network)
  const mnemonic = await legacy.generate(password, network)
  const external = await legacy.account(accountIndex).external(addressIndex)
  const internal = await legacy.account(accountIndex).internal(addressIndex)
  const accounts = [['main', await external.address, await internal.address]]
  const identity = {
    walletId: await external.id,
    mnemonic: base58.encode(await encrypt(password, mnemonic)),
    multiWIF: base58.encode(await encrypt(password, await legacy.multiWIF))
  }
  return { identity, accounts, selected: accounts[0][1] }
}

for (const [accountIndex, addressIndex] of [[0, 0], [1, 1]]) {
  test(`migrates v3 account ${accountIndex}/${addressIndex} without changing its signer`, async () => {
    const { identity, accounts, selected } = await fixture(accountIndex, addressIndex)
    const original = structuredClone(identity)
    const migrated = await migrateLegacyIdentity(identity, accounts, selected, password, network)
    assert.deepEqual(identity, original)
    assert.equal(migrated.multiWIF, original.multiWIF)
    assert.equal(migrated.mnemonic, original.mnemonic)

    const values = new Map([
      ['identity', encode(JSON.stringify(migrated))],
      ['accounts', encode(JSON.stringify(accounts))],
      ['selected-account', encode(selected)]
    ])
    const oldAccountStore = globalThis.accountStore, oldWalletStore = globalThis.walletStore
    globalThis.accountStore = {
      has: async () => true,
      get: async () => encode(JSON.stringify({ walletId: identity.walletId }))
    }
    globalThis.walletStore = {
      has: async key => values.has(key),
      get: async key => values.get(key),
      put: async (key, value) => values.set(key, encode(value))
    }
    try {
      const restored = new Identity(network)
      await assert.rejects(restored.load('incorrect-password'))
      await restored.load(password)
      assert.equal(restored.selectedAccount, selected)
      const hash = crypto.getRandomValues(new Uint8Array(32))
      const verifier = new MultiWallet(network)
      await verifier.fromAddress(selected, undefined, network)
      assert.equal(await verifier.verify(await restored.sign(hash), hash), true)
      await assert.rejects(restored.export(password), /complete wallet store/)
      await restored.lock(password)
      assert.throws(() => restored.sign(hash), /no signer/)
      await assert.rejects(restored.unlock('incorrect-password'))
      await restored.unlock(password)
      assert.equal(await verifier.verify(await restored.sign(hash), hash), true)
      const restarted = new Identity(network)
      await restarted.load(password)
      assert.equal(await verifier.verify(await restarted.sign(hash), hash), true)
      const payload = JSON.parse(await decrypt(password, base58.decode(migrated.importedAccounts)))
      payload.wallets[0].address = accounts[0][2]
      const tampered = { ...migrated, importedAccounts: base58.encode(await encrypt(password, JSON.stringify(payload))) }
      values.set('identity', encode(JSON.stringify(tampered)))
      await assert.rejects(new Identity(network).load(password), /account address mismatch|Invalid imported identity account/)
    } finally {
      globalThis.accountStore = oldAccountStore
      globalThis.walletStore = oldWalletStore
    }
  })
}

test('migration rejects wrong credentials, changed accounts and an already migrated identity', async () => {
  const { identity, accounts, selected } = await fixture(0, 0)
  await assert.rejects(migrateLegacyIdentity(identity, accounts, selected, 'incorrect-password', network))
  await assert.rejects(migrateLegacyIdentity(identity, [['main', accounts[0][2], selected]], selected, password, network), /does not match/)
  await assert.rejects(migrateLegacyIdentity({ ...identity, importedAccounts: 'existing' }, accounts, selected, password, network), /already migrated/)
})

test('store migration requires a verified backup and leaves the original account data intact', async () => {
  const root = await mkdtemp(join(tmpdir(), 'peernet-v3-migration-'))
  const { identity, accounts, selected } = await fixture(0, 0)
  const account = new Storage('account', root, { homedir: false })
  const wallet = new Storage('wallet', root, { homedir: false })
  await Promise.all([account.init(), wallet.init()])
  try {
    await account.put('public', JSON.stringify({ walletId: identity.walletId }))
    await wallet.put('identity', JSON.stringify(identity))
    await wallet.put('accounts', JSON.stringify(accounts))
    await wallet.put('selected-account', selected)
    await Promise.all([account.db.db.close(), wallet.db.db.close()])
    const passwordFile = join(root, 'password')
    const backupFile = join(root, 'backup')
    await writeFile(passwordFile, password, { mode: 0o600 })
    const run = promisify(execFile)
    const args = ['scripts/migrate-v3-store.js', '--root', root, '--password-file', passwordFile, '--network', network]
    const cwd = new URL('..', import.meta.url)
    await run(process.execPath, args, { cwd })
    await assert.rejects(run(process.execPath, [...args, '--apply'], { cwd }), /--backup-file is required/)
    await run(process.execPath, [...args, '--apply', '--backup-file', backupFile], { cwd })
    assert.equal((await stat(backupFile)).mode & 0o777, 0o600)
    const backup = JSON.parse(await readFile(backupFile, 'utf8'))
    const originalIdentity = backup.stores.wallet.find(([key]) => key === 'identity')
    assert.deepEqual(JSON.parse(Buffer.from(originalIdentity[1], 'base64')), identity)
    const reopened = new Storage('wallet', root, { homedir: false })
    await reopened.init()
    try {
      assert.deepEqual(JSON.parse(new TextDecoder().decode(await reopened.get('accounts'))), accounts)
      assert.equal(new TextDecoder().decode(await reopened.get('selected-account')), selected)
      assert.ok(JSON.parse(new TextDecoder().decode(await reopened.get('identity'))).importedAccounts)
    } finally { await reopened.db.db.close() }
  } finally { await rm(root, { recursive: true, force: true }) }
})
