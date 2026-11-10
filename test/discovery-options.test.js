import test from 'node:test'
import assert from 'node:assert/strict'
import { discoveryOptions, createNetwork, PEERNET_APP_ID } from '../src/discovery-options.ts'

test('filesharing discovery automatically includes network and wire version without a chain ID',()=>{
  const options={network:createNetwork(PEERNET_APP_ID,'public'),protocolVersion:'file-wire-1',autoStart:false}
  const result=discoveryOptions(options)
  assert.deepEqual(result,{network:options.network,protocolVersion:'file-wire-1'})
  assert.equal(Object.hasOwn(result,'chainId'),false)
  assert.deepEqual(options,{network:createNetwork(PEERNET_APP_ID,'public'),protocolVersion:'file-wire-1',autoStart:false})
  assert.ok(Object.isFrozen(result))
})
test('stable app IDs, network names, wire versions and optional genesis separate independently',()=>{
  const network=createNetwork(PEERNET_APP_ID,'public')
  assert.deepEqual(discoveryOptions({network}),{network,protocolVersion:'v1'})
  assert.deepEqual(discoveryOptions({network,protocolVersion:'wire-2',chainId:'lfc:test'}),{network,protocolVersion:'wire-2',chainId:'lfc:test'})
  assert.notDeepEqual(discoveryOptions({network}),discoveryOptions({network:createNetwork('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','public')}))
  assert.equal(discoveryOptions({}).network,discoveryOptions({}).network)
  assert.equal(discoveryOptions({network,protocolVersion:'v2'}).network,network,'wire upgrades must not generate a new app ID')
})
test('conflicting labels and empty IDs fail instead of silently using an unsafe fallback',()=>{
  for(const options of [{network:'leofcoin:peach'},{version:'one'}, {networkVersion:'mainnet'},
    {chainId:null},{chainId:''},{protocol:''},{network:'bad network'},{discoveryNetwork:undefined}, {protocolVersion:''}])assert.throws(()=>discoveryOptions(options))
})
