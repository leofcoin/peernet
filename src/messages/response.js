import protons from 'protons'
import proto from './../proto/response.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class ResponseMessage extends FormatInterface {
  get keys() {
    return ['response']
  }

  constructor(data) {
    const name = 'peernet-response'
    super(data, protons(proto).PeernetResponseMessage, {name})
  }
}
