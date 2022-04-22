const Client = require('./dist/commonjs/peernet.js')

const client = new Client({root: '.peernet/test'})

pubsub.subscribe('peer:connected', async peer => {
  chainStore.put('localBlock', '00000')
  const request = new globalThis.peernet.protos['peernet-request']({
          request:'lastBlock'
        })
  const to = peer.id
  console.log(request);
  const node = await peernet.prepareMessage(to, request.encoded)
  console.log({node});
  let response = await peer.request(node.encoded)
  console.log({response});
  const keys = Object.keys(response)
  const uint8Array = new Uint8Array(keys.length)
  for (const key of keys) {
    uint8Array[Number(key)] = response[key]
  }
  const proto = new globalThis.peernet.protos['peernet-message'](uint8Array)
  console.log(proto.decoded.data);
  response = new globalThis.peernet.protos['peernet-response'](proto.decoded.data)
  console.log({response});

  const block = JSON.parse(response.decoded.response)
  console.log(block);
})
