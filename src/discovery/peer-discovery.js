import { protoFor } from './../utils/utils.js'

export default class PeerDiscovery {
  constructor(id) {
    this.id = id
  }

  _getPeerId(id) {
    console.log({get: id});
    if (peernet.peerMap.size === 0) return false

    return [...peernet.peerMap.entries()].forEach((entry, i) => {
      return entry[1].forEach((_id, i) => {
        if (_id === id) return entry[0]
      })
    })
  }

  async discover(peer) {
    let id = this._getPeerId(peer.id)
    if (id) return id
    const data = new peernet.protos['peernet-peer']({id: this.id})
    const node = await peernet.prepareMessage(peer.id, data.encoded)

    let response = await peer.request(node.encoded)
    response = protoFor(response)
    response = new peernet.protos['peernet-peer-response'](response.decoded.data)

    id = response.decoded.id
    if (!peernet.peerMap.has(id)) peernet.peerMap.set(id, [peer.id])
    else {
      const connections = peernet.peerMap.get(id)
      connections.push(peer.id)
      peernet.peerMap.set(id, connections)
    }
    return id
  }

  async discoverHandler(message, peer) {
    const {id, proto} = message
    // if (typeof message.data === 'string') message.data = Buffer.from(message.data)
    if (proto.name === 'peernet-peer') {
      const from = proto.decoded.id
      if (!peernet.peerMap.has(from)) peernet.peerMap.set(from, [peer.id])
      else {
        const connections = peernet.peerMap.get(from)
        connections.push(peer.id)
        peernet.peerMap.set(from, connections)
      }
      const data = new peernet.protos['peernet-peer-response']({id: this.id})
      const node = await peernet.prepareMessage(from, data.encoded)

      peer.write(Buffer.from(JSON.stringify({id, data: node.encoded})))
    } else if (proto.name === 'peernet-peer-response') {
      const from = proto.decoded.id
      if (!peernet.peerMap.has(from)) peernet.peerMap.set(from, [peer.id])
      else {
        const connections = peernet.peerMap.get(from)
        connections.push(peer.id)
        peernet.peerMap.peerMap.set(from, connections)
      }
    }
  }
}
