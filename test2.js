import Client from './exports/peernet.js'
;(async () => {
  const client = await new Client({
    root: '.peernet/test2',
    network: 'peach',
    networkVersion: 'peach',
    stars: [['wss://star.leofcoin.org']]
  })
  const job = () => client.publish('socket-data', 'hello')
  setTimeout(async () => {
    job()
  }, 10000)
})()
