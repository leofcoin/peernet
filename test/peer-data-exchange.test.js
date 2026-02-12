import test from 'node:test'
import assert from 'node:assert/strict'
import Peernet from '../exports/peernet.js'
import { createHash } from 'crypto'

// This test simulates two peers: one saves data, the other retrieves it

test('peer can save data and other peer can get it', async (t) => {
  const password = 'password'
  // Peer 1
  const peer1 = await new Peernet(
    {
      network: 'leofcoin:peach',
      stars: [],
      root: '.testnet-peer1',
      version: '1.0.0',
      storePrefix: 'test-peer1',
      autoStart: true
    },
    password
  )

  // Peer 2
  const peer2 = await new Peernet(
    {
      network: 'leofcoin:peach',
      stars: [],
      root: '.testnet-peer2',
      version: '1.0.0',
      storePrefix: 'test-peer2',
      autoStart: true
    },
    password
  )

  // Wait for both peers to be ready and connected
  await new Promise((resolve) => setTimeout(resolve, 2000))

  // Peer 1 saves data
  const testData = new TextEncoder().encode('shared-data')
  // Generate SHA-256 hash for the data
  const hash = createHash('sha256').update(testData).digest('hex')
  await peer1.put(hash, testData)

  // Wait for DHT propagation
  await new Promise((resolve) => setTimeout(resolve, 2000))

  // Peer 2 tries to get the data
  const received = await peer2.get(hash)
  assert.ok(received, 'Peer 2 should retrieve the data by hash')
  assert.equal(new TextDecoder().decode(received), 'shared-data')
})
