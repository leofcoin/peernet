const Client = require('./dist/commonjs/peernet.js');

(async () => {
  const client = await new Client({root: '.peernet/test2', network: 'leofcoin'})
  const job = () => client.publish('socket-data', 'hello')
  setTimeout(async () => {
    job()
  }, 10000)
})()
