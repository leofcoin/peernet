const Client = require('./dist/commonjs/peernet.js')

const client = new Client({root: '.peernet/test'})

pubsub.subscribe('peer:connected', async peer => {
  chainStore.put('localBlock', '00000')
  const request = new globalThis.peernet.protos['peernet-request']({
          request:'lastBlock'
        })
  const to = peernet._getPeerId(peer.id)
  const node = await peernet.prepareMessage(to, request.encoded)
  let response = await peer.request(node.encoded)
  console.log({response});
  const proto = new globalThis.peernet.protos['peernet-message'](Buffer.from(response.data))
  response = new globalThis.peernet.protos['peernet-response'](Buffer.from(proto.decoded.data))
  console.log({response});
  console.log();

  const block = JSON.parse(response.decoded.response)
  console.log(block);
})
