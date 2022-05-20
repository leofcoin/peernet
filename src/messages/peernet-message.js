import protons from 'protons'
import proto from './../proto/peernet.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class PeernetMessage extends FormatInterface {
  get keys() {
    return ['data', 'signature', 'from', 'to', 'id']
  }

  constructor(buffer) {
    const name = 'peernet-message'
    super(buffer, protons(proto).PeernetMessage, {name})
  }
}
