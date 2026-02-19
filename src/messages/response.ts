import proto from './../proto/response.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class ResponseMessage extends FormatInterface {
  get messageName(): string {
    return 'PeernetResponseMessage'
  }

  constructor(data: any) {
    const name = 'peernet-response'
    super(data, proto, { name })
  }
}
