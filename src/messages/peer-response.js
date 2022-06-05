import proto from './../proto/peer-response.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class PeerMessageResponse extends FormatInterface {
  get keys() {
    return ['id']
  }

  get messageName() {
    return 'PeernetPeerMessageResponse'
  }

  constructor(data) {
    const name = 'peernet-peer-response'
    super(data, proto, {name})
  }
}
