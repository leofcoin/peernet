import MultiWallet from '@leofcoin/multi-wallet'
import Hash from './../hash/hash.js'
import PeernetMessage from './../messages/peernet.js'

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
    const hasher = new Hash(message, {name: 'peernet-message'})
    const identity = await walletStore.get('identity')

    const wallet = new MultiWallet(this.network)
    wallet.import(identity.multiWIF)
    return wallet.sign(hasher.hash.slice(0, 32))
  }

  /**
   * @param {String} from - peer id
   * @param {String} to - peer id
   * @param {String|PeernetMessage} data - data encoded message string
   * or the messageNode itself
   */
  async prepareMessage(from, to, data) {
    if (!Buffer.isBuffer(from)) from = new Buffer.from(from)
    if (!Buffer.isBuffer(to)) to = new Buffer.from(to)
    if (data.encoded) data = data.encoded

    const message = {
      from,
      to,
      data,
    }
    const signature = await this.hashAndSignMessage(message)
    const node = new PeernetMessage({
      ...message,
      signature,
    })

    return node
  }
}
