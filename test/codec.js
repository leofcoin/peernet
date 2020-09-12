const test = require('tape')
const Codec = require('./../dist/codec.js')

const block = '4lmacqas6kpnmvehxpmlvsndgydw5i46mf2pgnaub72eug63dozkw4oqxhk3fazbhkguvlhslcaeqm5jtwghxdk5nvmuakrs7yi2gl6xqmmmw';
const itx = '5hmacqb6ao252jmbhkhu5isr4yua3jnkhgb5ejjbiomrlzglwarlb777wq7aw5nfz5m4pubx5uffaxp2cqc4ckrh4xirss4nkujvcjbnmomtm';
const dht = '5demcay'
const message = '4xnmcay'
const data = '4hemcay'

test('peernet dht codec', tape => {
  tape.plan(2)

  const codec = new Codec(dht)
  const codec2 = new Codec(codec.encoded)
  tape.equal(codec.name, 'peernet-dht', `name from encoded is valid ${codec.name}`)
  tape.equal(codec.name, codec2.name, `decoded name is valid ${codec.name}`)
})

test('peernet message codec', tape => {
  tape.plan(2)

  const codec = new Codec(message)
  const codec2 = new Codec(codec.encoded)
  tape.equal(codec.name, 'peernet-message', `name from encoded is valid ${codec.name}`)
  tape.equal(codec.name, codec2.name, `decoded name is valid ${codec.name}`)
})

test('peernet data codec', tape => {
  tape.plan(2)

  const codec = new Codec(data)
  const codec2 = new Codec(codec.encoded)
  tape.equal(codec.name, 'peernet-data', `name from encoded is valid ${codec.name}`)
  tape.equal(codec.name, codec2.name, `decoded name is valid ${codec.name}`)
})

test('leofcoin block codec', tape => {
  tape.plan(2)
  
  const codec = new Codec(block)
  const codec2 = new Codec(codec.encoded)
  tape.equal(codec.name, 'leofcoin-block', `name from encoded is valid ${codec.name}`)
  tape.equal(codec.name, codec2.name, `decoded name is valid ${codec.name}`)
})

test('leofcoin itx codec', tape => {
  tape.plan(2)
  
  const codec = new Codec(itx)
    
  const codec2 = new Codec(codec.encoded)
  tape.equal(codec.name, 'leofcoin-itx', `name from encoded is valid ${codec.name}`)
  tape.equal(codec.name, codec2.name, `decoded name is valid ${codec.name}`)
})