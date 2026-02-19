import proto from './../proto/ps.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class PsMessage extends FormatInterface {
  get messageName(): string {
    return 'PsMessage'
  }

  constructor(buffer: any) {
    const name = 'peernet-ps'
    super(buffer, proto, { name })
  }
}
