import { sha256 } from '@noble/hashes/sha2.js'

// multi-signature needs this synchronous SHA-256 adapter in browsers.
// Never substitute a non-cryptographic hash or weaken wallet signatures.
export function createHash(algorithm: string) {
  if (algorithm !== 'sha256') throw new Error(`Unsupported browser hash: ${algorithm}`)
  const hash = sha256.create()
  return {
    update(value: string | ArrayBuffer | ArrayBufferView) {
      hash.update(typeof value === 'string' ? new TextEncoder().encode(value) :
        ArrayBuffer.isView(value) ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength) : new Uint8Array(value))
      return this
    },
    digest() { return hash.digest() }
  }
}
