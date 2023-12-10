import proto from './../proto/chat-message.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class ChatMessage extends FormatInterface {
  get messageName() {
    return 'ChatMessage'
  }

  constructor(buffer) {
    const name = 'chat-message'
    super(buffer, proto, { name })
  }
}
