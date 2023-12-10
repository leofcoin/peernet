import proto from './../proto/dht.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

/**
 * @example `
   new DHTMessage(hash, store)
   // store = optional if not set, peernet checks every store
   let message = new DHTMessage('hashmvbs124xcfd...', 'transaction')
   message = new DHTMessage('hashmvbs124xcfd...', 'block')
 `
 */
export default class DHTMessage extends FormatInterface {
  get messageName() {
    return 'PeernetDHTMessage'
  }

  constructor(data) {
    const name = 'peernet-dht'
    super(data, proto, { name })
  }
}
