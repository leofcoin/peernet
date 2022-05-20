import protons from 'protons'
import proto from './../proto/data-response.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class DataMessageResponse extends FormatInterface {
  get keys() {
    return ['hash', 'data']
  }

  constructor(data) {
    const name = 'peernet-data-response'
    super(data, protons(proto).PeernetDataMessageResponse, {name})
  }
}
