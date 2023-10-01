import MultiWallet from '@leofcoin/multi-wallet'
import base58 from '@vandeurenglenn/base58'
import {encrypt, decrypt} from '@leofcoin/identity-utils'
import QrScanner from 'qr-scanner'
import qrcode from 'qrcode'

export default class Identity {
  #wallet: MultiWallet
  network: MultiWallet.network
  id: string

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
      const importee: { default: () => Promise<string> } = await import('./prompts/password.js')
      password = await importee.default()
    }
    
    const accountExists = await globalThis.accountStore.has('public')
    if (accountExists) {
      const pub = await globalThis.accountStore.get('public')
      this.id = JSON.parse(new TextDecoder().decode(pub)).walletId;
      const selected = await globalThis.walletStore.get('selected-account')
      globalThis.peernet.selectedAccount = new TextDecoder().decode(selected)
    } else {
      const importee = await import(/* webpackChunkName: "generate-account" */ '@leofcoin/generate-account')
      const {identity, accounts} = await importee.default(password, this.network)
      await globalThis.accountStore.put('public', JSON.stringify({walletId: identity.walletId}));
      
      await globalThis.walletStore.put('version', String(1))
      await globalThis.walletStore.put('accounts', JSON.stringify(accounts))
      await globalThis.walletStore.put('selected-account', accounts[0][1])
      await globalThis.walletStore.put('identity', JSON.stringify(identity))

      globalThis.peernet.selectedAccount = accounts[0][1]
      this.id = identity.walletId
    }
    const identity = JSON.parse(new TextDecoder().decode(await globalThis.walletStore.get('identity')))
    this.#wallet = new MultiWallet(this.network)
    const multiWIF = await decrypt(password, base58.decode(identity.multiWIF))
    await this.#wallet.fromMultiWif(multiWIF)
  }

  sign(hash: Uint8Array) {
    return this.#wallet.sign(hash.subarray(0, 32))
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
    return globalThis.navigator ? await qrcode.toDataURL(exported) : await qrcode.toString(exported, {type: 'terminal'})
  }

  async importQR(image: File | Blob , password: string) {
    const multiWIF = QrScanner.scanImage(image)
    return this.import(password, multiWIF)
  }
}