import MultiWallet from '@leofcoin/multi-wallet';
import { DEFAULT_QR_OPTIONS } from './constants.js';
import { expected } from './utils.js';
import AES from 'crypto-js/aes.js';
import ENC from 'crypto-js/enc-utf8.js';
import QRCode from 'qrcode'
import QrScanner from './../node_modules/qr-scanner/qr-scanner.min.js';
import { join } from 'path'
QrScanner.WORKER_PATH = join(__dirname, 'qr-scanner-worker.js');

export default class LFCAccount {
  constructor(network) {
    this.network = network
  }
  
  async generateQR(input, options = {}) {
    options = { ...DEFAULT_QR_OPTIONS, ...options };
  
    
    return QRCode.toDataURL(input, options);
  }
  
  async generateProfileQR(profile = {}, options = {}) {
    if (!profile || !profile.mnemonic) throw expected(['mnemonic: String'], profile)
    profile = JSON.stringify(profile);
    return this.generateQR(profile, options);
  }
  //
  
  /**
   * @return {object} { identity, accounts, config }
   */
  async generateProfile() {
    const wallet = new MultiWallet(this.network);
    /**
     * @type {string}
     */
    const mnemonic = await wallet.generate();
    /**
     * @type {object}
     */
    const account = wallet.account(0)
    /**
     * @type {object}
     */
    const external = account.external(0)
    const internal = account.internal(0)
    
    return {
      identity: {
        mnemonic,
        multiWIF: wallet.export(),
        publicKey: external.publicKey,
        privateKey: external.privateKey,
        walletId: external.id
      },
      accounts: [['main account', external.address, internal.address]],
      config: {
        miner: {
          intensity: 1,
          address: external.address,
          donationAddress: undefined,
          donationAmount: 1 //percent
        }
       }
    }
  }
  
  
  async importAccount(identity, password, qr = false) {
    if (qr) {
      identity = await QrScanner.scanImage(identity)
      console.log({identity});
      identity = AES.decrypt(identity, password)
      console.log(identity.toString());
      identity = JSON.parse(identity.toString(ENC))
      if (identity.mnemonic) {
        const wallet = new MultiWallet(this.network);
        await wallet.recover(identity.mnemonic)
        const account = wallet.account(0)
        const external = account.external(0)
        identity = {
          mnemonic: identity.mnemonic,
          publicKey: external.publicKey,
          privateKey: external.privateKey,
          walletId: external.id
        }
        let config = await configStore.get()
        config = { ...config, ...{ identity } }
        await configStore.put(config)
      }    
      return identity
      
      // return await this.generateQR(decrypted)
    }
    if (!identity) throw new Error('expected identity to be defined')
    if (identity.mnemonic) {
      const wallet = new MultiWallet(this.network);
      wallet.recover(identity.mnemonic)
      const account = wallet.account(0)
      const external = account.external(0)
      identity = {
        mnemonic: identity.mnemonic,
        publicKey: external.publicKey,
        privateKey: external.privateKey,
        walletId: external.id
      }
    }
    let config = await configStore.get()
    config = { ...config, ...{ identity } }
    await configStore.put(config)
    
    return identity
  }
  
  async exportAccount(password, qr = false) {
    if (!password) throw expected(['password: String'], password)
    
    const identity = await walletStore.get('identity')
    const account = await accountStore.get('public')
    
    if (!identity.mnemonic) throw expected(['mnemonic: String'], identity)
    
    const encrypted = AES.encrypt(JSON.stringify({ ...identity, ...account }), password).toString()
    if (!qr) return encrypted
    
    return await this.generateQR(encrypted)
  }

}