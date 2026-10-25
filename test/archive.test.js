import assert from 'node:assert/strict'
import test from 'node:test'
import Peernet, { PeernetArchiveMode } from '../exports/peernet.js'

const decoder = new TextDecoder()
const network = 'leofcoin:peach'

class MemoryStore {
  values = new Map()

  async has(key) {
    return this.values.has(key)
  }

  async get(key) {
    const value = this.values.get(key)
    if (!value) throw new DOMException('not found', 'NotFoundError')
    return value
  }

  async put(key, value) {
    this.values.set(key, Uint8Array.from(value))
  }

  async delete(key) {
    this.values.delete(key)
  }

  async keys() {
    return [...this.values.keys()]
  }
}

class ArchiveNetwork {
  subscribers = new Map()

  peer(id, selectedNetwork = network) {
    return {
      id,
      network: selectedNetwork,
      subscribe: async (topic, handler) => {
        const handlers = this.subscribers.get(topic) || new Set()
        handlers.add(handler)
        this.subscribers.set(topic, handlers)
        return () => handlers.delete(handler)
      },
      publish: async (topic, payload) => {
        for (const handler of this.subscribers.get(topic) || []) {
          queueMicrotask(() => handler(Uint8Array.from(payload)))
        }
      }
    }
  }
}

const verifyEnvelope = async (envelope) => envelope.signature === 'valid'
const verifyInboxRequest = async (request) => request.signature === 'valid'
const verifyReceipt = async (receipt, envelope) =>
  receipt.signature === 'valid' && receipt.messageId === envelope.id

function archiveFor(peernet, store) {
  return new PeernetArchiveMode({
    peernet,
    store,
    verifyEnvelope,
    verifyInboxRequest,
    verifyReceipt
  })
}

function waitForNetwork() {
  return new Promise((resolve) => setTimeout(resolve, 20))
}

test('Peernet exposes archive mode as a package API', () => {
  assert.equal(typeof PeernetArchiveMode, 'function')
  assert.equal(typeof Peernet.prototype.createArchiveMode, 'function')
})

test('archive opt-in and ciphertext storage are isolated by exact network version', async () => {
  const store = new MemoryStore()
  const networkBus = new ArchiveNetwork()
  const peach = archiveFor(networkBus.peer('peach-archive'), store)
  const mainnet = archiveFor(networkBus.peer('mainnet-archive', 'leofcoin:mainnet'), store)
  await peach.setEnabled(true)
  await peach.start({ account: 'archive-account', deviceId: 'archive-device' })
  await mainnet.start({ account: 'archive-account', deviceId: 'archive-device' })

  const sender = archiveFor(networkBus.peer('sender'), new MemoryStore())
  await sender.start({ account: 'sender-account', deviceId: 'sender-device' })
  await sender.send({
    id: 'message-1',
    network,
    recipientAccount: 'recipient-account',
    recipientDeviceId: 'recipient-device',
    ciphertext: 'opaque-ciphertext',
    signature: 'valid',
    timestamp: Date.now()
  })
  await waitForNetwork()

  assert.equal(peach.network, network)
  assert.equal(peach.enabled, true)
  assert.equal(peach.archiveCount, 1)
  assert.equal(mainnet.enabled, false)
  assert.equal(mainnet.archiveCount, 0)
  const archivedBytes = await store.get('peernet:archive:v1:leofcoin%3Apeach:archive:message-1')
  assert.equal(decoder.decode(archivedBytes).includes('opaque-ciphertext'), true)
  assert.equal(decoder.decode(archivedBytes).includes('plaintext'), false)
  const restoredPeach = archiveFor(networkBus.peer('restored-peach'), store)
  await restoredPeach.start({ account: 'archive-account', deviceId: 'archive-device' })
  assert.equal(restoredPeach.enabled, true)
  assert.equal(restoredPeach.archiveCount, 1)
  await peach.setEnabled(false)
  assert.equal(peach.archiveCount, 0)
  assert.equal(await store.has('peernet:archive:v1:leofcoin%3Apeach:archive:message-1'), false)
  assert.equal(mainnet.enabled, false)
  peach.stop()
  mainnet.stop()
  restoredPeach.stop()
  sender.stop()
})

test('signed inbox requests deliver archived ciphertext and verified receipts remove copies', async () => {
  const networkBus = new ArchiveNetwork()
  const archiveStore = new MemoryStore()
  const archive = archiveFor(networkBus.peer('archive'), archiveStore)
  const sender = archiveFor(networkBus.peer('sender'), new MemoryStore())
  const recipient = archiveFor(networkBus.peer('recipient'), new MemoryStore())
  const delivered = []
  recipient.onMessage(({ envelope }) => delivered.push(envelope))

  await archive.setEnabled(true)
  await archive.start({ account: 'archive-account', deviceId: 'archive-device' })
  await sender.start({ account: 'sender-account', deviceId: 'sender-device' })
  await sender.send({
    id: 'offline-message',
    network,
    recipientAccount: 'recipient-account',
    recipientDeviceId: 'recipient-device',
    ciphertext: 'encrypted-only',
    signature: 'valid',
    timestamp: Date.now()
  })
  await waitForNetwork()
  assert.equal(archive.archiveCount, 1)
  assert.deepEqual(delivered, [])

  await recipient.start({ account: 'recipient-account', deviceId: 'recipient-device' })
  await recipient.requestInbox({
    network,
    account: 'recipient-account',
    deviceId: 'recipient-device',
    timestamp: Date.now(),
    signature: 'valid'
  })
  await waitForNetwork()
  assert.equal(delivered.length, 1)
  assert.equal(delivered[0].ciphertext, 'encrypted-only')

  await recipient.acknowledge({
    network,
    messageId: 'offline-message',
    recipientAccount: 'recipient-account',
    recipientDeviceId: 'recipient-device',
    timestamp: Date.now(),
    signature: 'valid'
  })
  await waitForNetwork()
  assert.equal(archive.archiveCount, 0)
  assert.equal(sender.pendingCount, 0)
  archive.stop()
  sender.stop()
  recipient.stop()
})

test('archive mode rejects plaintext envelopes and invalid signature callbacks', async () => {
  const mode = archiveFor(new ArchiveNetwork().peer('archive'), new MemoryStore())
  await mode.setEnabled(true)
  await mode.start({ account: 'archive-account', deviceId: 'archive-device' })
  await assert.rejects(
    mode.send({
      id: 'plaintext',
      network,
      recipientAccount: 'recipient',
      recipientDeviceId: 'recipient-device',
      ciphertext: 'opaque',
      text: 'do not store me',
      signature: 'valid',
      timestamp: Date.now()
    }),
    /Plaintext message fields cannot be archived/
  )
  await assert.rejects(
    mode.send({
      id: 'bad-signature',
      network,
      recipientAccount: 'recipient',
      recipientDeviceId: 'recipient-device',
      ciphertext: 'opaque',
      signature: 'invalid',
      timestamp: Date.now()
    }),
    /signature verification failed/
  )
  mode.stop()
})

test('archive mode rejects ciphertext envelopes from another network version', async () => {
  const mode = archiveFor(new ArchiveNetwork().peer('archive'), new MemoryStore())
  await mode.start({ account: 'archive-account', deviceId: 'archive-device' })
  await assert.rejects(
    mode.send({
      id: 'wrong-network',
      network: 'leofcoin:mainnet',
      recipientAccount: 'recipient',
      recipientDeviceId: 'recipient-device',
      ciphertext: 'opaque',
      signature: 'valid',
      timestamp: Date.now()
    }),
    /network-scoped encrypted message envelope/
  )
  mode.stop()
})
