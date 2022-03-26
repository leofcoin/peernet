import Pubsub from '@vandeurenglenn/little-pubsub'
import PeernetPeer from './peer.js'
import sha256 from 'crypto-js/sha256'

import P2P from 'p2pt'


/**
 * Array of peers
 * @type {Array}
 * @property {PeernetPeer} peer Instance of Peer
 */
globalThis.connections = new Map()
globalThis.recentConnections = new Map()
globalThis.pubsub = globalThis.pubsub || new Pubsub({verbose: false})

export default class PeernetClient {
  constructor(options = {}) {
    if (!options.id) options.id = Buffer.from('00000000000000000000000000000000')
    if (!options.networkVersion) options.networkVersion = 'v0.1.0'
    if (!options.networkName) options.networkName = 'peernet'
    this.id = options.id

    this.topic = Buffer.from(sha256(`${options.networkName}-${options.networkVersion}`).toString())

    const trackers = [
      'wss://star.leofcoin.org',
      'wss://tracker.openwebtorrent.com',
      // 'wss://tracker.sloppyta.co:443/announce',
    ]
    this.p2p = new P2P(trackers, this.topic.slice(0, 20))
    this.p2p.on('peerconnect', (peer) => {
      peer = new PeernetPeer(peer.id, peer)
      connections.set(peer.id, peer)
      pubsub.publish('peer:discovered', peer)
    })

    this.p2p.on('peerclose', (peer) => {
      // TODO: close peernetPeer
      const peernetPeer = connections.get(peer.id)
      if (peernetPeer) {
        peernetPeer.close()
      }
      connections.delete(peer.id)
      pubsub.publish('peer:disconnected', peer)
    })

    this.p2p.start()

    if (globalThis.process) {
      process.on('SIGINT', async () => {
        console.log('Caught interrupt signal')
        this.close()
        setTimeout(async () => {
          process.exit();
        }, 100);
      })
    } else {
      globalThis.onbeforeunload = () => {
        this.close()
      }
    }
    //
    // this.sw.on('close', () => {
    // })
  }

  close() {
    return this.p2p.destroy()
  }

  _peers() {
    return this.p2p.getPeers()
  }
}
