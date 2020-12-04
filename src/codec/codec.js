import varint from 'varint';
import bs32 from 'bs32';
import bs58 from 'bs58';
import isHex from 'is-hex';
import codecs from './codecs'

export default class PeernetCodec {
  constructor(buffer, _codecs) {
    if (_codecs) this.codecs = {...codecs, ..._codecs}
    else this.codecs = codecs
    if (buffer) {
      if (Buffer.isBuffer(buffer)) {
        const codec = varint.decode(buffer);
        const name = this.getCodecName(codec)

        if (name) {
          this.name = name
          this.encoded = buffer
          this.decode(buffer)
        } else {
          this.encode(buffer)
        }
      }
      if (typeof buffer === 'string') {
        if (this.codecs[buffer]) this.fromName(buffer)
        else if (isHex(buffer)) this.fromHex(buffer)
        else if (bs32.test(buffer)) this.fromBs32(buffer)
        else this.fromBs58(buffer)
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
      if (parseInt(Buffer.from(`${this.getCodec(c)}`, 'hex').toString('hex'), 16) === codec) return c;
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
    this.codecBuffer = Buffer.from(varint.encode(parseInt(Buffer.from(`${this.codec}`, 'hex').toString('hex'), 16)), 'hex');
  }

  fromName(name) {
    const codec = this.getCodec(name)
    this.name = name
    this.codec = codec
    this.hashAlg = this.getHashAlg(name)
    this.codecBuffer = Buffer.from(varint.encode(parseInt(Buffer.from(`${codec}`, 'hex').toString('hex'), 16)), 'hex');
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
    this.name = this.getCodecName(codec)
  }

  encode() {
    const codec = Buffer.from(varint.encode(parseInt(Buffer.from(`${this.codec}`, 'hex').toString('hex'), 16)), 'hex');
    this.encoded = codec
    return this.encoded
  }
}
