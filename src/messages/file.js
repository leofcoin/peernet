import proto from './../proto/file.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

/**
 * @extends {CodecFormat}
 */
export default class PeernetFile extends FormatInterface {
  get keys() {
    return ['path', 'content', 'links']
  }

  get messageName() {
    return 'PeernetFile'
  }
  /**
   * @param {Buffer|String|Object|DataMessage} data - The data needed to create the DataMessage
   */
  constructor(data) {
    super(data, proto, {name: 'peernet-file'})
  }
}
