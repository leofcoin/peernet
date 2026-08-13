import Peernet from '../exports/peernet.js'

const peernet = await new Peernet(
  {
    network: 'leofcoin:peach',
    stars: [],
    root: process.argv[2],
    autoStart: false,
    freshIdentity: true
  },
  'fresh-empty-store-test'
)

if (!peernet.id || !peernet.selectedAccount) throw new Error('fresh identity was not initialized')
console.log('FRESH_IDENTITY_READY')
