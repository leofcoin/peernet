import proto from './../proto/peernet.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class PeernetMessage extends FormatInterface {
  get messageName(): string {
    return 'PeernetMessage'
  }

  constructor(buffer: any) {
    const name = 'peernet-message'
    super(buffer, proto, { name })
  }
}
