const Client = require('./../client.js')

const client = new Client()

console.log(pubsub.subscribers);
pubsub.subscribe('peer:connected', (data) => {
  console.log(data);
})
pubsub.subscribe('peer:data', (data) => {
  console.log(data);
})

// pubsub.subscribe('peer:connected', async peer => setInterval(async () => {
//     // console.log(await peer.request({type: 'block', index: 0}));
//   }, 5000))