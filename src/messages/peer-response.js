import protons from 'protons'
import proto from './../proto/peer-response.proto.js'
import CodecFormat from './../codec/codec-format-interface.js'

export default class PeerMessageResponse extends CodecFormat {
  get keys() {
    return ['id']
  }

  constructor(data) {
    const name = 'peernet-peer-response'
    super(data, protons(proto).PeernetPeerMessageResponse, {name})
  }
}
