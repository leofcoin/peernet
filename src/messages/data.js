import protons from 'protons'
import proto from './../proto/data.proto.js'
import CodecFormat from './../codec/codec-format-interface.js'

/**
 * @extends {CodecFormat}
 */
export default class DataMessage extends CodecFormat {
  get keys() {
    return ['hash', 'store']
  }
  /**
   * @param {Buffer|String|Object|DataMessage} data - The data needed to create the DataMessage
   */
  constructor(data) {
    super(data, protons(proto).PeernetDataMessage, {name: 'peernet-data'})
  }
}
