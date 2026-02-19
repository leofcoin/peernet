import proto from './../proto/data-response.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class DataMessageResponse extends FormatInterface {
  get messageName(): string {
    return 'PeernetDataMessageResponse'
  }

  constructor(data: any) {
    const name = 'peernet-data-response'
    super(data, proto, { name })
  }
}
