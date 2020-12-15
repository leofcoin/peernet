import swarm from '@geut/discovery-swarm-webrtc'
import wrtc from 'wrtc'
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

    this.id = options.id

    // try {
    //   this.sw = swarm({
    //     id: options.id,
    //     bootstrap: ['wss://discovery-swarm.herokuapp.com', 'ws://localhost:4000'],
    //     simplePeer: {
    //       wrtc,
    //     },
    //   })
    // } catch (e) {
    //   console.warn(e);
    // }

    this.topic = Buffer.from(sha256('peernet-v0.1.0').toString())
    const trackers = [
      'wss://tracker.openwebtorrent.com',
      'wss://tracker.sloppyta.co:443/announce',
    ]
    this.p2p = new P2P(trackers, this.topic.slice(0, 20))
    this.p2p.on('peerconnect', (peer) => {
      peer = new PeernetPeer(peer.id, peer)
      pubsub.publish('peer:connected', peer)
      connections.set(peer.id, peer)
    })

    this.p2p.on('peerclose', (peer) => {
      pubsub.publish('peer:disconnected', peer)
      connections.delete(peer.id)
    })

    this.p2p.start()


    // this.sw.join(this.topic.slice(0, 32))
    //
    // const arrayOfPeers = this.sw.getPeers()
    //
    // this.sw.on('connection', async (connection, info) => {
    //   // connected
    //   const id = info.id.toString()
    //   if (id === this.id.toString()) return
    //
    //   const channel = connection.channelName
    //   let channels = [channel]
    //   let peer
    //   if (connections.has(id)) {
    //     const value = connections.get(id)
    //     const _channels = value.channels
    //     channels = [...channels, ..._channels]
    //     peer = value.peer
    //   } else {
    //     peer = new PeernetPeer(id, connection)
    //     pubsub.publish('peer:connected', peer)
    //   }
    //   connections.set(id, {channels, peer})
    //   // connection.on('data', (data) => console.log({data}))
    //   // connection.write('peerId')
    // });
    //
    // this.sw.on('candidates-updated', async (channel, candidates) => {
    //   // TODO: Channels ...
    //   for (const candidate of candidates) {
    //     const id = candidate.toString()
    //     let channels = [channel]
    //     if (id === this.id.toString()) return
    //
    //     if (!connections.has(id)) {
    //       try {
    //         const connection = await this.sw.connect(channel, candidate)
    //         const peer = new PeernetPeer(id, connection)
    //         connections.set(id, {channels, peer})
    //         if (recentConnections.has(id)) {
    //           setTimeout(() => {
    //             pubsub.publish('peer:connected', peer)
    //           }, 1000)
    //         } else {
    //           pubsub.publish('peer:connected', peer)
    //         }
    //       } catch (e) {
    //         console.warn(e);
    //       }
    //     } else {
    //       const value = connections.get(id)
    //       const _channels = value.channels
    //       channels = [...channels, ..._channels]
    //       connections.set(id, {channels, peer: value.peer})
    //     }
    //   }
    // })
    //
    // this.sw.on('connection-closed', (connection, info) => {
    //   if (!recentConnections.has(info.id.toString())) {
    //     recentConnections.set(info.id.toString(), new Date().getTime())
    //   }
    //   if (connections.has(info.id.toString())) connections.delete(info.id.toString())
    // })
    //
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
