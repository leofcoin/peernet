import protons from 'protons'
import proto from './../proto/peer-response.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class PeerMessageResponse extends FormatInterface {
  get keys() {
    return ['id']
  }

  constructor(data) {
    const name = 'peernet-peer-response'
    super(data, protons(proto).PeernetPeerMessageResponse, {name})
  }
}
