import Client from './exports/peernet.js'

const client = await new Client({
  network: 'leofcoin:peach',
  networkVersion: 'peach',
  stars: ['wss://star.leofcoin.org'],
  version: '0.1.0'
})
console.log(pubsub.subscribers)
pubsub.subscribe('peer:discovered', (data) => {
  // console.log(data);
  console.log(`discovered: ${Object.keys(peernet.client.discovered).length}`)
  console.log(Object.keys(peernet.client.discovered))
})
pubsub.subscribe('peer:connected', (data) => {
  // console.log(data);
  console.log(`connections: ${peernet.connections.length}`)
})
pubsub.subscribe('peer:left', (data) => {
  console.log(`connections: ${peernet.connections.length}`)
  console.log(`discovered: ${Object.keys(peernet.client.discovered).length}`)
  // console.log(data);
})

// peernet.addFolder([{
//   path: 'assets/asset.png',
//   content: Buffer.from('png')
// }, {
//   path: 'index.html',
//   content: Buffer.from('html')
// }]).then(hash => peernet.ls(hash).then(paths => peernet.cat(paths[0].hash).then(content => console.log(content))))

// pubsub.subscribe('peer:connected', async peer => {
//   chainStore.put('localBlock', '00000')
//   const request = await new globalThis.peernet.protos['peernet-request']({
//           request:'lastBlock'
//         })
//   const to = peer.id
//   await peernet.data.put('hello', 'hi')
//   console.log({request});
//   const node = await peernet.prepareMessage(request)
//   console.log({node});
//   let response = await peer.request(node.encoded)
//   console.log({response});
//   const keys = Object.keys(response)
//   const uint8Array = new Uint8Array(keys.length)
//   for (const key of keys) {
//     uint8Array[Number(key)] = response[key]
//   }
//   // const proto = await new globalThis.peernet.protos['peernet-message'](uint8Array)
//   // console.log(proto.decoded.data);
//   response = await new globalThis.peernet.protos['peernet-response'](uint8Array)
//   console.log({response});

//   const block = new TextDecoder().decode(response.decoded.response)
//   console.log(block);
//   const task = () => setTimeout(() => {
//     console.log(peernet.connections[0]?.connected);
//     console.log(pubsub.subscribers);
//     task()
//   }, 5000);
// task()
// })
