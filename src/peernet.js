import Client from './client'
import LeofcoinStorage from './../node_modules/@leofcoin/storage/src/level.js'
import {decode} from 'bs32'
import MultiWallet from '@leofcoin/multi-wallet'
import fetch from 'node-fetch'
import http from './http/http.js'
import httpClient from './http/client/client.js'
import LeofcoinStorageClient from './http/client/storage.js'
import PeernetMessage from './messages/peernet.js'
import DHTMessage from './messages/dht.js'
import DHTMessageResponse from './messages/dht-response.js'
import DataMessage from './messages/data.js'
import DataMessageResponse from './messages/data-response.js'
import Codec from './codec/codec.js'
import Hash from './hash/hash.js'
import DHT from './dht/dht.js'
import {debug} from './utils.js'

globalThis.leofcoin = globalThis.leofcoin || {}
globalThis.peernet = globalThis.peernet || {}

let hasDaemon = false;
const https = (() => {
  if (!globalThis.location) return false;
  return Boolean(globalThis.location.protocol === 'https:')
})();

export default class Peernet {
  constructor(options = {}) {
    this.network = options.network || 'leofcoin'
    const parts = this.network.split(':')
    
    if (!options.root) {
      if (parts[1])  options.root = `.${parts[0]}/peernet/${parts[1]}`
      else options.root = `.${this.network}/peernet`
    }
    
    // peernetDHT aka closesPeer by coordinates
    this.dht = new DHT()
    
    this._init(options)
    
    this.peers = []
    this.protos = {
      'peernet-message': PeernetMessage,
      'peernet-dht': DHTMessage,
      'peernet-dht-response': DHTMessageResponse,
      'peernet-data': DataMessage,
      'peernet-data-response': DataMessageResponse
    }
  }
  async hasDaemon() {
    try {
      let response = await fetch('http://127.0.0.1:1000/api/version')
      response = await response.json()
      return Boolean(response.client === '@peernet/api/http')
    } catch (e) {
      return false
    }
  }
  
  async environment() {
    const _navigator = globalThis.navigator
    if (!_navigator) {
      return 'node'
    } else if (_navigator && /electron/i.test(_navigator.userAgent)) {
      return 'electron'
    } else {
      return 'browser'
    }
  }

  async target() {
    let daemon = false
    const environment = await this.environment()
    if (!https) daemon = await this.hasDaemon()

    return { daemon, environment }
  }
  
  async _init(options) {
    const { daemon, environment } = await this.target()
    if (daemon) {
      globalThis.peernet.client = await httpClient({protocol: 'peernet-v0.1.0', host: '127.0.0.1', port: 1000})
      globalThis.accountStore = globalThis.accountStore || await new LeofcoinStorageClient('lfc-account', options.root)
      globalThis.walletStore = globalThis.walletStore || await new LeofcoinStorageClient('lfc-wallet', options.root)
      globalThis.blockStore = globalThis.blockStore || await new LeofcoinStorageClient('lfc-block', options.root)
    } else {
      globalThis.accountStore = globalThis.accountStore || new LeofcoinStorage('lfc-account', options.root)
      globalThis.walletStore = globalThis.walletStore || new LeofcoinStorage('lfc-wallet', options.root)
      globalThis.blockStore = globalThis.blockStore || new LeofcoinStorage('lfc-block', options.root)
      
      if (environment !== 'browser') http()
    }
    
    const { walletId } = await accountStore.get('public')
    // peernet id
    options.id = Buffer.from(walletId.slice(0, 32))
    this.id = walletId
    this.peerId = options.id
    
    pubsub.subscribe('peer:connected', peer => {
      peer.on('data', message => this.protoHandler(message, peer))
      this.peers.push(peer)
    })
    this.client = new Client(options)
  }
  
  protoFor(data) {
    if (!Buffer.isBuffer(data)) data = Buffer.from(data)
    const codec = new Codec(data)
    if (!codec.name) throw new Error('proto not found')
    const Proto = this.protos[codec.name]
    return new Proto(data)
  }
  
  async protoHandler(message, peer) {
    message = JSON.parse(message.toString())
    const id = message.id
    message = new PeernetMessage(Buffer.from(message.data))
    
    const codec = new Codec(message.decoded.data)
    let Proto = this.protos[codec.name]
    
    let proto = new Proto(message.decoded.data)
    if (proto.name === 'peernet-dht') {
      const hash = proto.decoded.hash
      const has = await this.has(hash)      
      const data = new DHTMessageResponse({hash, has})
      
      const message = {
        from: this.client.id,
        to: Buffer.from(peer.id),
        data: data.encoded
      }
      
      const signature = await this.hashAndSignMessage(message)
      
      const node = new PeernetMessage({
        ...message,
        signature
      })
      
      peer.write(Buffer.from(JSON.stringify({id, data: node.encoded})))
    } else if (proto.name === 'peernet-data') {
      const hash = proto.decoded.hash
      const has = await blockStore.has(hash)
      if (has) {
        let data = await blockStore.get(hash)
        data = new DataMessageResponse({hash, data: Buffer.from(data)})
        const message = {
          from: this.client.id,
          to: Buffer.from(peer.id),
          data: data.encoded
        }
        const signature = await this.hashAndSignMessage(message)
        
        const node = new PeernetMessage({
          ...message,
          signature
        })
        
        peer.write(Buffer.from(JSON.stringify({id, data: node.encoded})))
      }
    }
    // PeernetDHTMessage()
    // PeernetDHTMessageResponse
    // pubsub.publish('socket-data', { message, peer })
  }
  
  /**
   * performs a walk and resolves first encounter
   */
  async walk(hash) {
    if (!hash) throw 'hash expected, received undefined'
    const data = new DHTMessage({hash})
    for (const peer of this.peers) {
      const message = {
        from: this.client.id,
        to: Buffer.from(peer.id),
        data: data.encoded
      }
      const hasher = new Hash(message, { name: 'peernet-message' })
      const identity = await walletStore.get('identity')
      
      const wallet = new MultiWallet(this.network)
      wallet.import(identity.multiWIF)
      const signature = wallet.sign(hasher.hash.slice(0, 32))
      
    
      const node = new PeernetMessage({
        ...message,
        signature
      })
      
      const result = await peer.request(node.encoded)
      
      let proto = this.protoFor(result.data)
      
      if (proto.name !== 'peernet-message') throw new Error('Nodes/Data should be send encapsulated by peernet-message')
      const from = proto.decoded.from
      proto = this.protoFor(proto.decoded.data)
      
      if (proto.name !== 'peernet-dht-response') throw new Error(`Routing error: Received proto ${proto.name} expected peernet-dht-response`)

      const peerInfo = {
        family: peer.connection.remoteFamily || peer.connection.localFamily,
        address: peer.connection.remoteAddress || peer.connection.localAddress,
        port: peer.connection.remotePort || peer.connection.localPort,
        id: from
      }
      
      if (proto.decoded.has) this.dht.addProvider(peerInfo, proto.decoded.hash)
    }
  }
  
  
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
  
  async get(hash) {
    debug(`get ${hash}`)
    let data = await blockStore.has(hash)
    if (data) return await blockStore.get(hash)
    let providers = await this.providersFor(hash)
    if (!providers || providers.size === 0) throw `nothing found for ${hash}`
    debug(`found ${providers.size} for ${hash}`)
    
    // get closest peer on earth
    const closestPeer = await this.dht.closestPeer(providers)
    
    // get peer instance by id
    const id = closestPeer.id.toString()
    const closest = this.peers.filter((peer) => {
      if (peer.id.toString() === id) return peer
    })
    
    data = new DataMessage({hash})
    
    const message = {
      from: this.client.id,
      to: Buffer.from(id),
      data: data.encoded
    }
    
    const signature = await this.hashAndSignMessage(message)
    
    const node = new PeernetMessage({
      ...message,
      signature
    })
        
    data = await closest[0].request(node.encoded)
    let proto = this.protoFor(Buffer.from(data.data))
    proto = this.protoFor(proto.decoded.data)
    this.put(hash, proto.decoded.data)
    return proto.decoded.data
  }
  
  async put(hash, data) {
    return await blockStore.put(hash, data)
  }
  
  async has(hash) {
    return await blockStore.has(hash)
  }
  
  async hashAndSignMessage(message) {
    const hasher = new Hash(message, { name: 'peernet-message' })
    const identity = await walletStore.get('identity')
    
    const wallet = new MultiWallet(this.network)
    wallet.import(identity.multiWIF)
    return wallet.sign(hasher.hash.slice(0, 32))
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