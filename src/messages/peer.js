import protons from 'protons'
import proto from './../proto/peer.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class PeerMessage extends FormatInterface {
  get keys() {
    return ['id']
  }

  constructor(data) {
    const name = 'peernet-peer'
    super(data, protons(proto).PeernetPeerMessage, {name})
  }
}
