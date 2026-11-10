import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash as nodeHash } from 'node:crypto'
import { createHash } from '../src/browser-crypto.ts'

test('browser wallet SHA-256 matches Node across string, sliced bytes and incremental writes',()=>{
  const bytes=new Uint8Array([0,1,2,255,0])
  assert.deepEqual(createHash('sha256').update('wallet').update(bytes.subarray(1,4)).digest(),
    new Uint8Array(nodeHash('sha256').update('wallet').update(bytes.subarray(1,4)).digest()))
  assert.deepEqual(createHash('sha256').update(new ArrayBuffer(0)).digest(),new Uint8Array(nodeHash('sha256').digest()))
  assert.throws(()=>createHash('md5'),/Unsupported/)
})
