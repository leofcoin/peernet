import proto from './../proto/response.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class ResponseMessage extends FormatInterface {
  get keys() {
    return ['response']
  }

  get messageName() {
    return 'PeernetResponseMessage'
  }

  constructor(data) {
    const name = 'peernet-response'
    super(data, proto, {name})
  }
}
