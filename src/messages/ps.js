import protons from 'protons'
import proto from './../proto/ps.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class PsMessage extends FormatInterface {
  get keys() {
    return ['data', 'topic']
  }

  constructor(buffer) {
    const name = 'peernet-ps'
    super(buffer, protons(proto).PsMessage, {name})
  }
}
