const Client = require('./dist/commonjs/peernet.js');


(async () => {
  const client = await new Client({root: '.peernet/test'})

  peernet.addFolder([{
    path: 'assets/asset.png',
    content: 'png'
  }, {
    path: 'index.html',
    content: 'html'
  }]).then(hash => peernet.ls(hash).then(paths => peernet.cat(paths[0].hash).then(content => console.log(content))))

  pubsub.subscribe('peer:connected', async peer => {
    chainStore.put('localBlock', '00000')
    const request = await new globalThis.peernet.protos['peernet-request']({
            request:'lastBlock'
          })
    const to = peer.id
    await peernet.data.put('hello', 'hi')
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
    const proto = await new globalThis.peernet.protos['peernet-message'](uint8Array)
    console.log(proto.decoded.data);
    response = await new globalThis.peernet.protos['peernet-response'](proto.decoded.data)
    console.log({response});

    const block = new TextDecoder().decode(response.decoded.response)
    console.log(block);
    const task = () => setTimeout(() => {
      console.log(peernet.connections[0]?.connected);
      console.log(pubsub.subscribers);
      task()
    }, 5000);
    task()
  })

})()
