import protons from 'protons'
import proto from './../proto/chat-message.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class ChatMessage extends FormatInterface {
  get keys() {
    return ['author', 'value', 'timestamp', 'files']
  }

  constructor(buffer) {
    const name = 'chat-message'
    super(buffer, protons(proto).ChatMessage, {name})
  }
}
