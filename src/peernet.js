import '@vandeurenglenn/debug'
import PubSub from '@vandeurenglenn/little-pubsub'
import PeerDiscovery from './discovery/peer-discovery'
import DHT from './dht/dht.js'
import { CodecHash, codecs} from '@leofcoin/codec-format-interface'
import { protoFor, target } from './utils/utils.js'
import MessageHandler from './handlers/message.js'
import dataHandler from './handlers/data.js'
import { encapsulatedError, dhtError,
  nothingFoundError } from './errors/errors.js'

globalThis.leofcoin = globalThis.leofcoin || {}
globalThis.pubsub = globalThis.pubsub || new PubSub()
globalThis.globalSub = globalThis.globalSub || new PubSub({verbose: true})

/**
 * @access public
 * @example
 * const peernet = new Peernet();
 */
export default class Peernet {
  /**
   * @access public
   * @param {Object} options
   * @param {String} options.network - desired network
   * @param {String} options.root - path to root directory
   * @param {String} options.storePrefix - prefix for datatores (lfc)
   *
   * @return {Promise} instance of Peernet
   *
   * @example
   * const peernet = new Peernet({network: 'leofcoin', root: '.leofcoin'});
   */
  constructor(options = {}) {
    this._discovered = []
    /**
     * @property {String} network - current network
     */
    this.network = options.network || 'leofcoin'
    const parts = this.network.split(':')

    if (!options.storePrefix) options.storePrefix = 'lfc'
    if (!options.port) options.port = 2000
    if (!options.root) {
      if (parts[1]) options.root = `.${parts[0]}/peernet/${parts[1]}`
      else options.root = `.${this.network}/peernet`
    }
    globalThis.peernet = this
    this.bw = {
      up: 0,
      down: 0,
    }
    return this._init(options)
  }

  get defaultStores() {
    return ['account', 'wallet', 'block', 'transaction', 'chain', 'data', 'message']
  }

  get codecs() {
    return codecs
  }

  addProto(name, proto) {
    if (!globalThis.peernet.protos[name]) globalThis.peernet.protos[name] = proto
  }

  addCodec(name, codec) {
    if (!this.codecs[name]) this.codecs[name] = codec
  }

  async addStore(name, prefix, root, isPrivate = true) {
    if (!globalThis.LeofcoinStorage) {
      const importee = await import(/* webpackChunkName: "storage" */ '@leofcoin/storage')
      globalThis.LeofcoinStorage = importee.default
    }
    if (name === 'block' || name === 'transaction' || name === 'chain' ||
        name === 'data' || name === 'message') isPrivate = false

    let Storage
    if (this.hasDaemon) {
      Storage = LeofcoinStorageClient
    } else {
      Storage = LeofcoinStorage
    }
    globalThis[`${name}Store`] = globalThis[`${name}Store`] ||
      await new Storage(name, root)

    globalThis[`${name}Store`].private = isPrivate
    if (!isPrivate) this.stores.push(name)
  }


  /**
   * @see MessageHandler
   */
  prepareMessage(to, data) {
    return this._messageHandler.prepareMessage(this.id, to, data)
  }

  /**
   * @access public
   *
   * @return {Array} peerId
   */
  get peers() {
    return Object.keys(this.client.connections)
  }

  get connections() {
    return Object.values(this.client.connections)
  }

  get peerEntries() {
    return Object.entries(this.client.connections)
  }

  /**
   * @return {String} id - peerId
   */
  getConnection(id) {
    return this.client.connections[id]
  }

  /**
   * @private
   *
   * @param {Object} options
   * @param {String} options.root - path to root directory
   *
   * @return {Promise} instance of Peernet
   */
  async _init(options) {
    // peernetDHT aka closesPeer by coordinates
    /**
     * @type {Object}
     * @property {Object} peer Instance of Peer
     */
    this.dht = new DHT()
    /**
     * @type {Map}
     * @property {Object} peer Instance of Peer
     */
    this.stores = []
    this.requestProtos = {}
    this.storePrefix = options.storePrefix
    this.root = options.root

    const {
      RequestMessage,
      ResponseMessage,
      PeerMessage,
      PeerMessageResponse,
      PeernetMessage,
      DHTMessage,
      DHTMessageResponse,
      DataMessage,
      DataMessageResponse,
      PsMessage,
      ChatMessage
    } = await import(/* webpackChunkName: "messages" */ './messages.js')

    /**
     * proto Object containing protos
     * @type {Object}
     * @property {PeernetMessage} protos[peernet-message] messageNode
     * @property {DHTMessage} protos[peernet-dht] messageNode
     * @property {DHTMessageResponse} protos[peernet-dht-response] messageNode
     * @property {DataMessage} protos[peernet-data] messageNode
     * @property {DataMessageResponse} protos[peernet-data-response] messageNode
     */

    globalThis.peernet.protos = {
      'peernet-request': RequestMessage,
      'peernet-response': ResponseMessage,
      'peernet-peer': PeerMessage,
      'peernet-peer-response': PeerMessageResponse,
      'peernet-message': PeernetMessage,
      'peernet-dht': DHTMessage,
      'peernet-dht-response': DHTMessageResponse,
      'peernet-data': DataMessage,
      'peernet-data-response': DataMessageResponse,
      'peernet-ps': PsMessage,
      'chat-message': ChatMessage,
    }

    this._messageHandler = new MessageHandler(this.network)

    const {daemon, environment} = await target()
    this.hasDaemon = daemon

    for (const store of this.defaultStores) {
      await this.addStore(store, options.storePrefix, options.root)
    }

    try {
      const pub = await accountStore.get('public')
      this.id = JSON.parse(new TextDecoder().decode(pub)).walletId
      let accounts = await walletStore.get('accounts')
      accounts = new TextDecoder().decode(accounts)

      // fixing account issue (string while needs to be a JSON)
      // TODO: remove when on mainnet
      try {
        this.accounts = JSON.parse(account)
      } catch (e) {
        this.accounts = [accounts.split(',')]
      }
    } catch (e) {
      if (e.code === 'ERR_NOT_FOUND') {

        const importee = await import(/* webpackChunkName: "generate-account" */ '@leofcoin/generate-account')
        const generateAccount = importee.default
        const wallet = {}
        const {identity, accounts, config} = await generateAccount(this.network)
        walletStore.put('version', new TextEncoder().encode(1))
        walletStore.put('accounts', new TextEncoder().encode(JSON.stringify(accounts)))
        walletStore.put('identity', new TextEncoder().encode(JSON.stringify(identity)))
        await accountStore.put('config', new TextEncoder().encode(JSON.stringify(config)));
        await accountStore.put('public', new TextEncoder().encode(JSON.stringify({walletId: identity.walletId})));

        this.id = identity.walletId
      } else {
        throw e
      }
    }
    this._peerHandler = new PeerDiscovery(this.id)
    this.peerId = this.id

    pubsub.subscribe('peer:connected', async (peer) => {
      console.log(peer);
      // console.log({connected: peer.id, as: this._getPeerId(peer.id) });
      // peer.on('peernet.data', async (message) => {
      //   const id = message.id
      //   message = new PeernetMessage(Buffer.from(message.data.data))
      //   const proto = protoFor(message.decoded.data)
      //   this._protoHandler({id, proto}, peer)
      // })
    })

    /**
     * converts data -> message -> proto
     * @see DataHandler
     */
    pubsub.subscribe('peer:data', dataHandler)


    const importee = await import(/* webpackChunkName: "peernet-swarm" */ '@leofcoin/peernet-swarm')
    /**
     * @access public
     * @type {PeernetClient}
     */
    this.client = new importee.default(this.id)
    if (globalThis.onbeforeunload) {
      globalThis.addEventListener('beforeunload', async () => this.client.close());
    }
    return this
  }

  addRequestHandler(name, method) {
    this.requestProtos[name] = method
  }

  sendMessage(peer, id, data) {
    if (peer.readyState === 'open') {
      peer.send(data, id)
      this.bw.up += data.length
    } else if (peer.readyState === 'closed') {
      // this.removePeer(peer)
    }

  }

  /**
   * @private
   *
   * @param {Buffer} message - peernet message
   * @param {PeernetPeer} peer - peernet peer
   */
  async _protoHandler(message, peer, from) {

    const {id, proto} = message
    this.bw.down += proto.encoded.length
      if (proto.name === 'peernet-dht') {
        let { hash, store } = proto.decoded
        let has;

        if (!store) {
          has = await this.has(hash)
        } else {
          store = globalThis[`${store}Store`]
          if (store.private) has = false
          else has = await store.has(hash)
        }
        const data = await new globalThis.peernet.protos['peernet-dht-response']({hash, has})
        const node = await this.prepareMessage(from, data.encoded)

        this.sendMessage(peer, id, node.encoded)
      } else if (proto.name === 'peernet-data') {
        let { hash, store } = proto.decoded
        let data
        if (!store) {
          store = await this.whichStore([...this.stores], hash)
        } else {
          store = globalThis[`${store}Store`]
        }
        if (store && !store.private) {
          data = await store.get(hash)

          if (data) {
            data = await new globalThis.peernet.protos['peernet-data-response']({hash, data});

            const node = await this.prepareMessage(from, data.encoded)
            this.sendMessage(peer, id, node.encoded)
          }
        } else {
          // ban (trying to access private st)
        }

      } else if (proto.name === 'peernet-request') {
        const method = this.requestProtos[proto.decoded.request]
        if (method) {
          const data = await method()
          const node = await this.prepareMessage(from, data.encoded)
          this.sendMessage(peer, id, node.encoded)
        }
      } else if (proto.name === 'peernet-ps' && peer.peerId !== this.id) {
        globalSub.publish(new TextDecoder().decode(proto.decoded.topic), proto.decoded.data)
      }
    // }
  }

  /**
   * performs a walk and resolves first encounter
   *
   * @param {String} hash
   */
  async walk(hash) {
    if (!hash) throw new Error('hash expected, received undefined')
    const data = await new globalThis.peernet.protos['peernet-dht']({hash})
    const clientId = this.client.id
    const walk = async peer => {
      const node = await this.prepareMessage(peer.peerId, data.encoded)
      let result = await peer.request(node.encoded)
      result = new Uint8Array(Object.values(result))
      let proto = await protoFor(result)
      if (proto.name !== 'peernet-message') throw encapsulatedError()
      const from = proto.decoded.from
      proto = await protoFor(proto.decoded.data)
      if (proto.name !== 'peernet-dht-response') throw dhtError(proto.name)

      // TODO: give ip and port (just used for location)
      if (!peer.connection.remoteAddress || !peer.connection.localAddress) {
        peer.connection.remoteFamily = 'ipv4'
        peer.connection.remoteAddress = '127.0.0.1'
        peer.connection.remotePort = '0000'
      }

      const peerInfo = {
        family: peer.connection.remoteFamily || peer.connection.localFamily,
        address: peer.connection.remoteAddress || peer.connection.localAddress,
        port: peer.connection.remotePort || peer.connection.localPort,
        id: from,
      }

      if (proto.decoded.has) this.dht.addProvider(peerInfo, proto.decoded.hash)
    }
    let walks = []
    for (const peer of this.connections) {
      if (peer.peerId !== this.id) {
        walks.push(walk(peer))
      }
    }
    return Promise.all(walks)
  }

  /**
   * Override DHT behavior, try's finding the content three times
   *
   * @param {String} hash
   */
  async providersFor(hash) {
    let providers = await this.dht.providersFor(hash)
    // walk the network to find a provider
    if (!providers || providers.length === 0) {
      await this.walk(hash)
      providers = await this.dht.providersFor(hash)
      // second walk the network to find a provider
      if (!providers || providers.length === 0) {
        await this.walk(hash)
        providers = await this.dht.providersFor(hash)
      }
      // last walk
      if (!providers || providers.length === 0) {
        await this.walk(hash)
        providers = await this.dht.providersFor(hash)
      }
    }
    // undefined if no providers given
    return providers
  }

  get block() {
    return {
      get: async (hash) => {
        const data = await blockStore.has(hash)
        if (data) return await blockStore.get(hash)
        return this.requestData(hash, 'block')
      },
      put: async (hash, data) => {
        if (await blockStore.has(hash)) return
        return await blockStore.put(hash, data)
      },
      has: async (hash) => await blockStore.has(hash, 'block'),
    }
  }

  get transaction() {
    return {
      get: async (hash) => {
        const data = await transactionStore.has(hash)
        if (data) return await transactionStore.get(hash)
        return this.requestData(hash, 'transaction')
      },
      put: async (hash, data) => {
        if (await transactionStore.has(hash)) return
        return await transactionStore.put(hash, data)
      },
      has: async (hash) => await transactionStore.has(hash),
    }
  }

  async requestData(hash, store) {
    const providers = await this.providersFor(hash)
    if (!providers || providers.size === 0) throw nothingFoundError(hash)
    debug(`found ${providers.size} provider(s) for ${hash}`)
    // get closest peer on earth
    const closestPeer = await this.dht.closestPeer(providers)
    // get peer instance by id
    if (!closestPeer || !closestPeer.id) return this.requestData(hash, store?.name ? store?.name : store)

    const id = closestPeer.id
    if (this.connections) {
      let closest = this.connections.filter((peer) => {
        if (peer.peerId === id) return peer
      })

      let data = await new globalThis.peernet.protos['peernet-data']({hash, store: store?.name ? store?.name : store});

      const node = await this.prepareMessage(id, data.encoded)
      if (closest[0]) data = await closest[0].request(node.encoded)
      else {
        closest = this.connections.filter((peer) => {
          if (peer.peerId === id) return peer
        })
        if (closest[0]) data = await closest[0].request(node.encoded)
      }
      data = new Uint8Array(Object.values(data))
      let proto = await protoFor(data)
      proto = await protoFor(proto.decoded.data)
      // TODO: store data automaticly or not
      return proto.decoded.data

      // this.put(hash, proto.decoded.data)
    }
    return null
  }


  get message() {
    return {
      /**
       * Get content for given message hash
       *
       * @param {String} hash
       */
      get: async (hash) => {
        debug(`get message ${hash}`)
        const message = await messageStore.has(hash)
        if (message) return await messageStore.get(hash)
        return this.requestData(hash, 'message')
      },
      /**
       * put message content
       *
       * @param {String} hash
       * @param {Buffer} message
       */
      put: async (hash, message) => await messageStore.put(hash, message),
      /**
       * @param {String} hash
       * @return {Boolean}
       */
      has: async (hash) => await messageStore.has(hash),
    }
  }

  get data() {
    return {
      /**
       * Get content for given data hash
       *
       * @param {String} hash
       */
      get: async (hash) => {
        debug(`get data ${hash}`)
        const data = await dataStore.has(hash)
        if (data) return await dataStore.get(hash)
        return this.requestData(hash, 'data')
      },
      /**
       * put data content
       *
       * @param {String} hash
       * @param {Buffer} data
       */
      put: async (hash, data) => await dataStore.put(hash, data),
      /**
       * @param {String} hash
       * @return {Boolean}
       */
      has: async (hash) => await dataStore.has(hash),
    }
  }

  /**
   * goes trough given stores and tries to find data for given hash
   * @param {Array} stores
   * @param {string} hash
   */
  async whichStore(stores, hash) {
    let store = stores.pop()
    const name = store
    store = globalThis[`${store}Store`]
    if (store) {
      const has = await store.has(hash)
      if (has) return store
      if (stores.length > 0) return this.whichStore(stores, hash)
    } else return null
  }

  /**
   * Get content for given hash
   *
   * @param {String} hash - the hash of the wanted data
   * @param {String} store - storeName to access
   */
  async get(hash, store) {
    debug(`get ${hash}`)
    let data
    if (store) store = globalThis[`${store}Store`]
    if (!store) store = await this.whichStore([...this.stores], hash)
    if (store && await store.has(hash)) data = await store.get(hash)
    if (data) return data

    return this.requestData(hash, store?.name ? store.name : store)
  }

  /**
   * put content
   *
   * @param {String} hash
   * @param {Buffer} data
   * @param {String} store - storeName to access
   */
  async put(hash, data, store = 'data') {
    store = globalThis[`${store}Store`]
    return store.put(hash, data)
  }

  /**
   * @param {String} hash
   * @return {Boolean}
   */
  async has(hash) {
    const store = await this.whichStore([...this.stores], hash)
    if (store) {
      if (store.private) return false
      else return true
    }
    return false
  }

  /**
   *
   * @param {String} topic
   * @param {String|Object|Array|Boolean|Buffer} data
   */
  async publish(topic, data) {
    // globalSub.publish(topic, data)
    if (topic instanceof Uint8Array === false) topic = new TextEncoder().encode(topic)
    if (data instanceof Uint8Array === false) data = new TextEncoder().encode(JSON.stringify(data))
    const id = Math.random().toString(36).slice(-12)
    data = await new globalThis.peernet.protos['peernet-ps']({data, topic})
    for (const peer of this.connections) {
      if (peer.peerId !== this.peerId) {
        const node = await this.prepareMessage(peer.peerId, data.encoded)
        this.sendMessage(peer, id, node.encoded)
      }
      // TODO: if peer subscribed
    }
  }

  createHash(data, name) {
    return new CodeHash(data, {name})
  }

  /**
   *
   * @param {String} topic
   * @param {Method} cb
   */
  async subscribe(topic, cb) {
    // TODO: if peer subscribed
    globalSub.subscribe(topic, cb)
  }

  async removePeer(peer) {
    return this.client.removePeer(peer)
  }

  get Buffer() {
    return Buffer
  }
  // async block(index) {
  //   const _values = []
  //   for (const peer of this.peers) {
  //     const value = await peer.request({type: 'block', index})
  //     console.log(value);
  //   }
  //
  // }
}
