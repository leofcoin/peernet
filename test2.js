const Client = require('./client.js')

const client = new Client({id: Buffer.from('testtesttesttesttesttesttesttes2')})

pubsub.subscribe('peer:connected', async peer => setInterval(async () => {
    console.log(await peer.request('hello'));
  }, 1000))