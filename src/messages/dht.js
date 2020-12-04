import protons from 'protons'
import proto from './../proto/dht.proto.js'
import CodecFormat from './../codec/codec-format-interface.js'

export default class DHTMessage extends CodecFormat {
  get keys() {
    return ['hash']
  }

  constructor(data) {
    const name = 'peernet-dht'
    super(data, protons(proto).PeernetDHTMessage, {name})
  }
}
