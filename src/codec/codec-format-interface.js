import bs32 from '@vandeurenglenn/base32';
import bs58 from '@vandeurenglenn/base58';
import isHex from '@vandeurenglenn/is-hex';
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
    this.hashFormat = options.hashFormat || 'bs32'
    if (options.name) this.name = options.name
    if (buffer instanceof Uint8Array) return this.fromUint8Array(buffer)
    else if (buffer instanceof ArrayBuffer) return this.fromArrayBuffer(buffer)
    else if (buffer.name === options.name) return buffer
    else if (typeof buffer === 'string') {
        if (isHex(buffer)) this.fromHex(buffer)
        else if (bs32.isBase32(buffer)) this.fromBs32(buffer)
        else if (bs58.isBase58(buffer)) this.fromBs58(buffer)
        else throw new Error(`unsupported string ${buffer}`)
    } else {
      this.create(buffer)
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
    const discoCodec = new Codec(this.encoded)
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
    const encoded = this.protoEncode(decoded)
    const uint8Array = new Uint8Array(encoded.length + codec.codecBuffer.length)
    uint8Array.set(codec.codecBuffer)
    uint8Array.set(encoded, codec.codecBuffer.length)
    this.encoded = uint8Array
    return this.encoded
  }

  hasCodec() {
    if (!this.encoded) return false
    const codec = new Codec(this.encoded)
    if (codec.name) return true
  }

  fromUint8Array(buffer) {
    this.encoded = buffer
    if (!this.hasCodec()) this.create(
      JSON.parse(new TextDecoder().decode(this.encoded))
    )
    else this.decode()
  }

  fromArrayBuffer(buffer) {
    this.encoded = new Uint8Array(buffer, buffer.byteOffset, buffer.byteLength)
    if (!this.hasCodec()) this.create(
      JSON.parse(new TextDecoder().decode(this.encoded))
    )
    else this.decode()
  }

  /**
   * @param {Buffer} encoded
   */
  fromEncoded(encoded) {
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
