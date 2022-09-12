import { protoFor } from './../utils/utils.js'

const dataHandler = async message => {
  if (!message) return

  const {data, id, from} = message
  const proto = await protoFor(data)

  peernet._protoHandler({id, proto}, peernet.client.connections[from], from)
}

export default dataHandler
