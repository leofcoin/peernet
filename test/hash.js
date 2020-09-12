const test = require('tape')
const Node = require('./../dist/hash/hash.js')

const message = '4xnmcay'

test('peernet message dht-response', tape => {
  tape.plan(2)

  const node = new Node(response)
  const node2 = new Node(node.encoded)
  console.log(node2.decoded.has);
  tape.equal(node.name, 'peernet-dht-response', `name from encoded is valid ${node.name}`)
  tape.equal(node.name, node2.name, `decoded name is valid ${node.name}`)
})