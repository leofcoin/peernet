const Client = require('./dist/commonjs/peernet.js')

const client = new Client({root: '.peernet/test4'})

pubsub.subscribe('peer:connected', async peer => {
  await peernet.get("ba5xcadcnub27naa7zrcvtmyruviahaiwvupatfgjkvdgcehuif7clissf")
})
