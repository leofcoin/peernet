import test from 'node:test'
import assert from 'node:assert/strict'
import Peernet from '../exports/peernet.js'

test('peer can save (put) and retrieve (get) PeernetFile messages', async (t) => {
  const password = 'password'

  // Peer 1
  const peer1 = await new Peernet(
    {
      network: 'leofcoin:peach',
      stars: [],
      root: '.testnet-file-peer1',
      version: '1.0.0',
      storePrefix: 'test-file-peer1',
      autoStart: true
    },
    password
  )

  // Peer 2
  const peer2 = await new Peernet(
    {
      network: 'leofcoin:peach',
      stars: [],
      root: '.testnet-file-peer2',
      version: '1.0.0',
      storePrefix: 'test-file-peer2',
      autoStart: true
    },
    password
  )

  // Wait for peers to connect
  await new Promise((resolve) => setTimeout(resolve, 2000))

  // Access the proto class from the global object (populated by Peernet)
  const PeernetFile = globalThis.peernet.protos['peernet-file']
  assert.ok(PeernetFile, 'PeernetFile proto should be available')

  // Create a file message
  const fileContent = `${Date.now()} - Hello, this is a test file content!`
  const fileData = {
    path: '/hello.txt',
    content: new TextEncoder().encode(fileContent)
  }

  const fileMsg = new PeernetFile(fileData)

  // Get hash and encoded data
  // Note: hash might be a function
  const hash = await fileMsg.hash()
  const encoded = fileMsg.encoded

  assert.ok(hash, 'File message should have a hash')
  assert.ok(encoded, 'File message should have encoded data')

  // Peer 1 puts the file message
  await peer1.put(hash, encoded)

  // Wait for propagation
  await new Promise((resolve) => setTimeout(resolve, 2000))

  // Peer 2 gets the file message
  const retrievedEncoded = await peer2.get(hash)

  assert.ok(retrievedEncoded, 'Peer 2 should be able to retrieve the file message')

  // Decode and verify
  const retrievedMsg = new PeernetFile(retrievedEncoded)
  const decodedContent = new TextDecoder().decode(retrievedMsg.decoded.content)

  assert.equal(decodedContent, fileContent, 'Retrieved content should match original')
  assert.equal(retrievedMsg.decoded.path, fileData.path, 'Retrieved path should match original')

  // Cleanup (if stop methods existed, checking if specific teardown is needed)
  // peer1.close() // or similar if available
})
