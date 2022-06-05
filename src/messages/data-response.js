import proto from './../proto/data-response.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class DataMessageResponse extends FormatInterface {
  get keys() {
    return ['hash', 'data']
  }

  get messageName() {
    return 'PeernetDataMessageResponse'
  }

  constructor(data) {
    const name = 'peernet-data-response'
    super(data, proto, {name})
  }
}
