import server from 'socket-request-server/server';
import socketResponse from 'socket-request-server/response';

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
