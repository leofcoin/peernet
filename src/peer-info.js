import CodecFormat from './codec/codec-format-interface'

export default class PeerInfo extends CodecFormat {
  constructor(data, options) {
    this.keys = ['id', 'address', 'family']
    super(data, options)  
  }
}