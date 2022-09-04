import { CodecHash } from '@leofcoin/codec-format-interface'

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
   * @return signature
   */
  async hashAndSignMessage(message) {
    const hasher = new CodecHash(message, {name: 'peernet-message'})
    let identity = await walletStore.get('identity')
    identity = JSON.parse(identity)
    if (!globalThis.MultiWallet) {
      const importee = await import(/* webpackChunkName: "multi-wallet" */ '@leofcoin/multi-wallet')
      globalThis.MultiWallet = importee.default
    }
    const wallet = new MultiWallet(this.network)
    wallet.recover(identity.mnemonic)
    return wallet.sign(Buffer.from(hasher.hash).slice(0, 32))
  }

  /**
   * @param {String} from - peer id
   * @param {String} to - peer id
   * @param {String|PeernetMessage} data - data encoded message string
   * or the messageNode itself
   */
  async prepareMessage(from, to, data, id) {
    if (data.encoded) data = data.encoded

    const message = {
      from,
      to,
      data,
    }
    const signature = await this.hashAndSignMessage(message)
    const node = await new globalThis.peernet.protos['peernet-message']({
      ...message,
      signature,
    })

    return node
  }
}
