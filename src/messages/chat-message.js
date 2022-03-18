import protons from 'protons'
import proto from './../proto/chat-message.proto.js'
import CodecFormat from './../codec/codec-format-interface.js'

export default class ChatMessage extends CodecFormat {
  get keys() {
    return ['author', 'value', 'timestamp', 'files']
  }

  constructor(buffer) {
    const name = 'chat-message'
    super(buffer, protons(proto).ChatMessage, {name})
  }
}
