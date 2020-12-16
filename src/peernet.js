import Pubsub from '@vandeurenglenn/little-pubsub'
import Client from './client'
import LeofcoinStorage from './../node_modules/@leofcoin/storage/src/level.js'
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
import DHT from './dht/dht.js'
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
   *
   * @return {Promise} instance of Peernet
   *
   * @example
   * const peernet = new Peernet({network: 'leofcoin', root: '.leofcoin'});
   */
  constructor(options = {}) {
    globalThis.peernet = globalThis.peernet || this
    /**
     * @property {String} network - current network
     */
    this.network = options.network || 'leofcoin'
    const parts = this.network.split(':')

    if (!options.port) options.port = 2000
    if (!options.root) {
      if (parts[1]) options.root = `.${parts[0]}/peernet/${parts[1]}`
      else options.root = `.${this.network}/peernet`
    }

    // peernetDHT aka closesPeer by coordinates
    /**
     * @type {Object}
     * @property {Object} peer Instance of Peer
     */
    this.dht = new DHT()
    this.peerMap = new Map()

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
    }

    this.protos = globalThis.peernet.protos

    this._messageHandler = new MessageHandler(this.network)
    return this._init(options)
  }

  addProto(name, proto) {
    if (!globalThis.peernet.protos[name]) globalThis.peernet.protos[name] = proto
  }

  addCodec(name, proto) {
    if (!globalThis.peernet.codecs[name]) globalThis.peernet.codecs[name] = proto
  }


  /**
   * @see MessageHandler
   */
  prepareMessage(to, data) {
    return this._messageHandler.prepareMessage(this.id, to, data)
  }

  get peers() {
    return connections.values()
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
    const {daemon, environment} = await target()
    if (daemon) {
      globalThis.peernet.client = await httpClient({
        protocol: 'peernet-v0.1.0', host: '127.0.0.1', port: options.port,
      })
      globalThis.accountStore = globalThis.accountStore ||
        await new LeofcoinStorageClient('lfc-account', options.root)
      globalThis.walletStore = globalThis.walletStore ||
        await new LeofcoinStorageClient('lfc-wallet', options.root)
      globalThis.blockStore = globalThis.blockStore ||
        await new LeofcoinStorageClient('lfc-block', options.root)
      globalThis.chainStore = globalThis.chainStore ||
        await new LeofcoinStorageClient('lfc-chain', options.root)
    } else {
      globalThis.accountStore = globalThis.accountStore ||
        new LeofcoinStorage('lfc-account', options.root)
      globalThis.walletStore = globalThis.walletStore ||
        new LeofcoinStorage('lfc-wallet', options.root)
      globalThis.blockStore = globalThis.blockStore ||
        new LeofcoinStorage('lfc-block', options.root)
      globalThis.chainStore = globalThis.chainStore ||
        new LeofcoinStorage('lfc-chain', options.root)

      if (environment !== 'browser') http(options)
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
    // peernet id
    const id = Buffer.from(this.id.slice(0, 32))
    this.peerId = id

    pubsub.subscribe('peer:connected', async (peer) => {
      console.log(peer.id);
      // const message = new PeerMessage({id: this.id})
      // const response = await peer.request(message.encoded)
      // console.log(response);
      peer.on('peernet.data', (message) => this._protoHandler(message, peer))
      // this.peers.push(peer)
    })
    /**
     * @access public
     * @type {PeernetClient}
     */
    this.client = new Client({...options, id})
    return this
  }

  _getPeerId(id) {
    console.log({get: id});
    return [...this.peerMap.entries()].forEach((entry, i) => {
      return entry[1].forEach((_id, i) => {
        if (_id === id) return entry[0]
      })
    })
  }

  /**
   * @private
   *
   * @param {Buffer} message - peernet message
   * @param {PeernetPeer} peer - peernet peer
   */
  async _protoHandler(message, peer) {
    const id = message.id
    message = new PeernetMessage(Buffer.from(message.data))
    const clientId = this.client.id
    const proto = protoFor(message.decoded.data)
    if (proto.name === 'peernet-peer') {
      const from = proto.decoded.id
      if (!this.peerMap.has(from)) this.peerMap.set(from, [peer.id])
      else {
        const connections = this.peerMap.get(from)
        connections.push(peer.id)
        this.peerMap.set(from, connections)
      }
      const data = new PeerMessageResponse({id: this.id})
      const node = await this.prepareMessage(from, data.encoded)

      peer.write(Buffer.from(JSON.stringify({id, data: node.encoded})))
    } else if (proto.name === 'peernet-peer-response') {
      const from = proto.decoded.id
      if (!this.peerMap.has(from)) this.peerMap.set(from, [peer.id])
      else {
        const connections = this.peerMap.get(from)
        connections.push(peer.id)
        this.peerMap.set(from, connections)
      }
    } else {
      let from = this._getPeerId(peer.id)
      if (!from) {
        const data = new PeerMessage({id: this.id})
        const node = await this.prepareMessage(peer.id, data.encoded)

        let response = await peer.request(node.encoded)
        response = protoFor(response)
        response = new PeerMessageResponse(response.decoded.data)

        from = response.decoded.id
        if (!this.peerMap.has(from)) this.peerMap.set(from, [peer.id])
        else {
          const connections = this.peerMap.get(from)
          connections.push(peer.id)
          this.peerMap.set(from, connections)
        }
      }
      if (proto.name === 'peernet-dht') {
        const hash = proto.decoded.hash
        const has = await this.has(hash)

        const data = new DHTMessageResponse({hash, has})
        const node = await this.prepareMessage(from, data.encoded)

        peer.write(Buffer.from(JSON.stringify({id, data: node.encoded})))
      } else if (proto.name === 'peernet-data') {
        const hash = proto.decoded.hash
        const has = await blockStore.has(hash)
        if (has) {
          let data = await blockStore.get(hash)
          data = new DataMessageResponse({hash, data: Buffer.from(data)})

          const node = await this.prepareMessage(from, data.encoded)

          peer.write(Buffer.from(JSON.stringify({id, data: node.encoded})))
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
      } else if (proto.name === 'peernet-request') {
        // TODO: make dynamic
        if (proto.decoded.request === 'lastBlock') {
          const height = await chainStore.get('localIndex')
          const hash = await chainStore.get('localBlock')
          response = { height, hash }
        }
        const data = new ResponseMessage({response})
        const node = await this.prepareMessage(from, data.encoded)

        peer.write(Buffer.from(JSON.stringify({id, data: node.encoded})))
      } else if (proto.name === 'peernet-ps' &&
                 message.decoded.from.toString() !== this.id.toString()) {
        console.log(message.decoded.from.toString(), this.id.toString());
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

      const peerInfo = {
        family: peer.connection.remoteFamily || peer.connection.localFamily,
        address: peer.connection.remoteAddress || peer.connection.localAddress,
        port: peer.connection.remotePort || peer.connection.localPort,
        id: from,
      }

      if (proto.decoded.has) this.dht.addProvider(peerInfo, proto.decoded.hash)
    }
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
    }
    // undefined if no providers given
    return providers
  }

  /**
   * Get content for given hash
   *
   * @param {String} hash
   */
  async get(hash) {
    debug(`get ${hash}`)
    let data = await blockStore.has(hash)
    if (data) return await blockStore.get(hash)
    const providers = await this.providersFor(hash)
    if (!providers || providers.size === 0) throw nothingFoundError(hash)
    debug(`found ${providers.size} for ${hash}`)

    // get closest peer on earth
    const closestPeer = await this.dht.closestPeer(providers)

    // get peer instance by id
    const id = closestPeer.id.toString()
    const closest = this.peers.filter((peer) => {
      if (peer.id.toString() === id) return peer
    })

    data = new DataMessage({hash})

    const node = await this.prepareMessage(id, data.encoded)

    data = await closest[0].request(node.encoded)
    let proto = protoFor(Buffer.from(data.data))
    proto = protoFor(proto.decoded.data)
    // this.put(hash, proto.decoded.data)
    return proto.decoded.data
  }

  /**
   * put content
   *
   * @param {String} hash
   * @param {string} data encoded message
   */
  async put(hash, data) {
    return await blockStore.put(hash, data)
  }

  /**
   * @param {String} hash
   * @return {Boolean}
   */
  async has(hash) {
    return await blockStore.has(hash)
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
      if (peer.connection._connected && peer.id.toString() !== this.peerId.toString()) {
        const node = await this.prepareMessage(peer.id, data.encoded)
        peer.write(Buffer.from(JSON.stringify({id, data: node.encoded})))
      } else {
        this.removePeer(peer)
      }
      // TODO: if peer subscribed
    }
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
  // async block(index) {
  //   const _values = []
  //   for (const peer of this.peers) {
  //     const value = await peer.request({type: 'block', index})
  //     console.log(value);
  //   }
  //
  // }
}
