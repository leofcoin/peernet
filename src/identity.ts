import MultiWallet from '@leofcoin/multi-wallet'
import base58 from '@vandeurenglenn/base58'
import type { base58String } from '@vandeurenglenn/base58'
import { encrypt, decrypt } from '@leofcoin/identity-utils'
import QrScanner from 'qr-scanner'
import qrcode from 'qrcode'

type StoredAccount = [name: string, externalAddress: string, internalAddress: string]
type AccountWallet = {
  address: Promise<string>
  sign: (hash: Uint8Array) => Promise<Uint8Array>
  clearPrivateKey?: () => void
}

type MigratedAccounts = {
  schema: 'peernet:imported-accounts:v1'
  network: string
  wallets: { address: string; multiWIF: string }[]
}

const accountDerivationSchemes = [
  {
    name: 'current',
    accountIndex: (index: number) => index + 1,
    addressIndex: 1
  },
  {
    name: 'legacy-v1',
    accountIndex: (index: number) => index,
    addressIndex: 0
  }
] as const

export const resolveAccountWallets = async (
  wallet: MultiWallet,
  accounts: StoredAccount[]
): Promise<Map<string, AccountWallet>> => {
  for (const scheme of accountDerivationSchemes) {
    const wallets = new Map<string, AccountWallet>()
    let matches = true

    for (const [index, [, externalAddress, internalAddress]] of accounts.entries()) {
      const account = wallet.account(scheme.accountIndex(index))
      const external = (await account.external(scheme.addressIndex)) as unknown as AccountWallet
      const internal = (await account.internal(scheme.addressIndex)) as unknown as AccountWallet

      if ((await external.address) !== externalAddress || (await internal.address) !== internalAddress) {
        matches = false
        break
      }
      wallets.set(externalAddress, external)
      wallets.set(internalAddress, internal)
    }

    if (matches) return wallets
  }

  throw new Error('stored accounts do not match this identity under a supported derivation scheme')
}

export default class Identity {
  #wallet: MultiWallet
  #accountWallets = new Map<string, AccountWallet>()
  #importedAccounts = false
  #importedLocked = false
  network
  id: string
  selectedAccount: string

  constructor(network: string) {
    this.network = network
  }

  get accounts(): Promise<[[name: string, externalAddress: string, internalAddress: string]]> {
    return this.getAccounts()
  }

  async getAccounts(): Promise<[[name: string, externalAddress: string, internalAddress: string]]> {
    let accounts = await globalThis.walletStore.get('accounts')
    accounts = new TextDecoder().decode(accounts)
    return JSON.parse(accounts)
  }

  async load(password?: string, fresh = false): Promise<void> {
    if (password && password.includes('.txt')) {
      const { readFile } = await import('fs/promises')
      try {
        password = (await readFile(password)).toString()
      } catch (error) {
        console.error(error)
      }
    }
    if (!password) {
      // @ts-ignore
      const importee: { default: () => Promise<string> } = await import('./prompts/password.js')
      password = await importee.default()
    }

    // LevelDB opens lazily. Touch both stores before freshIdentity clears them;
    // clearing a brand-new, unopened store throws LEVEL_DATABASE_NOT_OPEN.
    const [accountExists] = await Promise.all([
      globalThis.accountStore.has('public'),
      globalThis.walletStore.has('identity')
    ])
    if (accountExists && !fresh) {
      const pub = await globalThis.accountStore.get('public')
      this.id = JSON.parse(new TextDecoder().decode(pub)).walletId
      const selected = await globalThis.walletStore.get('selected-account')
      this.selectedAccount = new TextDecoder().decode(selected)
    } else {
      const { default: generateAccount } = await import('@leofcoin/generate-account')
      const generated = await generateAccount(password, this.network)
      const identity = { ...generated.identity, network: this.network }
      const accounts = generated.accounts
      if (fresh) {
        await globalThis.accountStore.clear()
        await globalThis.walletStore.clear()
      }
      await globalThis.accountStore.put('public', JSON.stringify({ walletId: identity.walletId }))

      await globalThis.walletStore.put('version', String(1))
      await globalThis.walletStore.put('accounts', JSON.stringify(accounts))
      await globalThis.walletStore.put('selected-account', accounts[0][1])
      await globalThis.walletStore.put('identity', JSON.stringify(identity))

      this.selectedAccount = accounts[0][1]
      this.id = identity.walletId
    }
    const identity = JSON.parse(new TextDecoder().decode(await globalThis.walletStore.get('identity')))
    const needsNetworkMetadata = identity.network === undefined
    const identityNetwork = identity.network ?? this.network
    if (identity.importedAccounts !== undefined) {
      if (identityNetwork !== this.network) throw new Error('imported identity network mismatch')
      const imported: MigratedAccounts = JSON.parse(await decrypt(password, base58.decode(identity.importedAccounts)))
      const accounts = await this.getAccounts()
      const addresses = accounts.flatMap(([, external, internal]) => [external, internal])
      if (imported.schema !== 'peernet:imported-accounts:v1' || imported.network !== identityNetwork ||
        !Array.isArray(imported.wallets) || !addresses.length || new Set(addresses).size !== addresses.length ||
        imported.wallets.length !== addresses.length) throw new Error('Invalid imported identity accounts')
      const wallets = new Map<string, AccountWallet>()
      for (const entry of imported.wallets) {
        if (!entry || !addresses.includes(entry.address) || wallets.has(entry.address) ||
          typeof entry.multiWIF !== 'string') throw new Error('Invalid imported identity account')
        const wallet = new MultiWallet(identityNetwork)
        await wallet.fromMultiWif(entry.multiWIF)
        if (await wallet.address !== entry.address) throw new Error('Imported identity account address mismatch')
        wallets.set(entry.address, {
          address: Promise.resolve(entry.address),
          sign: hash => wallet.sign(hash),
          clearPrivateKey: () => wallet.hdnode.clearPrivateKey()
        })
      }
      if (!wallets.has(this.selectedAccount)) throw new Error('Selected account is not part of imported identity')
      this.#accountWallets = wallets
      this.#importedAccounts = true
      this.#importedLocked = false
      return
    }
    this.#wallet = new MultiWallet(identityNetwork)
    const expectedNetwork = this.#wallet.network
    const multiWIF = await decrypt(password, base58.decode(identity.multiWIF))
    await this.#wallet.fromMultiWif(multiWIF)
    const actualNetwork = this.#wallet.network
    const networkMismatch =
      actualNetwork.version !== expectedNetwork.version ||
      actualNetwork.multiCodec !== expectedNetwork.multiCodec ||
      actualNetwork.coin_type !== expectedNetwork.coin_type
    const needsWalletRecovery = !this.#wallet.hdnode.chainCode || networkMismatch
    if (needsWalletRecovery) {
      const mnemonic = await decrypt(password, base58.decode(identity.mnemonic))
      const recoveredWallet = new MultiWallet(identityNetwork)
      await recoveredWallet.recover(mnemonic, password, identityNetwork)
      this.#wallet = recoveredWallet
    }
    await this.#loadAccountWallets()
    if (needsWalletRecovery || needsNetworkMetadata) {
      identity.network = identityNetwork
      if (needsWalletRecovery) {
        identity.multiWIF = base58.encode(await encrypt(password, await this.#wallet.multiWIF))
      }
      await globalThis.walletStore.put('identity', JSON.stringify(identity))
    }
  }

  async #loadAccountWallets() {
    const accounts = await this.getAccounts()
    this.#accountWallets = await resolveAccountWallets(this.#wallet, accounts)
    if (!this.#accountWallets.has(this.selectedAccount)) {
      throw new Error(`selected account ${this.selectedAccount} is not part of this identity`)
    }
  }

  selectAccount(account: string) {
    if (!this.#accountWallets.has(account)) throw new Error(`unknown identity account ${account}`)
    this.selectedAccount = account
    return walletStore.put('selected-account', account)
  }

  sign(hash: Uint8Array) {
    const wallet = this.#accountWallets.get(this.selectedAccount)
    if (!wallet) throw new Error(`no signer available for selected account ${this.selectedAccount}`)
    return wallet.sign(hash.subarray(0, 32))
  }

  async lock(password: string) {
    if (this.#importedAccounts) {
      const identity = JSON.parse(new TextDecoder().decode(await globalThis.walletStore.get('identity')))
      await decrypt(password, base58.decode(identity.importedAccounts))
      for (const wallet of this.#accountWallets.values()) wallet.clearPrivateKey?.()
      this.#accountWallets.clear()
      this.#importedLocked = true
      return
    }
    await this.#wallet.lock(password)
  }

  async unlock(password: string) {
    if (this.#importedAccounts) {
      if (!this.#importedLocked) throw new Error('Identity is not locked')
      await this.load(password)
      return
    }
    await this.#wallet.unlock(password)
  }

  async export(password: string) {
    if (this.#importedAccounts) throw new Error('Imported accounts require a backup of the complete wallet store')
    return this.#wallet.export(password)
  }

  async import(password, encrypted: base58String) {
    if (this.#importedAccounts) throw new Error('Cannot replace an imported identity using a single-wallet backup')
    await this.#wallet.import(password, encrypted)
  }

  async exportQR(password: string) {
    const exported = await this.export(password)
    return globalThis.navigator
      ? await qrcode.toDataURL(exported)
      : await qrcode.toString(exported, { type: 'terminal' })
  }

  async importQR(image: File | Blob, password: string) {
    const multiWIF = await QrScanner.default.scanImage(image)
    return this.import(password, multiWIF)
  }
}
