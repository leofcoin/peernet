export default class MessageHandler {
  constructor(network) {
    this.network = network
  }
  /**
   * hash and sign message
   *
   * @param {object} message
   * @param {Buffer} message.from peer id
   * @param {Buffer} message.to peer id
   * @param {string} message.data Peernet message
   * (PeernetMessage excluded) encoded as a string
   * @return message
   */
  async hashAndSignMessage(message) {
    let identity = await walletStore.get('identity')
    identity = JSON.parse(identity)
    if (!globalThis.MultiWallet) {
      const importee = await import(/* webpackChunkName: "multi-wallet" */ '@leofcoin/multi-wallet')
      globalThis.MultiWallet = importee.default
    }
    const wallet = new MultiWallet(this.network)
    wallet.recover(identity.mnemonic)
    message.decoded.signature = wallet.sign(Buffer.from(await message.hash).slice(0, 32))
    return message
  }

  /**
   * @param {String} from - peer id
   * @param {String} to - peer id
   * @param {String|PeernetMessage} data - data encoded message string
   * or the messageNode itself
   */
  async prepareMessage(message) {    
    if (message.keys.includes('signature')) {
      message = await this.hashAndSignMessage(message)
    }

    return message
  }
}
