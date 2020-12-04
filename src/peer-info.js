import CodecFormat from './codec/codec-format-interface'

export default class PeerInfo extends CodecFormat {
  constructor(data, options) {
    super(data, options)

    this.keys = ['id', 'address', 'family']
  }
}
