import proto from './../proto/ps.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class PsMessage extends FormatInterface {
  get messageName() {
    return 'PsMessage'
  }

  constructor(buffer) {
    const name = 'peernet-ps'
    super(buffer, proto, {name})
  }
}
