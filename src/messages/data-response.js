import protons from 'protons'
import proto from './../proto/data-response.proto.js'
import CodecFormat from './../codec/codec-format-interface.js'

export default class DataMessageResponse extends CodecFormat {
  
  get keys() {
    return [ 'hash', 'data' ]
  }
  
  constructor(data) {
    const name = 'peernet-data-response'
    super(data, protons(proto).PeernetDataMessageResponse, {name})
  }
}