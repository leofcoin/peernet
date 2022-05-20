import protons from 'protons'
import proto from './../proto/dht-response.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class DHTMessageResponse extends FormatInterface {
  get keys() {
    return ['hash', 'has']
  }

  constructor(data) {
    const name = 'peernet-dht-response'
    super(data, protons(proto).PeernetDHTMessageResponse, {name})
  }
}
