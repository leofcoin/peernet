import proto from './../proto/peer.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class PeerMessage extends FormatInterface {
  get messageName() {
    return 'PeernetPeerMessage'
  }

  constructor(data) {
    const name = 'peernet-peer'
    super(data, proto, {name})
  }
}
