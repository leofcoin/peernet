import server from './../node_modules/socket-request-server/src/index.js';
import socketResponse from './../node_modules/socket-request-server/src/socket-response.js';

globalThis.peerMap = new Map()

server({
  peernet: (params, response) => {
    if (params.join) {
      peerMap.set(params.peerId, params.address)
      response.send([...peerMap.values()])
      for (const connection of connections) {
        console.log(connection);
        socketResponse(connection, 'peernet', 'peernet').send({
          discovered: params.address,
        })
      }
      return
    }
    if (!params.join) {
      peerMap.delete(params.peerId)
      return response.send()
    }
  },
})
