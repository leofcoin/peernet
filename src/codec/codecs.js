export default {
  // just a hash
  'disco-hash': {
    codec: '30',
    hashAlg: 'dbl-keccak-512', // ,
    // testnet: 'olivia'
  },
  'peernet-dht': {
    codec: '706468',
    hashAlg: 'keccak-256',
  },
  'peernet-dht-response': {
    codec: '706472',
    hashAlg: 'keccak-256',
  },
  // data
  'peernet-data': {
    codec: '706461',
    hashAlg: 'keccak-256',
  },
  'peernet-data-response': {
    codec: '70646172',
    hashAlg: 'keccak-256',
  },
  // message
  'peernet-message': {
    codec: '706d65',
    hashAlg: 'keccak-512',
  },
  // pubsub
  'peernet-ps': {
    codec: '707073',
    hashAlg: 'keccak-256',
  },
  // normal block
  'leofcoin-block': {
    codec: '6c62',
    hashAlg: 'dbl-keccak-512', // ,
    // testnet: 'olivia'
  },
  // itx
  'leofcoin-itx': {
    codec: '6c69',
    hashAlg: 'keccak-512', // ,
    // testnet: 'olivia'
  },
  // peer reputation
  'leofcoin-pr': {
    codec: '6c70',
    hashAlg: 'keccak-256', // ,
    // testnet: 'olivia'
  },
}
