const Client = require('./dist/commonjs/peernet.js')

const client = new Client({root: '.peernet/test'})

pubsub.subscribe('peer:connected', async peer => setInterval(async () => {
    console.log(await peer.request({request: 'lastBlock'}));
  }, 5000))
