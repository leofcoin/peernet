import { protoFor } from './../utils/utils.js'

const dataHandler = async (message) => {
  if (!message) return

  try {
    const { data, id, from, peer } = message
    const proto = await protoFor(data)
    peernet._protoHandler({ id, proto }, peernet.connections[from] || peer, from)
  } catch (error) {
    console.error(error)
  }
}

export default dataHandler
