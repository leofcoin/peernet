import '@vandeurenglenn/debug'
import PubSub from '@vandeurenglenn/little-pubsub'
import PeerDiscovery from './discovery/peer-discovery.js'
import DHT from './dht/dht.js'
import { BufferToUint8Array, protoFor, target } from './utils/utils.js'
import MessageHandler from './handlers/message.js'
import dataHandler from './handlers/data.js'
import { encapsulatedError, dhtError,
  nothingFoundError } from './errors/errors.js'

import LeofcoinStorageClass from '@leofcoin/storage'
import { utils as codecUtils } from '@leofcoin/codecs'
import Identity from './identity.js'


declare global {
  var globalSub: PubSub;
  var pubsub: PubSub
  var peernet: Peernet
  var LeofcoinStorage: typeof LeofcoinStorageClass
  var LeofcoinStorageClient
}

globalThis.LeofcoinStorage = LeofcoinStorageClass
  
globalThis.leofcoin = globalThis.leofcoin || {}
pubsub = pubsub || new PubSub()
globalSub = globalSub || new PubSub()


/**
 * @access public
 * @example
 * const peernet = new Peernet();
 */
export default class Peernet {
  identity: Identity
  stores: string[] = []
  /**
   * @type {Object}
   * @property {Object} peer Instance of Peer
   */
  dht: DHT = new DHT()
  /** @leofcoin/peernet-swarm/client */
  client: {
    connections: [],
    id: string,
    removePeer: (peer: string) => {},
    close: () => {}
  }
  network: string
  stars: string[]
  networkVersion: string
  bw: {
    up: number
    down: number
  }
  hasDaemon: boolean = false
  autoStart: boolean = true
  #starting: boolean = false
  #started: boolean = false
  #connections = {}
  requestProtos = {}
  _messageHandler: MessageHandler
  protos: {}

  /**
   * @access public
   * @param {Object} options
   * @param {String} options.network - desired network
   * @param {String} options.stars - star list for selected network (these should match, don't mix networks)
   * @param {String} options.root - path to root directory
   * @param {String} options.storePrefix - prefix for datatores (lfc)
   *
   * @return {Promise} instance of Peernet
   *
   * @example
   * const peernet = new Peernet({network: 'leofcoin', root: '.leofcoin'});
   */
  constructor(options, password){
    /**
     * @property {String} network - current network
     */
    this.network = options.network || 'leofcoin'
    this.autoStart = options.autoStart === undefined ? true : options.autoStart
    this.stars = options.stars
    const parts = this.network.split(':')
    this.networkVersion = options.networkVersion || parts.length > 1 ? parts[1] : 'mainnet'

    if (!options.storePrefix) options.storePrefix = 'lfc'
    if (!options.port) options.port = 2000
    if (!options.root) {
      parts[1] ? options.root = `.${parts[0]}/${parts[1]}` : options.root = `.${this.network}`
    }
    
    peernet = this
    this.bw = {
      up: 0,
      down: 0,
    }
    return this._init(options, password)
  }

  get id() {
    return this.identity.id
  }

  get accounts(): Promise<[[name: string, externalAddress: string, internalAddress: string]]> {
    return this.identity.accounts
  }

  get defaultStores() {
    return ['account', 'wallet', 'block', 'transaction', 'chain', 'data', 'message']
  }

  addProto(name, proto) {
    if (!globalThis.peernet.protos[name]) globalThis.peernet.protos[name] = proto
  }

  addCodec(codec) {
    return codecUtils.addCodec(codec)
  }

  async addStore(name, prefix, root, isPrivate = true) {
    if (name === 'block' || name === 'transaction' || name === 'chain' ||
        name === 'data' || name === 'message') isPrivate = false

    let Storage
    
    this.hasDaemon ? Storage = LeofcoinStorageClient : Storage = LeofcoinStorage
    
    if (!globalThis[`${name}Store`]) {
      globalThis[`${name}Store`] = new Storage(name, root)
      await globalThis[`${name}Store`].init()
    }

    globalThis[`${name}Store`].private = isPrivate
    if (!isPrivate) this.stores.push(name)
  }


  /**
   * @see MessageHandler
   */
  prepareMessage(data) {
    return this._messageHandler.prepareMessage(data)
  }

  /**
   * @access public
   *
   * @return {Array} peerId
   */
  get peers() {
    return Object.entries(this.#connections)
  }

  get connections() {
    return Object.values(this.#connections)
  }

  get peerEntries() {
    return Object.values(this.#connections)
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
  async _init(options, password): Peernet  {
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
      ChatMessage,
      PeernetFile
      // FolderMessageResponse
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
      'peernet-file': PeernetFile
    }

    this._messageHandler = new MessageHandler(this.network)

    const {daemon, environment} = await target()
    this.hasDaemon = daemon
    
    for (const store of this.defaultStores) {
      await this.addStore(store, options.storePrefix, options.root)
    }

    this.identity = new Identity(this.network)
    await this.identity.load(password)

    
    this._peerHandler = new PeerDiscovery(this.id)
    this.peerId = this.id

    this.addRequestHandler('handshake', ( ) => {
      return new peernet.protos['peernet-response']({response: {peerId: this.id}})
    })

    pubsub.subscribe('peer:discovered', async (peer) => {
      // console.log(peer);
      
      if (this.requestProtos['version']) {
        let data = await new globalThis.peernet.protos['peernet-request']({request: 'version'});
        let node = await globalThis.peernet.prepareMessage(data);
        let response = await peer.request(node.encoded)
        response = await new globalThis.peernet.protos['peernet-response'](new Uint8Array(Object.values(response)))
        peer.version = response.decoded.response.version
      }
      
      let data = await new globalThis.peernet.protos['peernet-request']({request: 'handshake'});
      let node = await globalThis.peernet.prepareMessage(data);
      let response = await peer.request(node.encoded)
      
      response = await new globalThis.peernet.protos['peernet-response'](new Uint8Array(Object.values(response)))
      // todo: response.decoded should be the response and not response.peerId
      
      this.#connections[response.decoded.response.peerId] = peer
      pubsub.publish('peer:connected', peer)
      // todo: cleanup discovered
    })

    pubsub.subscribe('peer:left', this.#peerLeft.bind(this))

    /**
     * converts data -> message -> proto
     * @see DataHandler
     */
    pubsub.subscribe('peer:data', dataHandler)

    if (globalThis.navigator) {
      globalThis.addEventListener('beforeunload', async () => this.client.destroy());
    } else {
      process.on('SIGTERM', async () => {
        process.stdin.resume();
        await this.client.destroy()
        process.exit()
      });
    }
    if (this.autoStart) await this.start()
    return this
  }

  async start() {
    if (this.#starting || this.#started) return

    this.#starting = true
    const importee = await import('@netpeer/p2pt-swarm')
    /**
     * @access public
     * @type {PeernetClient}
     */
    this.client = new importee.default(this.id, this.networkVersion, this.stars)
    this.#started = true
    this.#starting = false
  }

  #peerLeft(peer) {
    for (const [id, _peer] of Object.entries(this.#connections)) {
      if (_peer.id === peer.id && this.#connections[id] && !this.#connections[id].connected) {
        delete this.#connections[id]
        this.removePeer(_peer)
      }
    }
    
  }

  addRequestHandler(name, method) {
    this.requestProtos[name] = method
  }

  async sendMessage(peer, id, data) {
    if (peer.connected) {
      await peer.send(data, id)
      this.bw.up += data.length
    } else this.removePeer(peer)
  }

  async handleDHT(peer, id, proto) {
    let { hash, store } = proto.decoded
    let has;

    if (store) {
      store = globalThis[`${store}Store`]
      has = store.private ? false : await store.has(hash)
    } else {
      has = await this.has(hash)
    }

    const data = await new globalThis.peernet.protos['peernet-dht-response']({hash, has})
    const node = await this.prepareMessage(data)

    this.sendMessage(peer, id, node.encoded)
  }

  async handleData(peer, id, proto) {
    let { hash, store } = proto.decoded
    let data
    store = globalThis[`${store}Store`] || await this.whichStore([...this.stores], hash)
    
    if (store && !store.private) {
      data = await store.get(hash)

      if (data) {
        data = await new globalThis.peernet.protos['peernet-data-response']({hash, data});

        const node = await this.prepareMessage(data)
        this.sendMessage(peer, id, node.encoded)
      }
    } else {
      // ban (trying to access private st)
    }
  }

  async handleRequest(peer, id, proto) {
    const method = this.requestProtos[proto.decoded.request]
    if (method) {
      const data = await method(proto.decoded.requested)
      const node = await this.prepareMessage(data)
      this.sendMessage(peer, id, node.encoded)
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
    switch(proto.name) {
      case 'peernet-dht': {
        this.handleDHT(peer, id, proto)
        break
      }
      case 'peernet-data': {
        this.handleData(peer, id, proto)
        break
      }
      case 'peernet-request': {
        this.handleRequest(peer, id, proto)
        break
      }

      case 'peernet-ps': {
        if (peer.peerId !== this.id) globalSub.publish(proto.decoded.topic, proto.decoded.data)
      }
    }
  }

  /**
   * performs a walk and resolves first encounter
   *
   * @param {String} hash
   */
  async walk(hash) {
    if (!hash) throw new Error('hash expected, received undefined')
    const data = await new globalThis.peernet.protos['peernet-dht']({hash})
    const walk = async (peer, peerId) => {
      const node = await this.prepareMessage(data)
      let result = await peer.request(node.encoded)
      result = new Uint8Array(Object.values(result))
      const proto = await protoFor(result)
      if (proto.name !== 'peernet-dht-response') throw dhtError(proto.name)

      const peerInfo = {
        ...peer.connectionStats,
        id: peerId,
      }

      if (proto.decoded.has) this.dht.addProvider(peerInfo, proto.decoded.hash)
    }
    let walks = []
    for (const [peerId, peer] of Object.entries(this.#connections)) {
      if (peerId !== this.id) {
        walks.push(walk(peer, peerId))
      }
    }
    return Promise.all(walks)
  }

  /**
   * Override DHT behavior, try's finding the content three times
   *
   * @param {String} hash
   */
  async providersFor(hash: string, store?: undefined) {
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
        if (data) return blockStore.get(hash)
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
    const closestPeer = Array.from(providers)[0];
    
    // get peer instance by id
    if (!closestPeer || !closestPeer.id) return this.requestData(hash, store?.name || store)

    const id = closestPeer.id
    const peer = this.#connections[id]

    if (peer?.connected) {

      let data = await new globalThis.peernet.protos['peernet-data']({hash, store: store?.name || store});

      const node = await this.prepareMessage(data)
      
      if (peer) data = await peer.request(node.encoded)
      else {
        // fallback and try every provider found
        const promises = []
        const providers = await this.providersFor(hash, store)
        for (const provider of providers) {
          
          const peer = this.#connections[provider.id]
        
          if (peer) promises.push(peer.request(node.encoded))
        }
        data = await Promise.race(promises)
      }
      if (data) data = new Uint8Array(Object.values(data))
      
      const proto = await protoFor(data)
      // TODO: store data automaticly or not
      return BufferToUint8Array(proto.decoded.data)

      // this.put(hash, proto.decoded.data)
    } else {
      this.dht.removeProvider(id, hash)
    }
    return
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

  get folder() {
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

  async addFolder(files) {
    const links = []
    for (const file of files) {
      const fileNode = await new globalThis.peernet.protos['peernet-file'](file)
      const hash = await fileNode.hash
      await dataStore.put(hash, fileNode.encoded)
      links.push({hash, path: file.path})
    }
    const node = await new globalThis.peernet.protos['peernet-file']({path: '/', links})
    const hash = await node.hash
    await dataStore.put(hash, node.encoded)

    return hash
  }

  async ls(hash, options) {
    let data
    const has = await dataStore.has(hash)
    data = has ? await dataStore.get(hash) : await this.requestData(hash, 'data')

    const node = await new peernet.protos['peernet-file'](data)
    await node.decode()
    console.log(data);
    const paths = []
    if (node.decoded?.links.length === 0) throw new Error(`${hash} is a file`)
    for (const {path, hash} of node.decoded.links) {
      paths.push({path, hash})
    }
    if (options?.pin) await dataStore.put(hash, node.encoded)
    return paths
  }

  async cat(hash, options) {
    let data
    const has = await dataStore.has(hash)
    data = has ? await dataStore.get(hash) : await this.requestData(hash, 'data')
    const node = await new peernet.protos['peernet-file'](data)

    if (node.decoded?.links.length > 0) throw new Error(`${hash} is a directory`)
    if (options?.pin) await dataStore.put(hash, node.encoded)
    return node.decoded.content
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
    } else return
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

    return this.requestData(hash, store?.name || store)
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
      return store.private ? false : true
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
    const id = Math.random().toString(36).slice(-12)
    data = await new globalThis.peernet.protos['peernet-ps']({data, topic})
    for (const [peerId, peer] of Object.entries(this.#connections)) {
      if (peerId !== this.id) {
        const node = await this.prepareMessage(data)
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
  async subscribe(topic, callback) {
    // TODO: if peer subscribed
    globalSub.subscribe(topic, callback)
  }

  async removePeer(peer) {
    console.log('removepeer', peer.id)
    const id = peer.id
      await this.client._removePeer(peer);
      console.log(this.client.peers[id])
      if (this.client.peers[id]) {
        for (const connection of Object.keys(this.client.peers[id])) {
            // if (this.client.peers[id][connection].connected === false) delete this.client.peers[id][connection] 
            if (this.client.peers[id][connection].connected ) return this.client.emit('peerconnect', connection)
        }
    }
  }

  get Buffer() {
    return Buffer
  }
}
globalThis.Peernet = Peernet