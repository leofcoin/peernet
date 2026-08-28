import test from 'node:test'
import assert from 'node:assert/strict'
import { FileTransfer } from '../exports/peernet.js'

const bytes = (value) => new TextEncoder().encode(JSON.stringify(value))
const decode = async (value) => JSON.parse(new TextDecoder().decode(value))

test('chunk transfer pauses, resumes, reassembles, and reports progress', async () => {
  const objects = new Map([
    ['manifest', bytes({ chunked: true, size: 6, links: [{ hash: 'a', size: 2 }, { hash: 'b', size: 2 }, { hash: 'c', size: 2 }] })],
    ['a', bytes({ content: [1, 2] })],
    ['b', bytes({ content: [3, 4] })],
    ['c', bytes({ content: [5, 6] })]
  ])
  const fetched = []
  const transfer = new FileTransfer({
    hash: 'manifest',
    fetch: async (hash) => {
      fetched.push(hash)
      return objects.get(hash)
    },
    decode: async (encoded) => {
      const value = await decode(encoded)
      if (value.content) value.content = new Uint8Array(value.content)
      return value
    },
    verify: async (_encoded, hash) => objects.has(hash)
  })

  transfer.pause()
  transfer.start()
  transfer.pause()
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.deepEqual(fetched, ['manifest'])
  assert.equal(transfer.state, 'paused')

  transfer.resume()
  assert.deepEqual(await transfer.result, new Uint8Array([1, 2, 3, 4, 5, 6]))
  assert.equal(transfer.state, 'completed')
  assert.equal(transfer.progress.completedChunks, 3)
  assert.equal(transfer.progress.transferredBytes, 6)
})

test('chunk transfer rejects failed integrity checks', async () => {
  const transfer = new FileTransfer({
    hash: 'bad',
    fetch: async () => bytes({ content: [1] }),
    decode,
    verify: async () => false
  }).start()

  await assert.rejects(transfer.result, /Manifest hash mismatch/)
  assert.equal(transfer.state, 'failed')
})

test('chunk transfer pipelines up to the configured concurrency', async () => {
  const links = Array.from({ length: 8 }, (_, index) => ({ hash: `chunk-${index}`, size: 1 }))
  let active = 0
  let maximumActive = 0
  const transfer = new FileTransfer({
    hash: 'manifest',
    concurrency: 4,
    fetch: async (hash) => {
      if (hash === 'manifest') return bytes({ chunked: true, size: 8, links })
      active += 1
      maximumActive = Math.max(maximumActive, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active -= 1
      return bytes({ content: [Number(hash.split('-')[1])] })
    },
    decode: async (encoded) => {
      const value = await decode(encoded)
      if (value.content) value.content = new Uint8Array(value.content)
      return value
    },
    verify: async () => true
  }).start()

  assert.deepEqual(await transfer.result, new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]))
  assert.equal(maximumActive, 4)
})
