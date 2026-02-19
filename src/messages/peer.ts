import proto from '../proto/peer.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class PeerMessage extends FormatInterface {
  get messageName(): string {
    return 'PeernetPeerMessage'
  }

  constructor(data: any) {
    const name = 'peernet-peer'
    super(data, proto, { name })
  }
}
