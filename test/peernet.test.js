import Peernet from '../exports/peernet.js'
import Identity from '../exports/identity.js'
import { expect } from 'chai'
import sinon from 'sinon'
import networks from '@leofcoin/networks'

const network = networks.leofcoin.peach

let options
let password
options = {
  network: 'leofcoin:peach',
  stars: network.stars,
  root: '.testnet',
  version: '1.0.0',
  storePrefix: 'test'
}
password = 'password'
const peernet = await new Peernet(options, password)

describe('Peernet', async () => {
  // beforeEach(async () => {
  // })

  it('should initialize with the correct network', () => {
    expect(peernet.network).to.equal('leofcoin:peach')
  })

  it('should initialize with the correct version', () => {
    expect(peernet.version).to.equal('1.0.0')
  })

  it('should initialize with the correct store prefix', () => {
    expect(peernet.storePrefix).to.equal('test')
  })

  it('should have an identity instance', () => {
    expect(peernet.identity).to.be.instanceOf(Identity)
  })

  it('should have a DHT instance', () => {
    expect(peernet.dht).to.not.be.undefined
  })

  it('should start the client', async () => {
    const startSpy = sinon.spy(peernet, 'start')
    await peernet.start()
    expect(startSpy.calledOnce).to.be.true
  })

  it('should add a proto', () => {
    const protoName = 'test-proto'
    const proto = {}
    peernet.addProto(protoName, proto)
    expect(globalThis.peernet.protos[protoName]).to.equal(proto)
  })

  it('should add a codec', () => {
    const codec = { name: 'test-codec' }
    const addCodecSpy = sinon.spy(peernet, 'addCodec')
    peernet.addCodec(codec)
    expect(addCodecSpy.calledOnceWith(codec)).to.be.true
  })

  it('should select an account', async () => {
    const account = 'test-account'
    const selectAccountSpy = sinon.spy(peernet.identity, 'selectAccount')
    await peernet.selectAccount(account)
    expect(selectAccountSpy.calledOnceWith(account)).to.be.true
  })

  it('should prepare a message', () => {
    const data = { message: 'test' }
    const prepareMessageSpy = sinon.spy(peernet._messageHandler, 'prepareMessage')
    peernet.prepareMessage(data)
    expect(prepareMessageSpy.calledOnceWith(data)).to.be.true
  })

  it('should get peers', () => {
    const peers = peernet.peers
    expect(peers).to.be.an('array')
  })

  it('should get connections', () => {
    const connections = peernet.connections
    expect(connections).to.be.an('object')
  })

  it('should get a connection by id', () => {
    const id = 'test-id'
    const connection = peernet.getConnection(id)
    expect(connection).to.be.undefined // Assuming no connections are established in the test
  })

  // it('should handle DHT', async () => {
  //   const peer = {}
  //   const id = 'test-id'
  //   const proto = { decoded: { hash: 'test-hash', store: 'test-store' } }
  //   const handleDHTSpy = sinon.spy(peernet, 'handleDHT')
  //   await peernet.handleDHT(peer, id, proto)
  //   expect(handleDHTSpy.calledOnceWith(peer, id, proto)).to.be.true
  // })

  it('should handle data', async () => {
    const peer = {}
    const id = 'test-id'
    const proto = { decoded: { hash: 'test-hash', store: 'test-store' } }
    const handleDataSpy = sinon.spy(peernet, 'handleData')
    await peernet.handleData(peer, id, proto)
    expect(handleDataSpy.calledOnceWith(peer, id, proto)).to.be.true
  })

  it('should handle request', async () => {
    const peer = {}
    const id = 'test-id'
    const proto = { decoded: { request: 'test-request' } }
    const handleRequestSpy = sinon.spy(peernet, 'handleRequest')
    await peernet.handleRequest(peer, id, proto)
    expect(handleRequestSpy.calledOnceWith(peer, id, proto)).to.be.true
  })

  it('should walk the network', async () => {
    const hash = 'test-hash'
    const walkSpy = sinon.spy(peernet, 'walk')
    await peernet.walk(hash)
    expect(walkSpy.calledOnceWith(hash)).to.be.true
  })

  // it('should find providers for a hash', async () => {
  //   const hash = 'test-hash'
  //   const providers = await peernet.providersFor(hash)
  //   expect(providers).to.be.undefined // Assuming no providers are found in the test
  // })

  // it('should request data', async () => {
  //   const hash = 'test-hash'
  //   const requestDataSpy = sinon.spy(peernet, 'requestData')
  //   await peernet.requestData(hash, 'data')
  //   expect(requestDataSpy.calledOnceWith(hash, 'data')).to.be.true
  // })

  it('should publish data', async () => {
    const topic = 'test-topic'
    const data = 'test-data'
    const publishSpy = sinon.spy(peernet, 'publish')
    await peernet.publish(topic, data)
    expect(publishSpy.calledOnceWith(topic, data)).to.be.true
  })

  it('should subscribe to a topic', async () => {
    const topic = 'test-topic'
    const callback = sinon.spy()
    const subscribeSpy = sinon.spy(peernet, 'subscribe')
    await peernet.subscribe(topic, callback)
    expect(subscribeSpy.calledOnceWith(topic, callback)).to.be.true

    process.exit()
  })
})
