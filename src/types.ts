import '@vandeurenglenn/debug'
import PubSub from '@vandeurenglenn/little-pubsub'
import Peernet from './peernet.js'
import PeerDiscovery from './discovery/peer-discovery.js'
import DHT from './dht/dht.js'
import { BufferToUint8Array, protoFor, target } from './utils/utils.js'
import MessageHandler from './handlers/message.js'
import dataHandler from './handlers/data.js'
import { encapsulatedError, dhtError, nothingFoundError } from './errors/errors.js'

import { Storage as LeofcoinStorageClass } from '@leofcoin/storage'
import { utils as codecUtils } from '@leofcoin/codecs'
import Identity from './identity.js'

declare global {
  var debug: (message) => string
  var globalSub: PubSub
  var pubsub: PubSub
  var peernet: Peernet
  var LeofcoinStorage: typeof LeofcoinStorageClass
  var LeofcoinStorageClient
  var messageStore: LeofcoinStorageClass
  var dataStore: LeofcoinStorageClass
  var transactionStore: LeofcoinStorageClass
  var blockStore: LeofcoinStorageClass
}
