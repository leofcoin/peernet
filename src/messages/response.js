import protons from 'protons'
import proto from './../proto/response.proto.js'
import CodecFormat from './../codec/codec-format-interface.js'

export default class ResponseMessage extends CodecFormat {
  get keys() {
    return ['response']
  }

  constructor(data) {
    const name = 'peernet-response'
    super(data, protons(proto).PeernetResponseMessage, {name})
  }
}
