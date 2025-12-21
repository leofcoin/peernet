import test from 'node:test'
import assert from 'node:assert/strict'

import Peernet from '../exports/peernet.js'
import Identity from '../exports/identity.js'

const options = {
  network: 'leofcoin:peach',
  stars: [],
  root: '.testnet',
  version: '1.0.0',
  storePrefix: 'test',
  autoStart: false
}

const password = 'password'
const peernet = await new Peernet(options, password)

test('initializes with provided options', () => {
  assert.equal(peernet.network, options.network)
  assert.equal(peernet.version, options.version)
  assert.equal(peernet.storePrefix, options.storePrefix)
})

test('exposes identity instance', () => {
  assert.ok(peernet.identity instanceof Identity)
})

test('has a DHT instance', () => {
  assert.ok(peernet.dht)
})

test('returns peers and connections safely', () => {
  assert.deepEqual(peernet.peers, [])
  assert.deepEqual(peernet.connections, {})
  assert.equal(peernet.getConnection('missing'), undefined)
})

test('provides callable helpers', () => {
  assert.equal(typeof peernet.addProto, 'function')
  assert.equal(typeof peernet.addCodec, 'function')
  assert.equal(typeof peernet.prepareMessage, 'function')
  assert.equal(typeof peernet.publish, 'function')
  assert.equal(typeof peernet.subscribe, 'function')
})
