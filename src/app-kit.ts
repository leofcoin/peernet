import { ByteSink, ByteSource, asAsyncBytes, writeFileStream } from './file-stream.js'

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()
const FRAME_HEADER_SIZE = 16
const DEFAULT_PBKDF2_ITERATIONS = 250_000

export type AppKitProgress = {
  transferredBytes: number
  totalBytes?: number
  completedChunks: number
  totalChunks?: number
}

export type CapabilityPolicy = {
  expiresAt?: number
  maxDownloads?: number
  recipients?: string[]
}

export type ShareCapability = {
  version: 1
  network?: string
  hash: string
  name: string
  size?: number
  mimeType?: string
  policy?: CapabilityPolicy
  key?: string
  password?: {
    salt: string
    iv: string
    wrappedKey: string
    iterations: number
  }
  recipientKeys?: Record<string, string>
}

export type AppKitStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type AppKitPeernet = {
  network?: string
  broadcastStream(
    path: string,
    source: ByteSource,
    options?: { signal?: AbortSignal; onProgress?: (progress: AppKitProgress) => void }
  ): Promise<string>
  downloadStream(
    hash: string,
    options?: { pin?: boolean; signal?: AbortSignal; onProgress?: (progress: AppKitProgress) => void }
  ): Promise<ReadableStream<Uint8Array>>
  unpinFile?(hash: string): Promise<void>
}

export type EncryptedShare = {
  hash: string
  url: string
  capability: ShareCapability
  toQrDataUrl(options?: { width?: number; margin?: number }): Promise<string>
}

export type OpenedShare = {
  hash: string
  name: string
  size?: number
  mimeType?: string
  policy?: CapabilityPolicy
  stream(options?: { pin?: boolean; signal?: AbortSignal; onProgress?: (progress: AppKitProgress) => void }): Promise<ReadableStream<Uint8Array>>
  save(
    sink: ByteSink,
    options?: { pin?: boolean; signal?: AbortSignal; onProgress?: (progress: AppKitProgress) => void }
  ): Promise<void>
}

const cryptoApi = () => {
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto is required for encrypted shares')
  return globalThis.crypto
}

const bytesToBase64Url = (bytes: Uint8Array) => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  const encoded = typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64')
  return encoded.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

const base64UrlToBytes = (value: string) => {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4)
  const binary = typeof atob === 'function' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary')
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

const encodeCapability = (capability: ShareCapability) => bytesToBase64Url(textEncoder.encode(JSON.stringify(capability)))
const decodeCapability = (value: string): ShareCapability => JSON.parse(textDecoder.decode(base64UrlToBytes(value)))

export const createShareLink = (capability: ShareCapability, baseUrl?: string): string => {
  const token = encodeCapability(capability)
  if (!baseUrl) return `peernet://share#${token}`
  const url = new URL(baseUrl)
  url.hash = `peernet=${token}`
  return url.toString()
}

export const parseShareLink = (input: string): ShareCapability => {
  let token = input.trim()
  if (token.includes('#')) token = token.slice(token.indexOf('#') + 1)
  if (token.startsWith('peernet=')) token = token.slice('peernet='.length)
  const capability = decodeCapability(token)
  if (capability.version !== 1 || !capability.hash || !capability.name) throw new Error('Invalid Peernet share link')
  return capability
}

const importAesKey = (raw: Uint8Array, usages: KeyUsage[]) =>
  cryptoApi().subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, usages)

const derivePasswordKey = async (password: string, salt: Uint8Array, iterations: number) => {
  const material = await cryptoApi().subtle.importKey('raw', textEncoder.encode(password), 'PBKDF2', false, ['deriveKey'])
  return cryptoApi().subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

const wrapKeyWithPassword = async (rawKey: Uint8Array, password: string) => {
  const salt = cryptoApi().getRandomValues(new Uint8Array(16))
  const iv = cryptoApi().getRandomValues(new Uint8Array(12))
  const iterations = DEFAULT_PBKDF2_ITERATIONS
  const key = await derivePasswordKey(password, salt, iterations)
  const wrapped = await cryptoApi().subtle.encrypt({ name: 'AES-GCM', iv }, key, rawKey as BufferSource)
  return { salt: bytesToBase64Url(salt), iv: bytesToBase64Url(iv), wrappedKey: bytesToBase64Url(new Uint8Array(wrapped)), iterations }
}

const unwrapPasswordKey = async (wrapped: NonNullable<ShareCapability['password']>, password: string) => {
  try {
    const key = await derivePasswordKey(password, base64UrlToBytes(wrapped.salt), wrapped.iterations)
    const raw = await cryptoApi().subtle.decrypt(
      { name: 'AES-GCM', iv: base64UrlToBytes(wrapped.iv) },
      key,
      base64UrlToBytes(wrapped.wrappedKey)
    )
    return new Uint8Array(raw)
  } catch {
    throw new Error('Incorrect password or damaged share link')
  }
}

const frame = (iv: Uint8Array, ciphertext: Uint8Array) => {
  const output = new Uint8Array(FRAME_HEADER_SIZE + ciphertext.length)
  new DataView(output.buffer).setUint32(0, ciphertext.length)
  output.set(iv, 4)
  output.set(ciphertext, FRAME_HEADER_SIZE)
  return output
}

export const encryptByteStream = (source: ByteSource, rawKey: Uint8Array, signal?: AbortSignal): ReadableStream<Uint8Array> => {
  const iterator = asAsyncBytes(source)[Symbol.asyncIterator]()
  let key: Promise<CryptoKey> | undefined
  return new ReadableStream({
    async pull(controller) {
      if (signal?.aborted) return controller.error(signal.reason ?? new Error('Encryption aborted'))
      const { done, value } = await iterator.next()
      if (done) return controller.close()
      try {
        key ??= importAesKey(rawKey, ['encrypt'])
        const iv = cryptoApi().getRandomValues(new Uint8Array(12))
        const encrypted = await cryptoApi().subtle.encrypt({ name: 'AES-GCM', iv }, await key, value as BufferSource)
        controller.enqueue(frame(iv, new Uint8Array(encrypted)))
      } catch (error) {
        controller.error(error)
      }
    },
    async cancel() {
      await iterator.return?.(undefined as any)
    }
  })
}

export const decryptByteStream = (source: ByteSource, rawKey: Uint8Array, signal?: AbortSignal): ReadableStream<Uint8Array> => {
  const iterator = asAsyncBytes(source)[Symbol.asyncIterator]()
  let buffer = new Uint8Array()
  let key: Promise<CryptoKey> | undefined
  let ended = false
  const fill = async (minimum: number) => {
    while (buffer.length < minimum && !ended) {
      const next = await iterator.next()
      ended = Boolean(next.done)
      if (!next.done) {
        const joined = new Uint8Array(buffer.length + next.value.length)
        joined.set(buffer)
        joined.set(next.value, buffer.length)
        buffer = joined
      }
    }
  }
  return new ReadableStream({
    async pull(controller) {
      if (signal?.aborted) return controller.error(signal.reason ?? new Error('Decryption aborted'))
      try {
        await fill(FRAME_HEADER_SIZE)
        if (buffer.length === 0 && ended) return controller.close()
        if (buffer.length < FRAME_HEADER_SIZE) throw new Error('Truncated encrypted share')
        const length = new DataView(buffer.buffer, buffer.byteOffset, 4).getUint32(0)
        await fill(FRAME_HEADER_SIZE + length)
        if (buffer.length < FRAME_HEADER_SIZE + length) throw new Error('Truncated encrypted share frame')
        const iv = buffer.slice(4, FRAME_HEADER_SIZE)
        const ciphertext = buffer.slice(FRAME_HEADER_SIZE, FRAME_HEADER_SIZE + length)
        buffer = buffer.slice(FRAME_HEADER_SIZE + length)
        key ??= importAesKey(rawKey, ['decrypt'])
        const plain = await cryptoApi().subtle.decrypt({ name: 'AES-GCM', iv }, await key, ciphertext)
        controller.enqueue(new Uint8Array(plain))
      } catch (error) {
        controller.error(error)
      }
    },
    async cancel() {
      await iterator.return?.(undefined as any)
    }
  })
}

export class PeernetAppSettings<T extends Record<string, unknown> = Record<string, unknown>> {
  readonly key: string
  #storage: AppKitStorage
  #defaults: T

  constructor(options: { key?: string; storage?: AppKitStorage; defaults?: T } = {}) {
    this.key = options.key ?? 'peernet:app-kit:settings'
    const storage = options.storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined)
    if (!storage) throw new Error('A settings storage adapter is required')
    this.#storage = storage
    this.#defaults = (options.defaults ?? {}) as T
  }

  get(): T {
    const stored = this.#storage.getItem(this.key)
    return stored ? { ...this.#defaults, ...JSON.parse(stored) } : { ...this.#defaults }
  }

  update(patch: Partial<T>): T {
    const settings = { ...this.get(), ...patch }
    this.#storage.setItem(this.key, JSON.stringify(settings))
    return settings
  }

  reset(): T {
    this.#storage.removeItem(this.key)
    return this.get()
  }
}

export class PeernetAppKit {
  readonly peernet: AppKitPeernet
  readonly settings?: PeernetAppSettings
  #storage?: AppKitStorage
  #quotaBytes?: number

  constructor(peernet: AppKitPeernet, options: { storage?: AppKitStorage; quotaBytes?: number; settings?: PeernetAppSettings } = {}) {
    this.peernet = peernet
    this.#storage = options.storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined)
    this.#quotaBytes = options.quotaBytes
    this.settings = options.settings
  }

  #records(): Array<{ hash: string; size: number; name: string; createdAt: number }> {
    if (!this.#storage) return []
    return JSON.parse(this.#storage.getItem('peernet:app-kit:shares') || '[]')
  }

  usage() {
    const shares = this.#records()
    return { usedBytes: shares.reduce((total, share) => total + share.size, 0), quotaBytes: this.#quotaBytes, shares }
  }

  async shareEncrypted(
    file: { stream(): ReadableStream<Uint8Array>; size?: number; name?: string; type?: string },
    options: {
      password?: string
      baseUrl?: string
      expiresAt?: number
      expiresIn?: number
      maxDownloads?: number
      recipients?: string[]
      wrapKey?: (recipient: string, rawKey: Uint8Array) => Promise<string>
      signal?: AbortSignal
      onProgress?: (progress: AppKitProgress) => void
    } = {}
  ): Promise<EncryptedShare> {
    if (!file?.stream) throw new TypeError('file.stream() is required')
    const usage = this.usage()
    if (this.#quotaBytes !== undefined && usage.usedBytes + (file.size ?? 0) > this.#quotaBytes)
      throw new Error('The configured Peernet storage quota would be exceeded')
    const rawKey = cryptoApi().getRandomValues(new Uint8Array(32))
    const name = file.name || 'encrypted-file'
    const encrypted = encryptByteStream(file.stream(), rawKey, options.signal)
    const hash = await this.peernet.broadcastStream(`${name}.peernet-encrypted`, encrypted, {
      signal: options.signal,
      onProgress: options.onProgress
    })
    const expiresAt = options.expiresAt ?? (options.expiresIn ? Date.now() + options.expiresIn : undefined)
    const capability: ShareCapability = {
      version: 1,
      network: this.peernet.network,
      hash,
      name,
      size: file.size,
      mimeType: file.type,
      policy: expiresAt || options.maxDownloads || options.recipients?.length
        ? { expiresAt, maxDownloads: options.maxDownloads, recipients: options.recipients }
        : undefined
    }
    if (options.recipients?.length) {
      if (!options.wrapKey) throw new Error('wrapKey is required for recipient-restricted shares')
      capability.recipientKeys = Object.fromEntries(
        await Promise.all(options.recipients.map(async (recipient) => [recipient, await options.wrapKey!(recipient, rawKey)]))
      )
    } else if (options.password) capability.password = await wrapKeyWithPassword(rawKey, options.password)
    else capability.key = bytesToBase64Url(rawKey)

    if (this.#storage) {
      const records = this.#records()
      records.push({ hash, size: file.size ?? 0, name, createdAt: Date.now() })
      this.#storage.setItem('peernet:app-kit:shares', JSON.stringify(records))
    }
    const url = createShareLink(capability, options.baseUrl)
    return {
      hash,
      url,
      capability,
      toQrDataUrl: async (qrOptions = {}) => {
        const module = await import('qrcode')
        const qrcode = (module as any).default ?? module
        return qrcode.toDataURL(url, { width: qrOptions.width ?? 320, margin: qrOptions.margin ?? 2 })
      }
    }
  }

  async open(
    link: string | ShareCapability,
    options: {
      password?: string
      recipient?: string
      unwrapKey?: (recipient: string, wrappedKey: string) => Promise<Uint8Array>
    } = {}
  ): Promise<OpenedShare> {
    const capability = typeof link === 'string' ? parseShareLink(link) : link
    if (capability.network && this.peernet.network && capability.network !== this.peernet.network)
      throw new Error(`Share belongs to network ${capability.network}`)
    if (capability.policy?.expiresAt && Date.now() > capability.policy.expiresAt) throw new Error('This share has expired')
    if (capability.policy?.maxDownloads !== undefined && !this.#storage)
      throw new Error('A storage adapter is required to enforce this share download limit')
    let rawKey: Uint8Array
    if (capability.key) rawKey = base64UrlToBytes(capability.key)
    else if (capability.password) {
      if (!options.password) throw new Error('This share requires a password')
      rawKey = await unwrapPasswordKey(capability.password, options.password)
    } else if (capability.recipientKeys) {
      if (!options.recipient || !options.unwrapKey) throw new Error('Recipient credentials are required')
      const wrapped = capability.recipientKeys[options.recipient]
      if (!wrapped) throw new Error('Recipient is not authorized for this share')
      rawKey = await options.unwrapKey(options.recipient, wrapped)
    } else throw new Error('Share link contains no decryption key')

    const stream = async (streamOptions: { pin?: boolean; signal?: AbortSignal; onProgress?: (progress: AppKitProgress) => void } = {}) => {
      if (capability.policy?.maxDownloads !== undefined && this.#storage) {
        const counterKey = `peernet:app-kit:downloads:${capability.hash}`
        const downloads = Number(this.#storage.getItem(counterKey) || 0)
        if (downloads >= capability.policy.maxDownloads) throw new Error('This share reached its local download limit')
        this.#storage.setItem(counterKey, String(downloads + 1))
      }
      const encrypted = await this.peernet.downloadStream(capability.hash, streamOptions)
      return decryptByteStream(encrypted, rawKey, streamOptions.signal)
    }
    return {
      hash: capability.hash,
      name: capability.name,
      size: capability.size,
      mimeType: capability.mimeType,
      policy: capability.policy,
      stream,
      save: async (sink, saveOptions = {}) => writeFileStream(await stream(saveOptions), sink, saveOptions.signal)
    }
  }

  async forget(hash: string, options: { unpin?: boolean } = {}): Promise<void> {
    if (this.#storage) {
      const records = this.#records().filter((record) => record.hash !== hash)
      this.#storage.setItem('peernet:app-kit:shares', JSON.stringify(records))
    }
    if (options.unpin) await this.peernet.unpinFile?.(hash)
  }
}
