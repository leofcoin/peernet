import proto from './../proto/peernet.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class PeernetMessage extends FormatInterface {
  get messageName() {
    return 'PeernetMessage'
  }

  constructor(buffer) {
    const name = 'peernet-message'
    super(buffer, proto, { name })
  }
}
