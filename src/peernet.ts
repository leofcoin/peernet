import { createDebugger } from '@vandeurenglenn/debug'
import PubSub, { Handler } from '@vandeurenglenn/little-pubsub'
import PeerDiscovery from './discovery/peer-discovery.js'
import DHT, { DHTProvider, DHTProviderDistanceResult, getAddress } from './dht/dht.js'
import { BufferToUint8Array, protoFor, target } from './utils/utils.js'
import MessageHandler from './handlers/message.js'
import dataHandler from './handlers/data.js'
import { dhtError, nothingFoundError } from './errors/errors.js'
import { Storage as LeofcoinStorageClass } from '@leofcoin/storage'
import { utils as codecUtils } from '@leofcoin/codecs'
import Identity from './identity.js'
import swarm from '@netpeer/swarm/client'
import FileTransfer from './file-transfer.js'

const DEFAULT_CHUNK_SIZE = 256 * 1024
const DEFAULT_BLOCK_CHUNK_SIZE = 256 * 1024
const DEFAULT_BLOCK_CHUNK_THRESHOLD = 1024 * 1024
const DEFAULT_TRANSFER_CONCURRENCY = 4

const adaptiveChunkSize = (size: number, minimum = DEFAULT_CHUNK_SIZE) => {
  if (size >= 256 * 1024 * 1024) return Math.max(minimum, 4 * 1024 * 1024)
  if (size >= 32 * 1024 * 1024) return Math.max(minimum, 1024 * 1024)
  return minimum
}

globalThis.LeofcoinStorage = LeofcoinStorageClass

globalThis.leofcoin = globalThis.leofcoin || {}
globalThis.pubsub = globalThis.pubsub || new PubSub()
globalThis.globalSub = globalThis.globalSub || new PubSub()

declare global {
  var LeofcoinStorage: typeof LeofcoinStorageClass
  var peernet: Peernet
  var pubsub: PubSub
  var globalSub: PubSub
  var blockStore: LeofcoinStorageClass
  var transactionStore: LeofcoinStorageClass
  var messageStore: LeofcoinStorageClass
  var dataStore: LeofcoinStorageClass
  var walletStore: LeofcoinStorageClass
  var chainStore: LeofcoinStorageClass
  var shareStore: LeofcoinStorageClass
}

const debug = createDebugger('peernet')
/**
 * @access public
 * @example
 * const peernet = new Peernet();
 */
export default class Peernet {
  storePrefix: string
  root: string
  identity: Identity
  stores: string[] = []
  peerId: string
  /**
   * @type {Object}
   * @property {Object} peer Instance of Peer
   */
  dht: DHT = new DHT()
  /** @leofcoin/peernet-swarm/client */
  client: swarm
  network: string
  stars: string[]
  transport
  networkVersion: string
  bw: {
    up: number
    down: number
  }
  hasDaemon: boolean = false
  autoStart: boolean = true
  #starting: boolean = false
  #started: boolean = false
  requestProtos = {}
  _messageHandler: MessageHandler
  _peerHandler: PeerDiscovery
  protos: {}
  version
  blockChunkSize: number
  blockChunkThreshold: number
  transferConcurrency: number

  #peerAttempts: { [key: string]: number } = {}
  private _inMemoryBroadcasts: any
  /**
   * @access public
   * @param {Object} options
   * @param {String} options.network - desired network
   * @param {String} options.stars - star list for selected network (these should match, don't mix networks)
   * @param {String} options.root - path to root directory
   * @param {String} options.version - path to root directory
   * @param {String} options.storePrefix - prefix for datatores (lfc)
   * @param {Object} options.transport - transport selection and fallback options passed to @netpeer/swarm
   *
   * @return {Promise} instance of Peernet
   *
   * @example
   * const peernet = new Peernet({network: 'leofcoin', root: '.leofcoin'});
   */
  constructor(options, password) {
    /**
     * @property {String} network - current network
     */
    this.network = options.network || 'leofcoin'
    this.autoStart = options.autoStart === undefined ? true : options.autoStart
    this.stars = options.stars
    this.transport = options.transport
    this.version = options.version
    this.blockChunkSize = options.blockChunkSize ?? DEFAULT_BLOCK_CHUNK_SIZE
    this.blockChunkThreshold = options.blockChunkThreshold ?? DEFAULT_BLOCK_CHUNK_THRESHOLD
    this.transferConcurrency = options.transferConcurrency ?? DEFAULT_TRANSFER_CONCURRENCY
    if (!Number.isSafeInteger(this.blockChunkSize) || this.blockChunkSize <= 0)
      throw new TypeError('blockChunkSize must be a positive integer')
    if (!Number.isSafeInteger(this.blockChunkThreshold) || this.blockChunkThreshold < 0)
      throw new TypeError('blockChunkThreshold must be a non-negative integer')
    if (!Number.isSafeInteger(this.transferConcurrency) || this.transferConcurrency <= 0)
      throw new TypeError('transferConcurrency must be a positive integer')
    const parts = this.network.split(':')
    this.networkVersion = options.networkVersion || parts.length > 1 ? parts[1] : 'mainnet'

    if (!options.storePrefix) options.storePrefix = 'lfc'
    if (!options.port) options.port = 2000
    if (!options.root) {
      parts[1] ? (options.root = `.${parts[0]}/${parts[1]}`) : (options.root = `.${this.network}`)
    }

    globalThis.peernet = this
    this.bw = {
      up: 0,
      down: 0
    }
    // @ts-ignore
    return this._init(options, password)
  }

  get id() {
    return this.identity.id
  }

  get selectedAccount(): string {
    return this.identity.selectedAccount
  }

  get accounts(): Promise<[[name: string, externalAddress: string, internalAddress: string]]> {
    return this.identity.accounts
  }

  get defaultStores() {
    return ['account', 'wallet', 'block', 'transaction', 'chain', 'data', 'message', 'share']
  }

  selectAccount(account: string) {
    return this.identity.selectAccount(account)
  }

  addProto(name, proto) {
    if (!globalThis.peernet.protos[name]) globalThis.peernet.protos[name] = proto
  }

  addCodec(codec) {
    return codecUtils.addCodec(codec)
  }

  async addStore(name, prefix, root, isPrivate = true) {
    if (
      name === 'block' ||
      name === 'transaction' ||
      name === 'chain' ||
      name === 'data' ||
      name === 'message' ||
      name === 'share'
    )
      isPrivate = false

    let Storage

    this.hasDaemon ? (Storage = LeofcoinStorageClient) : (Storage = LeofcoinStorage)

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
    return Object.entries(this.client?.connections || {})
  }

  get connections() {
    return this.client?.connections || {}
  }

  /**
   * @return {String} id - peerId
   */
  getConnection(id) {
    return this.connections[id]
  }

  /**
   * @private
   *
   * @param {Object} options
   * @param {String} options.root - path to root directory
   *
   * @return {Promise} instance of Peernet
   */
  async _init(
    options: { storePrefix?: string; root?: string; freshIdentity?: boolean },
    password: string
  ): Promise<Peernet> {
    await getAddress()
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

    const { daemon, environment } = await target()
    this.hasDaemon = daemon

    for (const store of this.defaultStores) {
      await this.addStore(store, options.storePrefix, options.root)
    }

    this.identity = new Identity(this.network)
    await this.identity.load(password, options.freshIdentity === true)

    this._peerHandler = new PeerDiscovery(this.id)
    this.peerId = this.id

    /**
     * converts data -> message -> proto
     * @see DataHandler
     */
    pubsub.subscribe('peer:data', dataHandler)

    if (this.autoStart) await this.start()
    return this
  }

  async start() {
    if (this.#starting || this.#started) return

    this.#starting = true
    const importee = await import('@netpeer/swarm/client')
    /**
     * @access public
     * @type {PeernetClient}
     */
    console.log(this.stars)

    this.client = new importee.default({
      peerId: this.id,
      networkVersion: this.networkVersion,
      version: this.version,
      stars: this.stars,
      transport: this.transport
    })
    this.#started = true
    this.#starting = false
  }

  // todo: remove, handled in swarm now
  // #peerLeft(peer: SwarmPeer) {
  //   for (const [id, _peer] of Object.entries(this.connections)) {
  //     if (_peer.id === peer.id && this.connections[id] && !this.connections[id].connected) {
  //       delete this.connections[id]
  //       this.removePeer(_peer)
  //     }
  //   }
  // }

  addRequestHandler(name, method) {
    this.requestProtos[name] = method
  }

  async sendMessage(peer, id, data) {
    if (peer.connected) {
      await peer.send(data, id)
      this.bw.up += data.length
      return id
    } else {
      return new Promise((resolve, reject) => {
        const onError = (error) => {
          this.removePeer(peer)
          reject(error)
        }
        peer.once('error', onError)
        peer.once('connect', async () => {
          if (!peer.connected) {
            peer.removeListener('error', onError)
            debug('Peer not connected')
            return
          }
          await peer.send(data, id)
          this.bw.up += data.length
          peer.removeListener('error', onError)
          resolve(id)
        })
      })
    }
  }

  async handleDHT(peer, id, proto) {
    let { hash, store } = proto.decoded
    let has

    if (store) {
      store = globalThis[`${store}Store`]
      has = store.private ? false : await store.has(hash)
    } else {
      has = await this.has(hash)
    }

    const data = await new globalThis.peernet.protos['peernet-dht-response']({
      hash,
      has
    })
    const node = await this.prepareMessage(data)

    this.sendMessage(peer, id, node.encoded)
  }

  /**
   * Broadcasts data to the network and returns a hash that can be used by another peer
   * to directly connect and download the data from the broadcasting peer.
   *
   * @param {Uint8Array|Buffer|Object|string} data - The data to broadcast
   * @param {string} [storeName='data'] - The store to use for storing the data
   * @returns {Promise<string>} The hash that can be shared for direct download
   */
  /**
   * Broadcasts data to the network and returns a hash that can be used by another peer
   * to directly connect and download the data from the broadcasting peer.
   * The data is kept in memory only and not persisted to storage.
   * @param {string} path - The path or identifier for the content being broadcasted
   * @param {{content?: Uint8Array, links?: any[]}} data - The data to broadcast
 
   * @returns {Promise<string>} The hash that can be shared for direct download
   */
  async broadcast(
    path: string,
    { content, links, chunkSize }: { content?: Uint8Array; links?: any[]; chunkSize?: number }
  ): Promise<string> {
    chunkSize = chunkSize ?? (content ? adaptiveChunkSize(content.length) : DEFAULT_CHUNK_SIZE)
    if (!Number.isSafeInteger(chunkSize) || chunkSize <= 0) throw new TypeError('chunkSize must be a positive integer')
    let protoInput: any
    if (content && content.length > chunkSize) {
      const chunkLinks = []
      for (let offset = 0, index = 0; offset < content.length; offset += chunkSize, index++) {
        const chunkNode = await new globalThis.peernet.protos['peernet-file']({
          path: `${path}.part-${index}`,
          content: content.slice(offset, Math.min(offset + chunkSize, content.length))
        })
        const chunkHash = await chunkNode.hash()
        const chunkEncoded = await chunkNode.encoded
        if (!this._inMemoryBroadcasts) this._inMemoryBroadcasts = new Map()
        this._inMemoryBroadcasts.set(chunkHash, chunkEncoded)
        await shareStore.put(chunkHash, chunkEncoded)
        chunkLinks.push({ hash: chunkHash, path: String(index), size: chunkNode.decoded.content.length })
      }
      protoInput = { path, links: chunkLinks, size: content.length, chunkSize, chunked: true }
    } else if (content) protoInput = { path, content, size: content.length }
    else if (links) protoInput = { path, links }
    else throw new TypeError('broadcast requires content or links')

    const protoNode = await new globalThis.peernet.protos['peernet-file'](protoInput)
    const hash = await protoNode.hash()
    const encoded = await protoNode.encoded
    if (!this._inMemoryBroadcasts) this._inMemoryBroadcasts = new Map()
    this._inMemoryBroadcasts.set(hash, encoded)

    // Persist to share store
    await shareStore.put(hash, encoded)

    await this.publish('broadcast', { hash, from: this.id })
    return hash
  }

  /** Create and immediately start a resumable, integrity-checked file download. */
  download(hash: string, options: { pin?: boolean; autoStart?: boolean } = {}): FileTransfer {
    const FileProto = globalThis.peernet.protos['peernet-file']
    const transfer = new FileTransfer({
      hash,
      fetch: async (wantedHash, index) => {
        if (wantedHash !== hash) {
          const providers = Object.values(this.dht.providersFor(hash) || {}) as DHTProvider[]
          for (const provider of providers) this.dht.addProvider(provider, wantedHash)
        }
        const store = await this.whichStore([...this.stores], wantedHash)
        if (store && (await store.has(wantedHash))) return store.get(wantedHash)
        const result = await this.requestData(wantedHash, undefined, { providerIndex: index })
        return result
      },
      decode: async (encoded) => {
        const node = await new FileProto(encoded)
        await node.decode()
        if (node.decoded?.chunked) {
          const providers = Object.values(this.dht.providersFor(hash) || {}) as DHTProvider[]
          for (const link of node.decoded.links || []) {
            for (const provider of providers) this.dht.addProvider(provider, link.hash)
          }
        }
        return node.decoded
      },
      concurrency: this.transferConcurrency,
      verify: async (encoded, expectedHash) => {
        const node = await new FileProto(encoded)
        return (await node.hash()) === expectedHash
      },
      pin: options.pin ? (chunkHash, encoded) => dataStore.put(chunkHash, encoded) : undefined
    })
    if (options.autoStart !== false) transfer.start()
    return transfer
  }

  async handleData(peer, id, proto) {
    let { hash, store } = proto.decoded
    let data
    try {
      if (this._inMemoryBroadcasts && this._inMemoryBroadcasts.has(hash)) {
        data = this._inMemoryBroadcasts.get(hash)
        let resolvedHash = hash
        if (typeof hash === 'function') {
          resolvedHash = await hash()
        }
        data = await new globalThis.peernet.protos['peernet-data-response']({
          hash: resolvedHash,
          data
        })

        const node = await this.prepareMessage(data)
        await this.sendMessage(peer, id, node.encoded)
        return
      }

      store = globalThis[`${store}Store`] || (await this.whichStore([...this.stores], hash))

      if (store && !store.private) {
        data = await store.get(hash)

        if (data) {
          data = await new globalThis.peernet.protos['peernet-data-response']({
            hash,
            data
          })

          const node = await this.prepareMessage(data)
          await this.sendMessage(peer, id, node.encoded)
        }
      } else {
        // ban (trying to access private st)
      }
    } catch (error) {
      console.error('handleData: error', error)
      return this.requestData(hash, store)
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
   * Send a request to connected peers and return the first response.
   *
   * @param {String} requestName - name of the registered request handler on remote peers
   * @param {Uint8Array} [requested] - optional data to send with the request
   * @returns {Promise<Uint8Array|undefined>} decoded response data or undefined
   */
  async request(requestName: string, requested?: Uint8Array) {
    const input: { request: string; requested?: Uint8Array } = { request: requestName }
    if (requested) input.requested = requested

    const data = await new globalThis.peernet.protos['peernet-request'](input)
    const node = await this.prepareMessage(data)

    const requests: Promise<any>[] = []
    for (const [peerId, peer] of Object.entries(this.connections)) {
      if (peerId !== this.id && peer.connected) {
        requests.push(peer.request(node.encoded))
      }
    }

    if (requests.length === 0) return undefined

    try {
      let result = await Promise.any(requests)
      if (result) result = new Uint8Array(Object.values(result))
      if (!result || result.length === 0) return undefined
      const proto = await protoFor(result)
      return proto.decoded.response
    } catch (error) {
      debug('request failed', error)
      return undefined
    }
  }

  /**
   * @private
   *
   * @param {Buffer} message - peernet message
   * @param {PeernetPeer} peer - peernet peer
   */
  async _protoHandler(message, peer, from) {
    const { id, proto } = message

    this.bw.down += proto.encoded.length
    switch (proto.name) {
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
        globalSub.publish(new TextDecoder().decode(proto.decoded.topic), proto.decoded.data)
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
    const data = await new globalThis.peernet.protos['peernet-dht']({ hash })
    const walk = async (peer, peerId) => {
      const node = await this.prepareMessage(data)
      try {
        let result = await peer.request(node.encoded)
        result = new Uint8Array(Object.values(result))
        const proto = await protoFor(result)
        if (proto.name !== 'peernet-dht-response') throw dhtError(proto.name)

        const peerInfo = {
          address: peer.remoteAddress,
          id: peerId
        }

        if (proto.decoded.has) this.dht.addProvider(peerInfo, proto.decoded.hash)
      } catch (error) {
        console.error(`Error while walking ${peerId}`, error)
        return undefined
      }
    }
    let walks = []
    for (const [peerId, peer] of Object.entries(this.connections)) {
      if (peerId !== this.id && peer.connected) {
        walks.push(walk(peer, peerId))
      }
    }
    // walk the network and return first result.
    // not waiting for all walks to finish, this is faster and more efficient
    return Promise.any(walks)
  }

  /**
   * Override DHT behavior, try's finding the content three times
   *
   * @param {String} hash
   */
  async providersFor(hash: string, store?: undefined) {
    let providers = this.dht.providersFor(hash)
    // walk the network to find a provider
    let tries = 0
    while ((!providers && tries < 3) || (providers && Object.keys(providers).length === 0 && tries < 3)) {
      tries += 1
      await this.walk(hash)
      providers = this.dht.providersFor(hash)
    }
    // undefined if no providers given
    return providers
  }

  get block() {
    return {
      get: async (hash: string) => {
        return this.#createBlockTransfer(hash).result
      },
      put: async (hash: string, data: Uint8Array) => {
        if (await blockStore.has(hash)) return
        if (data.length > this.blockChunkThreshold) return this.#putChunkedBlock(hash, data)
        return await blockStore.put(hash, data)
      },
      has: async (hash: string) => await blockStore.has(hash),
      download: (hash: string, options: { autoStart?: boolean } = {}) => this.#createBlockTransfer(hash, options)
    }
  }

  async #putChunkedBlock(hash: string, data: Uint8Array) {
    const links = []
    const FileProto = globalThis.peernet.protos['peernet-file']
    const chunkSize = adaptiveChunkSize(data.length, this.blockChunkSize)
    for (let offset = 0, index = 0; offset < data.length; offset += chunkSize, index++) {
      const content = data.slice(offset, Math.min(offset + chunkSize, data.length))
      const chunk = new FileProto({ path: `block-${hash}.part-${index}`, content })
      const chunkHash = await chunk.hash()
      await blockStore.put(chunkHash, chunk.encoded)
      links.push({ hash: chunkHash, path: String(index).padStart(12, '0'), size: content.length })
    }

    const manifest = new FileProto({
      path: `block-${hash}`,
      links,
      size: data.length,
      chunkSize,
      chunked: true,
      kind: 'block',
      blockHash: hash
    })
    return blockStore.put(hash, manifest.encoded)
  }

  #createBlockTransfer(hash: string, options: { autoStart?: boolean } = {}): FileTransfer {
    const FileProto = globalThis.peernet.protos['peernet-file']
    const fetch = async (wantedHash: string, index?: number) => {
      if (wantedHash !== hash) {
        const providers = Object.values(this.dht.providersFor(hash) || {}) as DHTProvider[]
        for (const provider of providers) this.dht.addProvider(provider, wantedHash)
      }
      if (await blockStore.has(wantedHash)) return blockStore.get(wantedHash)
      const result = await this.requestData(wantedHash, 'block', { providerIndex: index })
      return result
    }
    const transfer = new FileTransfer({
      hash,
      fetch,
      decode: async (encoded) => {
        let node
        try {
          node = new FileProto(encoded)
          await node.decode()
        } catch {
          // A normal block is intentionally not a peernet-file envelope.
          return { content: encoded }
        }
        if (node.decoded?.kind === 'block') {
          if (node.decoded.blockHash !== hash) throw new Error(`Block manifest hash mismatch for ${hash}`)
          const providers = Object.values(this.dht.providersFor(hash) || {}) as DHTProvider[]
          for (const link of node.decoded.links || []) {
            for (const provider of providers) this.dht.addProvider(provider, link.hash)
          }
          return node.decoded
        }
        if (node.decoded?.path?.startsWith(`block-${hash}.part-`)) return node.decoded
        return { content: encoded }
      },
      verify: async (encoded, expectedHash) => {
        const node = new FileProto(encoded)
        return (await node.hash()) === expectedHash
      },
      verifyManifest: false,
      concurrency: this.transferConcurrency,
      pin: (wantedHash, encoded) => blockStore.put(wantedHash, encoded)
    })
    if (options.autoStart !== false) transfer.start()
    return transfer
  }

  get transaction() {
    return {
      get: async (hash: string) => {
        const data = await transactionStore.has(hash)
        if (data) return await transactionStore.get(hash)
        return this.requestData(hash, 'transaction')
      },
      put: async (hash: string, data: Uint8Array) => {
        if (await transactionStore.has(hash)) return
        return await transactionStore.put(hash, data)
      },
      has: async (hash: string) => await transactionStore.has(hash)
    }
  }

  async requestData(hash, store, options: { providerIndex?: number } = {}) {
    try {
      const providers = await this.providersFor(hash)
      if (!providers || (providers && Object.keys(providers).length === 0)) throw nothingFoundError(hash)
      debug(`found ${Object.keys(providers).length} provider(s) for ${hash}`)
      // get closest peer on earth
      const providerValues = Object.values(providers) as DHTProvider[]
      let closestPeer: DHTProvider =
        options.providerIndex === undefined
          ? await this.dht.closestPeer(providerValues)
          : providerValues[options.providerIndex % providerValues.length]
      // fallback to first provider if no closest peer found
      if (!closestPeer || !closestPeer.id) closestPeer = Object.values(providers)[0]

      debug(`closest peer for ${hash} is ${closestPeer?.address}`)
      // get peer instance by id
      if (!closestPeer || !closestPeer.id) return undefined
      const id = closestPeer.id
      const peer = this.connections[id]

      if (!peer || !peer?.connected) {
        this.dht.removeProvider(id, hash)
        return this.requestData(hash, store?.name || store, options)
      }

      let data = await new globalThis.peernet.protos['peernet-data']({
        hash,
        store: store?.name || store
      })

      const node = await this.prepareMessage(data)

      if (peer?.connected) {
        try {
          if (peer) data = await peer.request(node.encoded)
          else {
            // fallback and try every provider found
            const promises = []
            const providers = await this.providersFor(hash, store)
            for (const provider of Object.values(providers)) {
              const peer = this.connections[provider.id]

              if (peer) promises.push(peer.request(node.encoded))
            }
            data = await Promise.race(promises)
          }
          if (data) data = new Uint8Array(Object.values(data))
          if (!data || data.length === 0) throw nothingFoundError(hash)
          const proto = await protoFor(data)
          // TODO: store data automaticly or not
          return BufferToUint8Array(proto.decoded.data)
        } catch (error) {
          debug(`Error while requesting data from ${id}`, error)
          // if error, remove provider
          if (this.#peerAttempts[id] > 1) {
            this.#peerAttempts[id] = 0
            debug(`Removed provider ${id} for ${hash} after 3 attempts`)

            this.dht.removeProvider(id, hash)
            console.error(nothingFoundError(hash))
            return undefined
          }

          if (this.#peerAttempts[id] === undefined) this.#peerAttempts[id] = 0
          this.#peerAttempts[id]++
          return this.requestData(hash, store?.name || store, options)
        }

        // this.put(hash, proto.decoded.data)
      } else {
        this.dht.removeProvider(id, hash)
      }
      return undefined
    } catch (error) {
      console.error(`Error while requesting data for ${hash} from the network`, error)
      return undefined
    }
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
      has: async (hash) => await messageStore.has(hash)
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
      has: async (hash) => await dataStore.has(hash)
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
      has: async (hash) => await dataStore.has(hash)
    }
  }

  get share() {
    return {
      /**
       * Get content for given share hash
       *
       * @todo Add peer permission checking to validate if requesting peer has access
       *
       * @param {String} hash
       */
      get: async (hash) => {
        debug(`get share ${hash}`)
        const data = await shareStore.has(hash)
        if (data) return await shareStore.get(hash)
        return this.requestData(hash, 'share')
      },
      /**
       * put share content
       *
       * @param {String} hash
       * @param {Buffer} data
       */
      put: async (hash, data) => await shareStore.put(hash, data),
      /**
       * @param {String} hash
       * @return {Boolean}
       */
      has: async (hash) => await shareStore.has(hash),

      /**
       * Put folder content
       *
       * @param {Array} files
       */
      putFolder: async (files) => await this.addFolder(files)
    }
  }

  /**
   * Get all shared hashes
   *
   * @returns {Promise<string[]>} Array of all shared hashes
   */
  async allSharedHashes(): Promise<string[]> {
    return await shareStore.keys()
  }

  async addFolder(files) {
    const processFile = async (file) => {
      const fileNode = await new globalThis.peernet.protos['peernet-file'](file)
      const hash = await fileNode.hash()
      await dataStore.put(hash, fileNode.encoded)
      return { hash, path: file.path }
    }

    const links = await Promise.all(files.map(processFile))

    const node = await new globalThis.peernet.protos['peernet-file']({
      path: '/',
      links
    })
    const hash = await node.hash()
    await dataStore.put(hash, node.encoded)

    return hash
  }

  async ls(hash, options) {
    let data
    const has = await dataStore.has(hash)
    data = has ? await dataStore.get(hash) : await this.requestData(hash, 'data')
    if (!data) throw nothingFoundError(hash)

    const node = await new globalThis.peernet.protos['peernet-file'](data)
    await node.decode()
    const paths = []
    if (node.decoded?.links.length === 0) throw new Error(`${hash} is a file`)
    for (const { path, hash } of node.decoded.links) {
      paths.push({ path, hash })
    }
    if (options?.pin) await dataStore.put(hash, node.encoded)
    return paths
  }

  async cat(hash, options) {
    const transfer = this.download(hash, { pin: options?.pin })
    return transfer.result
  }

  /**
   * goes trough given stores and tries to find data for given hash
   * @param {Array} stores
   * @param {string} hash
   */
  async whichStore(stores: string[], hash: string) {
    const checkStore = async (name) => {
      const store = globalThis[`${name}Store`]
      if (store) {
        const has = await store.has(hash)
        if (has) return store
      }
      throw new Error('Not found')
    }

    try {
      return await Promise.any(stores.map(checkStore))
    } catch {
      return undefined
    }
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
    if (store && (await store.has(hash))) data = await store.get(hash)
    if (data) return data

    return this.requestData(hash, store?.name || store)
  }

  /**
   * put content
   *
   * @param {String} hash
   * @param {Buffer} data
   * @param {String} storeName - storeName to access
   */
  async put(hash: string, data: Uint8Array, storeName: string | LeofcoinStorageClass = 'data') {
    const store: LeofcoinStorageClass = globalThis[`${storeName}Store`]
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
    data = await new globalThis.peernet.protos['peernet-ps']({ data, topic })
    for (const [peerId, peer] of Object.entries(this.connections)) {
      if (peerId !== this.id) {
        const node = await this.prepareMessage(data)
        this.sendMessage(peer, id, node.encoded)
      }
      // TODO: if peer subscribed
    }
  }

  // createHash(data, name) {
  //   return new CodeHash(data, {name})
  // }

  /**
   *
   * @param {String} topic
   * @param {Method} cb
   */
  async subscribe(topic: string, callback: Handler) {
    // TODO: if peer subscribed
    globalSub.subscribe(topic, callback)
  }

  async removePeer(peer) {
    console.log('removepeer', peer.id)
    const id = peer.id
    // await this.client.connections(peer)
    // if (this.client.peers[id]) {
    //   for (const connection of Object.keys(this.client.peers[id])) {
    //     // if (this.client.peers[id][connection].connected === false) delete this.client.peers[id][connection]
    //     // @ts-ignore
    //     if (this.client.peers[id][connection].connected) return this.client.emit('peerconnect', connection)
    //   }
    // }
  }

  get Buffer() {
    return Buffer
  }
}

globalThis.Peernet = Peernet
export { FileTransfer }
