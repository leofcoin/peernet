import { protoFor } from './../utils/utils.js'

const dataHandler = async message => {
  if (!message) return

  const {data, id} = message

  message = protoFor(data)
  const proto = protoFor(message.decoded.data)
  const from = message.decoded.from

  peernet._protoHandler({id, proto}, peernet.client.connections[from], from)
}

export default dataHandler
