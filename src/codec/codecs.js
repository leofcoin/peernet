export default {
  // just a hash
  'disco-hash': {
    codec: parseInt('30', 16),
    hashAlg: 'dbl-keccak-512', // ,
    // testnet: 'olivia'
  },
  'peernet-peer-response': {
    codec: parseInt('707072', 16),
    hashAlg: 'keccak-256',
  },
  'peernet-peer': {
    codec: parseInt('7070', 16),
    hashAlg: 'keccak-256',
  },
  'peernet-dht': {
    codec: parseInt('706468', 16),
    hashAlg: 'keccak-256',
  },
  'peernet-dht-response': {
    codec: parseInt('706472', 16),
    hashAlg: 'keccak-256',
  },
  // data
  'peernet-data': {
    codec: parseInt('706461', 16),
    hashAlg: 'keccak-256',
  },
  'peernet-data-response': {
    codec: parseInt('70646172', 16),
    hashAlg: 'keccak-256',
  },
  // message
  'peernet-message': {
    codec: parseInt('706d65', 16),
    hashAlg: 'keccak-512',
  },
  // pubsub
  'peernet-ps': {
    codec: parseInt('707073', 16),
    hashAlg: 'keccak-256',
  },
  'peernet-response': {
    codec: parseInt('7072', 16),
    hashAlg: 'keccak-256',
  },
  'peernet-request': {
    codec: parseInt('707271', 16),
    hashAlg: 'keccak-256',
  },
  // normal block
  'leofcoin-block': {
    codec: parseInt('6c62', 16),
    hashAlg: 'dbl-keccak-512', // ,
    // testnet: 'olivia'
  },
  'leofcoin-tx': {
    codec: parseInt('6c74', 16),
    hashAlg: 'dbl-keccak-512', // ,
    // testnet: 'olivia'
  },
  // itx
  'leofcoin-itx': {
    codec: parseInt('6c69', 16),
    hashAlg: 'keccak-512', // ,
    // testnet: 'olivia'
  },
  // peer reputation
  'leofcoin-pr': {
    codec: parseInt('6c70', 16),
    hashAlg: 'keccak-256', // ,
    // testnet: 'olivia'
  },
  // chat message
  'chat-message': {
    codec: parseInt('636d', 16),
    hashAlg: 'dbl-keccak-512',
  },
}
