import protons from 'protons'
import proto from './../proto/dht-response.proto.js'
import {encode, decode} from 'bs32'
import CodecFormat from './../codec/codec-format-interface.js'

export default class DHTMessageResponse extends CodecFormat {
  get keys() {
    return ['hash', 'has']
  }

  constructor(data) {
    const name = 'peernet-dht-response'
    super(data, protons(proto).PeernetDHTMessageResponse, {name})
  }
}
