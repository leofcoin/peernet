import Pubsub from '@vandeurenglenn/little-pubsub'
import Client from './client'
import LeofcoinStorage from '@leofcoin/storage'
import http from './http/http.js'
import httpClient from './http/client/client.js'
import LeofcoinStorageClient from './http/client/storage.js'
import PeernetMessage from './messages/peernet-message.js'
import DHTMessage from './messages/dht.js'
import DHTMessageResponse from './messages/dht-response.js'
import DataMessage from './messages/data.js'
import PsMessage from './messages/ps.js'
import PeerMessage from './messages/peer.js'
import RequestMessage from './messages/request.js'
import ResponseMessage from './messages/response.js'
import PeerMessageResponse from './messages/peer-response.js'
import DataMessageResponse from './messages/data-response.js'
import ChatMessage from './messages/chat-message.js'
import PeerDiscovery from './discovery/peer-discovery'
import DHT from './dht/dht.js'
import Hash from './hash/hash'
import codecs from './codec/codecs'
import { debug, protoFor, target } from './utils/utils.js'
import generateAccount from
  './../node_modules/@leofcoin/generate-account/dist/module/generate-account.js'
import MessageHandler from './handlers/message.js'
import { encapsulatedError, dhtError,
  nothingFoundError } from './errors/errors.js'

globalThis.leofcoin = globalThis.leofcoin || {}
globalThis.globalSub = globalThis.globalSub || new Pubsub({verbose: true})

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

  addProto(name, proto) {
    if (!this.protos[name]) this.protos[name] = proto
  }

  addCodec(name, codec) {
    if (!this.codecs[name]) this.codecs[name] = codec
  }

  async addStore(name, prefix, root, isPrivate = true) {
    if (name === 'block' || name === 'transaction' || name === 'chain' ||
        name === 'data' || name === 'message') isPrivate = false

    let Storage
    if (this.hasDaemon) {
      Storage = LeofcoinStorageClient
    } else {
      Storage = LeofcoinStorage
    }
    globalThis[`${name}Store`] = globalThis[`${name}Store`] ||
      await new Storage(`${prefix}-${name}`, root)

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
    return [...connections.values()]
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
    this.peerMap = new Map()
    this.stores = []
    this.requestProtos = {}
    this.storePrefix = options.storePrefix
    this.root = options.root

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

    this.protos = globalThis.peernet.protos
    this.codecs = codecs

    this._messageHandler = new MessageHandler(this.network)

    const {daemon, environment} = await target()
    this.hasDaemon = daemon

    if (this.hasDaemon) {
      globalThis.peernet.client = await httpClient({
        protocol: 'peernet-v0.1.0', host: '127.0.0.1', port: options.port,
      })
    } else {
      if (environment !== 'browser') http(options)
    }

    for (const store of this.defaultStores) {
      await this.addStore(store, options.storePrefix, options.root)
    }

    try {
      const pub = await accountStore.get('public')
      this.id = pub.walletId
    } catch (e) {
      if (e.code === 'ERR_NOT_FOUND') {
        const wallet = {}
        const {identity, accounts, config} = await generateAccount(this.network)
        wallet.identity = identity
        wallet.accounts = accounts
        wallet.version = 1
        walletStore.put(wallet)
        await accountStore.put('config', config);
        await accountStore.put('public', {walletId: wallet.identity.walletId});

        this.id = wallet.identity.walletId
      } else {
        throw e
      }
    }
    this._peerHandler = new PeerDiscovery(this.id)
    // peernet id
    const id = Buffer.from(this.id.slice(0, 32))
    this.peerId = id

    pubsub.subscribe('peer:discovered', async (peer) => {
      peer.on('peernet.data', async (message) => {
        const id = message.id;
        message = new PeernetMessage(Buffer.from(message.data.data));
        const proto = protoFor(message.decoded.data);
        await this._protoHandler({id, proto}, peer);
      });
      await this._peerHandler.discover(peer);
      const fulldId = this._getPeerId(peer.id);
      if (fulldId && this._discovered.indexOf(peer.id) === -1) {
        this._discovered.push(peer.id);
        pubsub.publish('peer:connected', peer);
      }
    });
    pubsub.subscribe('peer:disconnected', async (peer) => {
      let index = this._discovered.indexOf(peer.id)
      if (index !== -1) this._discovered.splice(index, 1)
      const id = this._getPeerId(peer.id)
      let peerIds = this.peerMap.get(id)

      if (peerIds) {
        index = peerIds.indexOf(peer.id)
        if (index !== -1) peerIds.splice(index, 1)
      } else {
        peerIds = []
      }

      if (peerIds.length === 0) this.peerMap.delete(id)
      else this.peerMap.set(id, peerIds)
    })
    pubsub.subscribe('peer:connected', async (peer) => {
      console.log({connected: peer.id, as: this._getPeerId(peer.id) });
      // peer.on('peernet.data', async (message) => {
      //   const id = message.id
      //   message = new PeernetMessage(Buffer.from(message.data.data))
      //   const proto = protoFor(message.decoded.data)
      //   this._protoHandler({id, proto}, peer)
      // })
    })

    /**
     * @access public
     * @type {PeernetClient}
     */
    this.client = new Client({...options, id})
    if (globalThis.onbeforeunload) {
      globalThis.addEventListener('beforeunload', async () => this.client.close());
    }
    return this
  }

  _getPeerId(id) {
    for (const entry of [...this.peerMap.entries()]) {
      for (const _id of entry[1]) {
        if (_id === id) return entry[0]
      }
    }
  }

  addRequestHandler(name, method) {
    this.requestProtos[name] = method
  }

  /**
   * @private
   *
   * @param {Buffer} message - peernet message
   * @param {PeernetPeer} peer - peernet peer
   */
  async _protoHandler(message, peer) {
    const {id, proto} = message
    this.bw.down += proto.encoded.length
    if (proto.name === 'peernet-peer') {
      const from = proto.decoded.id
      if (!this.peerMap.has(from)) this.peerMap.set(from, [peer.id])
      else {
        const connections = this.peerMap.get(from)
        if (connections.indexOf(peer.id) === -1) {
          connections.push(peer.id)
          this.peerMap.set(from, connections)
        }
      }
      const data = new PeerMessageResponse({id: this.id})
      const node = await this.prepareMessage(from, data.encoded)

      peer.write(Buffer.from(JSON.stringify({id, data: node.encoded})))
      this.bw.up += node.encoded.length
    } else if (proto.name === 'peernet-peer-response') {
      const from = proto.decoded.id
      if (!this.peerMap.has(from)) this.peerMap.set(from, [peer.id])
      else {
        const connections = this.peerMap.get(from)
        if (connections.indexOf(peer.id) === -1) {
          connections.push(peer.id)
          this.peerMap.set(from, connections)
        }
      }
    } else {
      let from = this._getPeerId(peer.id)
      if (!from) {
        const data = new PeerMessage({id: this.id})
        const node = await this.prepareMessage(peer.id, data.encoded)
        this.bw.up += node.encoded.length
        let response = await peer.request(node.encoded)
        response = protoFor(response)

        response = new PeerMessageResponse(response.decoded.data)

        from = response.decoded.id
        if (!this.peerMap.has(from)) this.peerMap.set(from, [peer.id])
        else {
          const connections = this.peerMap.get(from)
          if (connections.indexOf(peer.id) === -1) {
            connections.push(peer.id)
            this.peerMap.set(from, connections)
          }
        }
      }
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
        const data = new DHTMessageResponse({hash, has})
        const node = await this.prepareMessage(from, data.encoded)

        peer.write(Buffer.from(JSON.stringify({id, data: node.encoded})))
        this.bw.up += node.encoded.length
      } else if (proto.name === 'peernet-data') {
        let { hash, store } = proto.decoded
        let data

        if (!store) {
          store = await this.whichStore([...this.stores], hash)
        }
        if (store && !store.private) {
          data = await store.get(hash)

          if (data) {
            data = new DataMessageResponse({hash, data: data.decoded ? Buffer.from(JSON.stringify(data)) : Buffer.from(data)});

            const node = await this.prepareMessage(from, data.encoded)
            peer.write(Buffer.from(JSON.stringify({id, data: node.encoded})))
            this.bw.up += node.encoded.length
          }
        } else {
          // ban (trying to access private store)
        }

      } else if (proto.name === 'peernet-peer') {
        const from = proto.decoded.id
        if (!this.peerMap.has(from)) this.peerMap.set(from, [peer.id])
        else {
          const connections = this.peerMap.get(from)
          connections.push(peer.id)
          this.peerMap.set(from, connections)
        }
        const data = new PeerMessage({id: this.id})
        const node = await this.prepareMessage(from, data.encoded)

        peer.write(Buffer.from(JSON.stringify({id, data: node.encoded})))
        this.bw.up += node.encoded.length
      } else if (proto.name === 'peernet-request') {
        // TODO: make dynamic
        // exposeddevapi[proto.decoded.request](proto.decoded.params)
        const method = this.requestProtos[proto.decoded.request]
        if (method) {
          const data = await method()
          const node = await this.prepareMessage(from, data.encoded)
          peer.write(Buffer.from(JSON.stringify({id, data: node.encoded})))
          this.bw.up += node.encoded.length
        }
      } else if (proto.name === 'peernet-ps' &&
                 this._getPeerId(peer.id) !== this.id.toString()) {
        globalSub.publish(proto.decoded.topic.toString(), proto.decoded.data.toString())
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
    const data = new DHTMessage({hash})
    const clientId = this.client.id
    for (const peer of this.peers) {
      const node = await this.prepareMessage(peer.id, data.encoded)

      const result = await peer.request(node.encoded)

      let proto = protoFor(result.data)

      if (proto.name !== 'peernet-message') throw encapsulatedError()
      const from = proto.decoded.from
      proto = protoFor(proto.decoded.data)

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
    return
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
    if (!closestPeer || !closestPeer.id) return this.requestData(hash, store)

    const id = closestPeer.id.toString()
    if (this.peers) {
      let closest = this.peers.filter((peer) => {
        if (this._getPeerId(peer.id) === id) return peer
      })

      let data = new DataMessage({hash, store})

      const node = await this.prepareMessage(id, data.encoded)
      if (closest[0]) data = await closest[0].request(node.encoded)
      else {
        closest = this.peers.filter((peer) => {
          if (peer.id.toString() === id) return peer
        })
        if (closest[0]) data = await closest[0].request(node.encoded)
      }
      if (data.data) {
        let proto = protoFor(Buffer.from(data.data))
        proto = protoFor(proto.decoded.data)
        return proto.decoded.data
      }

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

    return this.requestData(hash, store)
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
    if (!Buffer.isBuffer(topic)) topic = Buffer.from(topic)
    if (!Buffer.isBuffer(data)) data = Buffer.from(data)
    const id = Math.random().toString(36).slice(-12)
    data = new PsMessage({data, topic})
    for (const peer of this.peers) {
      if (peer.connection._connected) {
        if (peer.id.toString() !== this.peerId.toString()) {
          const node = await this.prepareMessage(peer.id, data.encoded)
          peer.write(Buffer.from(JSON.stringify({id, data: node.encoded})))
        }
      } else {
        this.removePeer(peer)
      }
      // TODO: if peer subscribed
    }
  }

  createHash(data, name) {
    return new Hash(data, {name})
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
    connections.delete(peer.id)
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
