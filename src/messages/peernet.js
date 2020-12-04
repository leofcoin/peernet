import protons from 'protons'
import proto from './../proto/peernet.proto.js'
import CodecFormat from './../codec/codec-format-interface.js'

export default class PeernetMessage extends CodecFormat {
  get keys() {
    return ['data', 'signature', 'from', 'to', 'id']
  }

  constructor(buffer) {
    const name = 'peernet-message'
    super(buffer, protons(proto).PeernetMessage, {name})
  }
}
