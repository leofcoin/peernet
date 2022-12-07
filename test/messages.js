import test from 'tape'
import Node from './../dist/commonjs/dht-response.js'

const responseHash = 'cqbigjfvm5mizik7ke3v6lyhoahecqiwergnl3cytarf5bd2qvqase'

const block = '4lmacqas6kpnmvehxpmlvsndgydw5i46mf2pgnaub72eug63dozkw4oqxhk3fazbhkguvlhslcaeqm5jtwghxdk5nvmuakrs7yi2gl6xqmmmw';
const itx = '5hmacqb6ao252jmbhkhu5isr4yua3jnkhgb5ejjbiomrlzglwarlb777wq7aw5nfz5m4pubx5uffaxp2cqc4ckrh4xirss4nkujvcjbnmomtm';
const dht = '5demcay'

const message = '4xnmcay'
const data = '4hemcay'
globalThis.peernet = {
  codecs: {}
}
test('peernet message dht-response', tape => {
  tape.plan(4)
  const n = new Node({ hash: 'hello', has: true })
  console.log(n.hash);
  const node = new Node(n.encoded)
  const node2 = new Node(node.encoded)

  tape.equal(node.name, 'peernet-dht-response', `name from encoded is valid ${node.name}`)
  tape.equal(node.name, node2.name, `decoded name is valid ${node.name}`)
  tape.equal(node.hash, responseHash, `hash from encoded is valid ${node.hash}`)
  tape.equal(node.hash, node2.hash, `decoded hash is valid ${node.hash}`)
})
