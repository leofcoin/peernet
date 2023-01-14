import proto from './../proto/data.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

/**
 * @extends {CodecFormat}
 */
export default class DataMessage extends FormatInterface {

  get messageName() {
    return 'PeernetDataMessage'
  }
  /**
   * @param {Buffer|String|Object|DataMessage} data - The data needed to create the DataMessage
   */
  constructor(data) {
    super(data, proto, {name: 'peernet-data'})
  }
}
