import LegacyWallet from '@leofcoin/multi-wallet-legacy'
import MultiWallet from '@leofcoin/multi-wallet'
import base58 from '@vandeurenglenn/base58'
import { decrypt, encrypt } from '@leofcoin/identity-utils'

export async function migrateLegacyIdentity(identity, accounts, selectedAccount, password, network) {
  if (!identity || typeof identity !== 'object' || identity.importedAccounts !== undefined)
    throw new Error('Identity is missing or already migrated')
  if (identity.network !== undefined && identity.network !== network) throw new Error('Identity network mismatch')
  if (!Array.isArray(accounts) || !accounts.length ||
    accounts.some(account => !Array.isArray(account) || account.length !== 3 ||
      account.some(value => typeof value !== 'string' || !value))) throw new Error('Invalid stored accounts')
  const addresses = accounts.flatMap(([, external, internal]) => [external, internal])
  if (new Set(addresses).size !== addresses.length || !addresses.includes(selectedAccount))
    throw new Error('Stored accounts or selected account are invalid')

  const legacy = new LegacyWallet(network)
  await legacy.fromMultiWif(await decrypt(password, base58.decode(identity.multiWIF)))
  const mnemonic = await decrypt(password, base58.decode(identity.mnemonic))
  const recovered = new LegacyWallet(network)
  await recovered.recover(mnemonic, password, network)
  if (!legacy.privateKey.every((value, index) => value === recovered.privateKey[index]))
    throw new Error('Legacy mnemonic does not match stored wallet')

  let matches
  for (const [offset, index] of [[1, 1], [0, 0]]) {
    const derived = []
    for (const [accountIndex, [, external, internal]] of accounts.entries()) {
      const account = legacy.account(accountIndex + offset)
      const left = await account.external(index)
      const right = await account.internal(index)
      if (await left.address !== external || await right.address !== internal) break
      derived.push(left, right)
    }
    if (derived.length === addresses.length) {
      if (matches) throw new Error('Ambiguous legacy derivation')
      matches = derived
    }
  }
  if (!matches) throw new Error('Legacy wallet does not match all stored accounts')

  const wallets = []
  for (const [index, oldWallet] of matches.entries()) {
    const wallet = new MultiWallet(network)
    await wallet.fromPrivateKey(oldWallet.privateKey, undefined, network)
    if (await wallet.address !== addresses[index]) throw new Error('Migrated account address mismatch')
    const challenge = crypto.getRandomValues(new Uint8Array(32))
    if (!await wallet.verify(await oldWallet.sign(challenge), challenge))
      throw new Error('Migrated account signature mismatch')
    wallets.push({ address: addresses[index], multiWIF: await wallet.multiWIF })
  }
  const payload = JSON.stringify({ schema: 'peernet:imported-accounts:v1', network, wallets })
  return { ...identity, network, importedAccounts: base58.encode(await encrypt(password, payload)) }
}
