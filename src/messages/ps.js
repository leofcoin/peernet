import protons from 'protons'
import proto from './../proto/ps.proto.js'
import CodecFormat from './../codec/codec-format-interface.js'

export default class PsMessage extends CodecFormat {
  get keys() {
    return ['data', 'topic']
  }

  constructor(buffer) {
    const name = 'peernet-ps'
    super(buffer, protons(proto).PsMessage, {name})
  }
}
