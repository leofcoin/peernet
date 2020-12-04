import bs32 from 'bs32';
import bs58 from 'bs58';
import isHex from 'is-hex';
import Codec from './codec';
import Hash from './../hash/hash'

export default class FormatInterface {
  constructor(buffer, proto, options = {}) {
    this.protoEncode = proto.encode
    this.protoDecode = proto.decode
    if (options.name) this.name = options.name
    this.hashFormat = options.hashFormat || 'bs32'

    if (Buffer.isBuffer(buffer)) {
      const codec = new Codec(buffer)

      if (codec.name) {
        this.fromEncoded(buffer)
      } else {
        this.create(buffer)
      }
    } else if (typeof buffer === 'string') {
      if (isHex(buffer)) this.fromHex(buffer)
      else if (bs32.test(buffer)) this.fromBs32(buffer)
      else this.fromBs58(buffer)
    } else if (typeof buffer === 'object' && !Array.isArray(buffer)) {
      this.create(buffer)
    }
  }

  get peernetHash() {
    return new Hash(this.decoded, {name: this.name})
  }

  get hash() {
    const upper = this.hashFormat.charAt(0).toUpperCase()
    const format = `${upper}${this.hashFormat.substring(1, this.hashFormat.length)}`
    return this.peernetHash[`to${format}`]()
  }

  decode() {
    let encoded = this.encoded;
    const discoCodec = new Codec(this.encoded.toString('hex'))
    encoded = encoded.slice(discoCodec.codecBuffer.length)
    this.name = discoCodec.name
    this.decoded = this.protoDecode(encoded)
    return this.decoded
  }

  encode(decoded) {
    if (!decoded) decoded = this.decoded;
    const codec = new Codec(this.name)
    this.encoded = Buffer.concat([codec.codecBuffer, this.protoEncode(decoded)])
    return this.encoded
  }

  fromEncoded(encoded) {
    const codec = new Codec(encoded)
    this.name = codec.name
    this.encoded = encoded
    this.decode()
  }

  fromHex(hex) {
    this.encoded = Buffer.from(hex, 'hex')
    this.decode()
  }

  fromBs32(input) {
    this.encoded = bs32.decode(input)
    this.decode()
  }

  fromBs58(input) {
    this.encoded = bs58.decode(input)
    this.decode()
  }

  toHex() {
    if (!this.encoded) this.encode()
    return this.encoded.toString('hex')
  }

  toBs32() {
    if (!this.encoded) this.encode()
    return bs32.encode(this.encoded)
  }

  toBs58() {
    if (!this.encoded) this.encode()
    return bs58.encode(this.encoded)
  }

  create(data) {
    this.decoded = data
    this.encode(data)
  }
}
