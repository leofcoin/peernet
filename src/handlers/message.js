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
    const hash = await message.peernetHash
    message.decoded.signature = globalThis.identity.sign(hash.buffer)
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
