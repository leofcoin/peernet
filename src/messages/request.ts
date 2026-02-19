import proto from './../proto/request.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class RequestMessage extends FormatInterface {
  get messageName(): string {
    return 'PeernetRequestMessage'
  }

  constructor(data: any) {
    const name = 'peernet-request'
    super(data, proto, { name })
  }
}
