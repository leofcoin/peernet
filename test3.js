const Client = require('./dist/commonjs/peernet.js')
const PeernetMessage = require('./dist/messages/peernet.js');
const DHTMessage = require('./dist/messages/dht.js');

globalThis.DEBUG = true;
const client = new Client({root: '.peernet/test3'})

pubsub.subscribe('peer:connected', async peer => setInterval(async () => {
  // const dhtMessage = new DHTMessage({hash: 'hello'})
  // console.log(dhtMessage.encoded);
  // const message = new PeernetMessage({ from: client.id, to: peer.id, data: dhtMessage.encoded, signature: Buffer.from('pnsig') })
  // console.log(message.encoded);
  //   console.log(await peer.request(message.encoded));
  const data = await client.get('hello')
  console.log(data.toString())
}, 5000))