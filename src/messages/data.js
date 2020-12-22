import protons from 'protons'
import proto from './../proto/data.proto.js'
import CodecFormat from './../codec/codec-format-interface.js'

export default class DataMessage extends CodecFormat {
  get keys() {
    return ['hash', 'store']
  }

  constructor(data) {
    const name = 'peernet-data'
    super(data, protons(proto).PeernetDataMessage, {name})
  }
}
