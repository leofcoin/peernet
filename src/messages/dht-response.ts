import proto from './../proto/dht-response.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class DHTMessageResponse extends FormatInterface {
  get messageName(): string {
    return 'PeernetDHTMessageResponse'
  }

  constructor(data: any) {
    const name = 'peernet-dht-response'
    super(data, proto, { name })
  }
}
