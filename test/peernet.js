const Client = require('./../dist/commonjs/peernet.js')

globalThis.DEBUG = true;
(async () => {
  const peernet = await new Client({root: '.peernet/test3'})

  pubsub.subscribe('peer:connected', async peer => setInterval(async () => {
    // const dhtMessage = new DHTMessage({hash: 'hello'})
    // console.log(dhtMessage.encoded);
    // const message = new PeernetMessage({ from: client.id, to: peer.id, data: dhtMessage.encoded, signature: Buffer.from('pnsig') })
    // console.log(message.encoded);
    //   console.log(await peer.request(message.encoded));
    const data = await peernet.get('hello')
  }, 5000))
})()
