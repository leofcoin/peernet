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

  async load(password?: string): Promise<void> {
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

    const accountExists = await globalThis.accountStore.has('public')
    if (accountExists) {
      const pub = await globalThis.accountStore.get('public')
      this.id = JSON.parse(new TextDecoder().decode(pub)).walletId
      const selected = await globalThis.walletStore.get('selected-account')
      this.selectedAccount = new TextDecoder().decode(selected)
    } else {
      const importee = await import(/* webpackChunkName: "generate-account" */ '@leofcoin/generate-account')
      const { identity, accounts } = await importee.default(password, this.network)
      await globalThis.accountStore.put('public', JSON.stringify({ walletId: identity.walletId }))

      await globalThis.walletStore.put('version', String(1))
      await globalThis.walletStore.put('accounts', JSON.stringify(accounts))
      await globalThis.walletStore.put('selected-account', accounts[0][1])
      await globalThis.walletStore.put('identity', JSON.stringify(identity))

      this.selectedAccount = accounts[0][1]
      this.id = identity.walletId
    }
    const identity = JSON.parse(new TextDecoder().decode(await globalThis.walletStore.get('identity')))
    this.#wallet = new MultiWallet(this.network)
    const multiWIF = await decrypt(password, base58.decode(identity.multiWIF))
    await this.#wallet.fromMultiWif(multiWIF)
    await this.#loadAccountWallets()
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

  lock(password: string) {
    this.#wallet.lock(password)
  }

  unlock(password: string) {
    this.#wallet.unlock(password)
  }

  async export(password: string) {
    return this.#wallet.export(password)
  }

  async import(password, encrypted: base58String) {
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
