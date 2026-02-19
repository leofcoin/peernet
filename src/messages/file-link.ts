import proto from '../proto/file-link.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

/**
 * @extends {CodecFormat}
 */
export default class PeernetFileLink extends FormatInterface {
  get messageName(): string {
    return 'PeernetFileLink'
  }
  /**
   * @param {Buffer|String|Object|DataMessage} data - The data needed to create the DataMessage
   */
  constructor(data: any) {
    super(data, proto, { name: 'peernet-file-link' })
  }
}
