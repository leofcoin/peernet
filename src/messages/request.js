import proto from './../proto/request.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class RequestMessage extends FormatInterface {
  get keys() {
    return ['request']
  }

  get messageName() {
    return 'PeernetRequestMessage'
  }

  constructor(data) {
    const name = 'peernet-request'
    super(data, proto, {name})
  }
}
