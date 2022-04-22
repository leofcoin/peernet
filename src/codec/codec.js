import varint from 'varint';
import bs32 from '@vandeurenglenn/base32';
import bs58 from '@vandeurenglenn/base58';
import isHex from '@vandeurenglenn/is-hex';
import codecs from './codecs'

export default class PeernetCodec {
  get codecs() {
    return {...globalThis.peernet.codecs, ...codecs}
  }
  constructor(buffer) {
    if (buffer) {
      if (buffer instanceof Uint8Array) {
        const codec = varint.decode(buffer);
        const name = this.getCodecName(codec)
        if (name) {
          this.name = name
          this.encoded = buffer
          this.decode(buffer)
        } else {
          this.encode(buffer)
        }
      } else if (buffer instanceof ArrayBuffer) {
        const encoded = new Uint8Array(buffer.byteLength)

        for (let i = 0; i < buffer.byteLength; i++) {
          encoded[i] = buffer[i]
        }
        this.encoded = encoded
        // this.encoded = new Uint8Array(buffer, buffer.byteOffset, buffer.byteLength)
        this.decode(buffer)
        return
      }
      if (typeof buffer === 'string') {
        if (this.codecs[buffer]) this.fromName(buffer)
        else if (isHex(buffer)) this.fromHex(buffer)
        else if (bs32.isBase32(buffer)) this.fromBs32(buffer)
        else if (bs58.isBase58(buffer)) this.fromBs58(buffer)
        else throw new Error(`unsupported string ${buffer}`)
      }
      if (!isNaN(buffer)) if (this.codecs[this.getCodecName(buffer)]) this.fromCodec(buffer)
    }
  }

  fromEncoded(encoded) {
    const codec = varint.decode(encoded);
    const name = this.getCodecName(codec)
    this.name = name
    this.encoded = encoded
    this.decode(encoded)
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

  getCodec(name) {
    return this.codecs[name].codec
  }

  getCodecName(codec) {
    return Object.keys(this.codecs).reduce((p, c) => {
      const item = this.codecs[c]
      if (item.codec === codec) return c;
      else return p;
    }, undefined)
  }

  getHashAlg(name) {
    return this.codecs[name].hashAlg
  }

  fromCodec(codec) {
    this.name = this.getCodecName(codec)
    this.hashAlg = this.getHashAlg(this.name)

    this.codec = this.getCodec(this.name)
    this.codecBuffer = varint.encode(codec)
  }

  fromName(name) {
    const codec = this.getCodec(name)
    this.name = name
    this.codec = codec
    this.hashAlg = this.getHashAlg(name)
    this.codecBuffer = varint.encode(codec)
  }

  toBs32() {
    this.encode()
    return bs32.encode(this.encoded)
  }

  toBs58() {
    this.encode()
    return bs58.encode(this.encoded)
  }

  toHex() {
    return this.encoded.toString('hex')
  }

  decode() {
    const codec = varint.decode(this.encoded);
    this.fromCodec(codec)
  }

  encode() {
    const codec = varint.encode(this.decoded)
    this.encoded = codec
    return this.encoded
  }
}
