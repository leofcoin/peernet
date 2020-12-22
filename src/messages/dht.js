import protons from 'protons'
import proto from './../proto/dht.proto.js'
import CodecFormat from './../codec/codec-format-interface.js'

/**
 * @example `
   new DHTMessage(hash, store)
   // store = optional if not set, peernet checks every store
   let message = new DHTMessage('hashmvbs124xcfd...', 'transaction')
   message = new DHTMessage('hashmvbs124xcfd...', 'block')
 `
 */
export default class DHTMessage extends CodecFormat {
  /**
   *
   */
  get keys() {
    return ['hash', 'store']
  }

  constructor(data) {
    const name = 'peernet-dht'
    super(data, protons(proto).PeernetDHTMessage, {name})
  }
}
