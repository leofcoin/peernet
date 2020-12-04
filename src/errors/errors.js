export const encapsulatedError = () => {
  return new Error('Nodes/Data should be send encapsulated by peernet-message')
}

export const dhtError = (proto) => {
  const text = `Received proto ${proto.name} expected peernet-dht-response`
  return new Error(`Routing error: ${text}`)
}

export const nothingFoundError = (hash) => {
  return new Error(`nothing found for ${hash}`)
}
