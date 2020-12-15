import protons from 'protons'
import proto from './../proto/peer.proto.js'
import CodecFormat from './../codec/codec-format-interface.js'

export default class PeerMessage extends CodecFormat {
  get keys() {
    return ['id']
  }

  constructor(data) {
    const name = 'peernet-peer'
    super(data, protons(proto).PeernetPeerMessage, {name})
  }
}
