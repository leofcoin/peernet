import { protoFor } from './../utils/utils.js'

export default class PeerDiscovery {
  constructor(id) {
    this.id = id
  }

  _getPeerId(id) {
    if (!peernet.peerMap || peernet.peerMap && peernet.peerMap.size === 0) return false

    for (const entry of [...peernet.peerMap.entries()]) {
      for (const _id of entry[1]) {
        if (_id === id) return entry[0]
      }
    }
  }

  async discover(peer) {
    let id = this._getPeerId(peer.id)
    if (id) return id
    const data = await new peernet.protos['peernet-peer']({id: this.id})
    const node = await peernet.prepareMessage(peer.id, data.encoded)

    let response = await peer.request(node.encoded)
    response = await protoFor(response)
    response = await new peernet.protos['peernet-peer-response'](response.decoded.data)

    id = response.decoded.id
    if (id === this.id) return;

    if (!peernet.peerMap.has(id)) peernet.peerMap.set(id, [peer.id])
    else {
      const connections = peernet.peerMap.get(id)
      if (connections.indexOf(peer.id) === -1) {
        connections.push(peer.id)
        peernet.peerMap.set(peer.id, connections)
      }
    }
    return id
  }

  async discoverHandler(message, peer) {
    const {id, proto} = message
    // if (typeof message.data === 'string') message.data = Buffer.from(message.data)
    if (proto.name === 'peernet-peer') {
      const from = proto.decoded.id
      if (from === this.id) return;

      if (!peernet.peerMap.has(from)) peernet.peerMap.set(from, [peer.id])
      else {
        const connections = peernet.peerMap.get(from)
        if (connections.indexOf(peer.id) === -1) {
          connections.push(peer.id)
          peernet.peerMap.set(from, connections)
        }
      }
      const data = await new peernet.protos['peernet-peer-response']({id: this.id})
      const node = await peernet.prepareMessage(from, data.encoded)

      peer.write(Buffer.from(JSON.stringify({id, data: node.encoded})))
    } else if (proto.name === 'peernet-peer-response') {
      const from = proto.decoded.id
      if (from === this.id) return;

      if (!peernet.peerMap.has(from)) peernet.peerMap.set(from, [peer.id])
      else {
        const connections = peernet.peerMap.get(from)
        if (connections.indexOf(peer.id) === -1) {
          connections.push(peer.id)
          peernet.peerMap.set(from, connections)
        }
      }
    }
  }
}
