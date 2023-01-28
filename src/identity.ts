import MultiWallet from '@leofcoin/multi-wallet'

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
    await this.#wallet.recover(identity.mnemonic, password, this.network)
  }

  sign(hash: Uint8Array) {
    return this.#wallet.sign(hash.subarray(0, 32))
  }

  async export(password: string) {
    if (!password) throw new Error('IdentityExportError: password required')
    const identity = JSON.parse(new TextDecoder().decode(await globalThis.walletStore.get('identity')))
    this.#wallet = new MultiWallet(this.network)
    await this.#wallet.recover(identity.mnemonic, password, this.network)
    return this.#wallet.toMultiWif()
  }

  async import(multiWIF: string) {
    this.#wallet = new MultiWallet(this.network)
    await this.#wallet.fromMultiWif(multiWIF)
  }

  async unlock({ key, iv, cipher }) {

  }

  /**
   * Lock current wallet or import wallet using a MultiWIF and lock
   * 
   * @param password 
   * @param multiWIF 
   */
  async lock(password: string, multiWIF?: string) {
  }
}