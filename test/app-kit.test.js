import test from 'node:test'
import assert from 'node:assert/strict'
import { PeernetAppKit, PeernetAppSettings, parseShareLink } from '../exports/app-kit.js'

class MemoryStorage {
  values = new Map()
  getItem(key) {
    return this.values.get(key) ?? null
  }
  setItem(key, value) {
    this.values.set(key, String(value))
  }
  removeItem(key) {
    this.values.delete(key)
  }
}

const collect = async (stream) => {
  const output = []
  for await (const chunk of stream) output.push(...chunk)
  return new Uint8Array(output)
}

const mockPeernet = () => {
  const objects = new Map()
  return {
    network: 'test:app-kit',
    objects,
    async broadcastStream(_path, stream) {
      const bytes = await collect(stream)
      const hash = `hash-${objects.size}`
      objects.set(hash, bytes)
      return hash
    },
    async downloadStream(hash) {
      const bytes = objects.get(hash)
      return new ReadableStream({
        start(controller) {
          for (let offset = 0; offset < bytes.length; offset += 7) controller.enqueue(bytes.slice(offset, offset + 7))
          controller.close()
        }
      })
    }
  }
}

test('app kit encrypts, links, decrypts, and saves without exposing plaintext', async () => {
  const peernet = mockPeernet()
  const storage = new MemoryStorage()
  const kit = new PeernetAppKit(peernet, { storage, quotaBytes: 1024 })
  const plain = new TextEncoder().encode('private peer-to-peer payload')
  const file = new Blob([plain], { type: 'text/plain' })
  Object.defineProperty(file, 'name', { value: 'secret.txt' })

  const share = await kit.shareEncrypted(file, { baseUrl: 'https://share.example/app', expiresIn: 60_000 })
  assert.match(share.url, /^https:\/\/share\.example\/app#peernet=/)
  assert.equal(parseShareLink(share.url).hash, share.hash)
  assert.equal(new TextDecoder().decode(peernet.objects.get(share.hash)).includes('private peer-to-peer payload'), false)

  const opened = await kit.open(share.url)
  assert.equal(opened.name, 'secret.txt')
  assert.deepEqual(await collect(await opened.stream()), plain)
  const saved = []
  await opened.save({ write: (chunk) => saved.push(...chunk) })
  assert.deepEqual(new Uint8Array(saved), plain)
  assert.equal(kit.usage().usedBytes, plain.length)
})

test('password shares reject missing and incorrect passwords', async () => {
  const kit = new PeernetAppKit(mockPeernet())
  const file = new Blob(['password protected'])
  Object.defineProperty(file, 'name', { value: 'protected.txt' })
  const share = await kit.shareEncrypted(file, { password: 'correct horse battery staple' })
  assert.equal(share.capability.key, undefined)
  await assert.rejects(kit.open(share.url), /requires a password/)
  await assert.rejects(kit.open(share.url, { password: 'wrong' }), /Incorrect password/)
  const opened = await kit.open(share.url, { password: 'correct horse battery staple' })
  assert.equal(new TextDecoder().decode(await collect(await opened.stream())), 'password protected')
})

test('recipient wrapping, expiry, quota, and settings policies are enforced', async () => {
  const storage = new MemoryStorage()
  const peernet = mockPeernet()
  const kit = new PeernetAppKit(peernet, { storage, quotaBytes: 4 })
  const oversized = new Blob(['12345'])
  await assert.rejects(kit.shareEncrypted(oversized), /quota/)

  const settings = new PeernetAppSettings({ storage, defaults: { theme: 'dark', replicas: 2 } })
  assert.deepEqual(settings.update({ replicas: 3 }), { theme: 'dark', replicas: 3 })
  assert.deepEqual(settings.reset(), { theme: 'dark', replicas: 2 })

  const unrestricted = new PeernetAppKit(peernet)
  const file = new Blob(['abc'])
  Object.defineProperty(file, 'name', { value: 'recipient.txt' })
  let rawKey
  const share = await unrestricted.shareEncrypted(file, {
    recipients: ['alice'],
    wrapKey: async (_recipient, key) => {
      rawKey = key.slice()
      return 'wrapped-for-alice'
    }
  })
  await assert.rejects(unrestricted.open(share.url, { recipient: 'bob', unwrapKey: async () => rawKey }), /not authorized/)
  const opened = await unrestricted.open(share.url, {
    recipient: 'alice',
    unwrapKey: async (_recipient, wrapped) => {
      assert.equal(wrapped, 'wrapped-for-alice')
      return rawKey
    }
  })
  assert.equal(new TextDecoder().decode(await collect(await opened.stream())), 'abc')

  const expired = { ...share.capability, policy: { expiresAt: Date.now() - 1 } }
  await assert.rejects(unrestricted.open(expired, { recipient: 'alice', unwrapKey: async () => rawKey }), /expired/)

  const limitedStorage = new MemoryStorage()
  const limited = new PeernetAppKit(peernet, { storage: limitedStorage })
  const limitedShare = await limited.shareEncrypted(file, { maxDownloads: 1 })
  const firstOpen = await limited.open(limitedShare.url)
  await collect(await firstOpen.stream())
  const secondOpen = await limited.open(limitedShare.url)
  await assert.rejects(secondOpen.stream(), /download limit/)
})
