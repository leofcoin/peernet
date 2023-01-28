import MultiWallet from '@leofcoin/multi-wallet'

const walletStore = globalThis.walletStore
const accountStore = globalThis.accountStore

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
    let accounts = await walletStore.get('accounts')
    accounts = new TextDecoder().decode(accounts)
    return JSON.parse(accounts)
  }

  async load(password?: string): Promise<void> {
    let importee: { default: () => Promise<string> }
    if (!password) {
      if (globalThis.navigator) importee = await import('./prompts/password/browser.js')
      else {
        const path = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const url = path.join(__dirname, './prompts/password/node.js')
        importee = await import(url)      
      }
      password = await importee.default()
    }
    
    const accountExists = await accountStore.has('public')
    if (accountExists) {
      const pub = await accountStore.get('public')
      this.id = JSON.parse(new TextDecoder().decode(pub)).walletId;
      const selected = await walletStore.get('selected-account')
      globalThis.peernet.selectedAccount = new TextDecoder().decode(selected)
    } else {
      const importee = await import(/* webpackChunkName: "generate-account" */ '@leofcoin/generate-account')
      const {identity, accounts} = await importee.default(password, this.network)
      await accountStore.put('public', JSON.stringify({walletId: identity.walletId}));
      
      await walletStore.put('version', String(1))
      await walletStore.put('accounts', JSON.stringify(accounts))
      await walletStore.put('selected-account', accounts[0][1])
      await walletStore.put('identity', JSON.stringify(identity))

      globalThis.peernet.selectedAccount = accounts[0][1]
      this.id = identity.walletId
    }
    const identity = JSON.parse(new TextDecoder().decode(await walletStore.get('identity')))
    this.#wallet = new MultiWallet(this.network)
    await this.#wallet.recover(identity.mnemonic, password, this.network)
  }

  async export(password: string) {
    if (!password) throw new Error('IdentityExportError: password required')
    const identity = JSON.parse(new TextDecoder().decode(await walletStore.get('identity')))
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