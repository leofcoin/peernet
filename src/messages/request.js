import protons from 'protons'
import proto from './../proto/request.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class RequestMessage extends FormatInterface {
  get keys() {
    return ['request']
  }

  constructor(data) {
    const name = 'peernet-request'
    super(data, protons(proto).PeernetRequestMessage, {name})
  }
}
