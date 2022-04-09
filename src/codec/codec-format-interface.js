import bs32 from 'bs32';
import bs58 from 'bs58';
import isHex from 'is-hex';
import Codec from './codec';
import Hash from './../hash/hash'

export default class FormatInterface {
  /**
   * @param {Buffer|String|Object} buffer - data - The data needed to create the desired message
   * @param {Object} proto - {encode, decode}
   * @param {Object} options - {hashFormat, name}
   */
  constructor(buffer, proto, options = {}) {
    this.protoEncode = proto.encode
    this.protoDecode = proto.decode
    if (options.name) this.name = options.name
    this.hashFormat = options.hashFormat || 'bs32'
    if (buffer.name === options.name) {
      return buffer
    } else if (Buffer.isBuffer(buffer)) {
      const codec = new Codec(buffer)
      if (codec.name) {
        this.fromEncoded(buffer)
      } else {
        this.create(buffer)
      }
    } else {
      if (typeof buffer === 'string') {
        if (isHex(buffer)) this.fromHex(buffer)
        else if (bs32.test(buffer)) this.fromBs32(buffer)
        else this.fromBs58(buffer)
      } else if (typeof buffer === 'object' && !Array.isArray(buffer)) {
        this.create(buffer)
      }
    }
  }

  /**
   * @return {PeernetHash}
   */
  get peernetHash() {
    return new Hash(this.decoded, {name: this.name})
  }

  /**
   * @return {peernetHash}
   */
  get hash() {
    const upper = this.hashFormat.charAt(0).toUpperCase()
    const format = `${upper}${this.hashFormat.substring(1, this.hashFormat.length)}`
    return this.peernetHash[`to${format}`]()
  }

  /**
   * @return {Object}
   */
  decode() {
    let encoded = this.encoded;
    const discoCodec = new Codec(this.encoded.toString('hex'))
    encoded = encoded.slice(discoCodec.codecBuffer.length)
    this.name = discoCodec.name
    this.decoded = this.protoDecode(encoded)
    return this.decoded
  }

  /**
   * @return {Buffer}
   */
  encode(decoded) {
    if (!decoded) decoded = this.decoded;
    const codec = new Codec(this.name)
    this.encoded = Buffer.concat([codec.codecBuffer, this.protoEncode(decoded)])
    return this.encoded
  }

  /**
   * @param {Buffer} encoded
   */
  fromEncoded(encoded) {
    const codec = new Codec(encoded)
    this.name = codec.name
    this.encoded = encoded
    this.decode()
  }

  /**
   * @param {String} encoded
   */
  fromHex(encoded) {
    this.encoded = Buffer.from(encoded, 'hex')
    this.decode()
  }

  /**
   * @param {String} encoded
   */
  fromBs32(encoded) {
    this.encoded = bs32.decode(encoded)
    this.decode()
  }

  /**
   * @param {String} encoded
   */
  fromBs58(encoded) {
    this.encoded = bs58.decode(encoded)
    this.decode()
  }

  /**
   * @return {String} encoded
   */
  toHex() {
    if (!this.encoded) this.encode()
    return this.encoded.toString('hex')
  }

  /**
   * @return {String} encoded
   */
  toBs32() {
    if (!this.encoded) this.encode()
    return bs32.encode(this.encoded)
  }

  /**
   * @return {String} encoded
   */
  toBs58() {
    if (!this.encoded) this.encode()
    return bs58.encode(this.encoded)
  }

  /**
   * @param {Object} data
   */
  create(data) {
    const decoded = {}
    if (this.keys?.length > 0) {
      for (const key of this.keys) {
        Object.defineProperties(decoded, {
          [key]: {
            enumerable: true,
            configurable: true,
            set: (val) => value = data[key],
            get: () => data[key]
          }
        })
      }

      this.decoded = decoded
      this.encode()
    }
  }
}
