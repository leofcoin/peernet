import Client, { createNetwork, PEERNET_APP_ID } from './exports/peernet.js'
;(async () => {
  const client = await new Client({
    root: '.peernet/test2',
    network: createNetwork(PEERNET_APP_ID,'peach'),
    protocolVersion: '0.1.0',
    stars: ['wss://star.leofcoin.org']
  })
  const job = () => client.publish('socket-data', 'hello')
  setTimeout(async () => {
    job()
  }, 10000)
})()
