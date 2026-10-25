const VERSION = 1
const MAX_PACKET_BYTES = 64_000
const MAX_ENVELOPE_BYTES = 32_000
const MAX_ARCHIVES = 500
const MAX_OUTBOX = 500
const MAX_AGE = 30 * 24 * 60 * 60 * 1000
const MAX_CLOCK_SKEW = 10 * 60 * 1000
const MAX_HOPS = 8
const encoder = new TextEncoder()
const decoder = new TextDecoder()

export type ArchivedEnvelope = {
  id: string
  network?: string
  recipientAccount: string
  recipientDeviceId: string
  ciphertext: string
  timestamp: number
  [key: string]: unknown
}

export type InboxRequest = {
  account: string
  deviceId: string
  network: string
  timestamp: number
  signature: string
  [key: string]: unknown
}

export type DeliveryReceipt = {
  messageId: string
  recipientAccount: string
  recipientDeviceId: string
  network: string
  timestamp: number
  signature: string
  [key: string]: unknown
}

export type ArchiveStore = {
  has?(key: string): Promise<boolean | unknown[]>
  get(key: string): Promise<Uint8Array>
  put(key: string, value: Uint8Array): Promise<unknown>
  delete(key: string): Promise<unknown>
  keys(): Promise<Array<string | { toString(): string }>>
}

export type ArchivePeernet = {
  network: string
  id: string
  publish(topic: string, payload: Uint8Array): Promise<unknown>
  subscribe(topic: string, callback: (payload: Uint8Array) => void): Promise<unknown>
}

function isUnsubscribe(value: unknown): value is () => void {
  return typeof value === 'function'
}

export type ArchiveModeOptions = {
  peernet: ArchivePeernet
  store?: ArchiveStore
  verifyEnvelope: (envelope: ArchivedEnvelope) => Promise<boolean>
  verifyInboxRequest: (request: InboxRequest) => Promise<boolean>
  verifyReceipt: (receipt: DeliveryReceipt, envelope: ArchivedEnvelope) => Promise<boolean>
}

type ArchivePacket = {
  version: 1
  id: string
  network: string
  origin: string
  timestamp: number
  hopsRemaining: number
  type: 'direct' | 'inbox-request' | 'archive-delivery' | 'delivery-receipt'
  payload: Record<string, unknown>
}

function encode(value: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(value))
}

function decode(payload: Uint8Array): unknown {
  if (!(payload instanceof Uint8Array)) throw new TypeError('Archive packets must be encoded bytes.')
  if (payload.byteLength > MAX_PACKET_BYTES) throw new RangeError('Archive packet exceeds the size limit.')
  return JSON.parse(decoder.decode(payload))
}

function randomId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function keyPrefix(network: string): string {
  return `peernet:archive:v1:${encodeURIComponent(network)}:`
}

function recordKey(network: string, kind: 'archive' | 'outbox', id: string): string {
  return `${keyPrefix(network)}${kind}:${encodeURIComponent(id)}`
}

function stateKey(network: string): string {
  return `${keyPrefix(network)}state`
}

async function storeGet(store: ArchiveStore, key: string): Promise<Uint8Array | undefined> {
  if (store.has && !(await store.has(key))) return undefined
  try {
    return await store.get(key)
  } catch (error) {
    if (
      (error as { code?: string; name?: string })?.code === 'LEVEL_NOT_FOUND' ||
      (error as { name?: string })?.name === 'NotFoundError'
    )
      return undefined
    throw error
  }
}

function validateEnvelope(envelope: ArchivedEnvelope, network: string): void {
  const envelopeNetwork =
    envelope?.network ||
    (envelope?.senderCertificate as { network?: string } | undefined)?.network ||
    (envelope?.recipientCertificate as { network?: string } | undefined)?.network
  if (
    !envelope ||
    typeof envelope !== 'object' ||
    envelopeNetwork !== network ||
    typeof envelope.id !== 'string' ||
    !envelope.id ||
    typeof envelope.recipientAccount !== 'string' ||
    typeof envelope.recipientDeviceId !== 'string' ||
    typeof envelope.ciphertext !== 'string' ||
    !envelope.ciphertext ||
    typeof envelope.signature !== 'string' ||
    !Number.isFinite(envelope.timestamp) ||
    envelope.timestamp < Date.now() - MAX_AGE ||
    envelope.timestamp > Date.now() + MAX_CLOCK_SKEW
  )
    throw new Error('Only a valid, network-scoped encrypted message envelope can be archived.')
  if ('text' in envelope || 'plaintext' in envelope || 'message' in envelope)
    throw new Error('Plaintext message fields cannot be archived.')
  if (encode(envelope).byteLength > MAX_ENVELOPE_BYTES)
    throw new RangeError('Encrypted message envelope exceeds the archive size limit.')
}

function validatePacket(value: unknown, network: string): ArchivePacket | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  const packet = value as ArchivePacket
  if (
    packet.version !== VERSION ||
    packet.network !== network ||
    typeof packet.id !== 'string' ||
    !packet.id ||
    typeof packet.origin !== 'string' ||
    !packet.origin ||
    !Number.isFinite(packet.timestamp) ||
    packet.timestamp < Date.now() - MAX_AGE ||
    packet.timestamp > Date.now() + MAX_CLOCK_SKEW ||
    !Number.isInteger(packet.hopsRemaining) ||
    packet.hopsRemaining < 0 ||
    packet.hopsRemaining > MAX_HOPS ||
    !['direct', 'inbox-request', 'archive-delivery', 'delivery-receipt'].includes(packet.type) ||
    !packet.payload ||
    typeof packet.payload !== 'object' ||
    Array.isArray(packet.payload)
  )
    return
  return packet
}

export class PeernetArchiveMode {
  #peernet: ArchivePeernet
  #store: ArchiveStore
  #network: string
  #topic: string
  #verifyEnvelope: ArchiveModeOptions['verifyEnvelope']
  #verifyInboxRequest: ArchiveModeOptions['verifyInboxRequest']
  #verifyReceipt: ArchiveModeOptions['verifyReceipt']
  #handlers = new Set<(event: { type: 'message'; envelope: ArchivedEnvelope }) => void>()
  #seen = new Map<string, number>()
  #archives = new Set<string>()
  #outbox = new Set<string>()
  #enabled = false
  #started = false
  #unsubscribe?: () => void
  #retryTimer?: ReturnType<typeof setInterval>
  #account = ''
  #deviceId = ''

  constructor(options: ArchiveModeOptions) {
    if (!options?.peernet?.network || typeof options.peernet.publish !== 'function' ||
        typeof options.peernet.subscribe !== 'function')
      throw new Error('A Peernet instance is required for archive mode.')
    const store = options.store || globalThis.messageStore
    if (!store || typeof store.get !== 'function' || typeof store.put !== 'function' ||
        typeof store.delete !== 'function' || typeof store.keys !== 'function')
      throw new Error('A persistent Peernet message store is required for archive mode.')
    if (typeof options.verifyEnvelope !== 'function' ||
        typeof options.verifyInboxRequest !== 'function' ||
        typeof options.verifyReceipt !== 'function')
      throw new Error('Archive mode requires envelope, inbox-request and receipt verification functions.')

    this.#peernet = options.peernet
    this.#store = store
    this.#network = options.peernet.network
    this.#topic = `peernet:archive:v1:${this.#network}`
    this.#verifyEnvelope = options.verifyEnvelope
    this.#verifyInboxRequest = options.verifyInboxRequest
    this.#verifyReceipt = options.verifyReceipt
  }

  get network(): string {
    return this.#network
  }

  get enabled(): boolean {
    return this.#enabled
  }

  get archiveCount(): number {
    return this.#archives.size
  }

  get pendingCount(): number {
    return this.#outbox.size
  }

  onMessage(handler: (event: { type: 'message'; envelope: ArchivedEnvelope }) => void): () => void {
    if (typeof handler !== 'function') throw new TypeError('An archive message handler is required.')
    this.#handlers.add(handler)
    return () => this.#handlers.delete(handler)
  }

  async start({ account, deviceId }: { account: string; deviceId: string }): Promise<void> {
    if (this.#started) return
    if (!account || !deviceId) throw new Error('A local account and chat device ID are required.')
    this.#account = account
    this.#deviceId = deviceId
    await this.#load()
    const receiver = (payload: Uint8Array) => {
      this.#receive(payload).catch((error) => console.error('Peernet archive packet failed:', error))
    }
    const unsubscribe = await this.#peernet.subscribe(this.#topic, receiver)
    this.#unsubscribe = isUnsubscribe(unsubscribe)
      ? unsubscribe
      : typeof globalThis.globalSub?.unsubscribe === 'function'
        ? () => globalThis.globalSub.unsubscribe(this.#topic, receiver)
        : undefined
    this.#started = true
    this.#retryTimer = setInterval(() => {
      this.#retryOutbox().catch((error) => console.error('Peernet archive retry failed:', error))
    }, 30_000)
    try {
      for (const id of this.#outbox) {
        const bytes = await storeGet(this.#store, recordKey(this.#network, 'outbox', id))
        if (bytes) await this.#publish('direct', { envelope: JSON.parse(decoder.decode(bytes)) })
      }
    } catch (error) {
      this.stop()
      throw error
    }
  }

  stop(): void {
    clearInterval(this.#retryTimer)
    this.#retryTimer = undefined
    this.#unsubscribe?.()
    this.#unsubscribe = undefined
    this.#started = false
    this.#account = ''
    this.#deviceId = ''
  }

  async setEnabled(enabled: boolean): Promise<void> {
    if (typeof enabled !== 'boolean') throw new TypeError('Archive mode must be enabled or disabled explicitly.')
    if (!this.#started) await this.#load()
    this.#enabled = enabled
    await this.#store.put(stateKey(this.#network), encode({ version: VERSION, enabled }))
    if (!enabled) {
      for (const id of this.#archives) await this.#store.delete(recordKey(this.#network, 'archive', id))
      this.#archives.clear()
    }
  }

  async send(envelope: ArchivedEnvelope): Promise<void> {
    validateEnvelope(envelope, this.#network)
    if (!(await this.#verifyEnvelope(envelope))) throw new Error('Encrypted message signature verification failed.')
    if (this.#outbox.has(envelope.id)) throw new Error('This encrypted message is already pending.')
    await this.#store.put(recordKey(this.#network, 'outbox', envelope.id), encode(envelope))
    this.#outbox.add(envelope.id)
    if (this.#outbox.size > MAX_OUTBOX) await this.#dropOldest('outbox')
    await this.#publish('direct', { envelope })
  }

  async requestInbox(request: InboxRequest): Promise<void> {
    if (request.network !== this.#network ||
        request.account !== this.#account ||
        request.deviceId !== this.#deviceId ||
        !(await this.#validInboxRequest(request)))
      throw new Error('A valid signed inbox request for this Peernet network and device is required.')
    await this.#publish('inbox-request', { request })
  }

  async acknowledge(receipt: DeliveryReceipt): Promise<void> {
    if (receipt.network !== this.#network ||
        receipt.recipientAccount !== this.#account ||
        receipt.recipientDeviceId !== this.#deviceId ||
        typeof receipt.signature !== 'string' ||
        !Number.isFinite(receipt.timestamp) ||
        Math.abs(Date.now() - receipt.timestamp) > MAX_CLOCK_SKEW)
      throw new Error('Delivery receipt does not belong to this Peernet network and device.')
    await this.#publish('delivery-receipt', { receipt })
  }

  async #load(): Promise<void> {
    const state = await storeGet(this.#store, stateKey(this.#network))
    if (state) {
      const saved = JSON.parse(decoder.decode(state))
      if (saved?.version !== VERSION || typeof saved.enabled !== 'boolean')
        throw new Error('Saved Peernet archive settings are invalid.')
      this.#enabled = saved.enabled
    }
    const prefix = keyPrefix(this.#network)
    const keys = await this.#store.keys()
    for (const keyInput of keys) {
      const key = keyInput.toString().replace(/^\/+/, '')
      if (!key.startsWith(prefix)) continue
      const archiveMarker = `${prefix}archive:`
      const outboxMarker = `${prefix}outbox:`
      if (key.startsWith(archiveMarker)) this.#archives.add(decodeURIComponent(key.slice(archiveMarker.length)))
      if (key.startsWith(outboxMarker)) this.#outbox.add(decodeURIComponent(key.slice(outboxMarker.length)))
    }
    await this.#prune()
  }

  async #publish(
    type: ArchivePacket['type'],
    payload: Record<string, unknown>,
    hopsRemaining = MAX_HOPS
  ): Promise<void> {
    if (!this.#started) throw new Error('Peernet archive mode is not started.')
    const packet: ArchivePacket = {
      version: VERSION,
      id: randomId(),
      network: this.#network,
      origin: this.#peernet.id,
      timestamp: Date.now(),
      hopsRemaining,
      type,
      payload
    }
    const bytes = encode(packet)
    if (bytes.byteLength > MAX_PACKET_BYTES) throw new RangeError('Peernet archive packet exceeds its size limit.')
    this.#seen.set(packet.id, packet.timestamp)
    await this.#peernet.publish(this.#topic, bytes)
  }

  async #receive(payload: Uint8Array): Promise<void> {
    const packet = validatePacket(decode(payload), this.#network)
    if (!packet || packet.origin === this.#peernet.id || this.#wasSeen(packet.id)) return
    this.#markSeen(packet.id)
    let forward = false
    switch (packet.type) {
      case 'direct':
      case 'archive-delivery': {
        const envelope = packet.payload.envelope as ArchivedEnvelope
        try {
          validateEnvelope(envelope, this.#network)
        } catch {
          break
        }
        if (!(await this.#verifyEnvelope(envelope))) break
        forward = true
        if (packet.type === 'direct' && this.#enabled) await this.#saveArchive(envelope)
        if (envelope.recipientAccount === this.#account && envelope.recipientDeviceId === this.#deviceId) {
          for (const handler of this.#handlers) handler({ type: 'message', envelope })
        }
        break
      }
      case 'inbox-request': {
        const request = packet.payload.request as InboxRequest
        if (!(await this.#validInboxRequest(request))) break
        forward = true
        if (this.#enabled && !(request.account === this.#account && request.deviceId === this.#deviceId))
          await this.#deliverTo(request)
        break
      }
      case 'delivery-receipt': {
        const receipt = packet.payload.receipt as DeliveryReceipt
        forward = await this.#receiveReceipt(receipt)
        break
      }
    }
    if (forward && packet.hopsRemaining > 0) {
      await this.#peernet.publish(
        this.#topic,
        encode({ ...packet, hopsRemaining: packet.hopsRemaining - 1 })
      )
    }
  }

  async #validInboxRequest(request: InboxRequest): Promise<boolean> {
    return Boolean(
      request &&
      request.network === this.#network &&
      typeof request.account === 'string' &&
      typeof request.deviceId === 'string' &&
      Number.isFinite(request.timestamp) &&
      Math.abs(Date.now() - request.timestamp) <= MAX_CLOCK_SKEW &&
      typeof request.signature === 'string' &&
      await this.#verifyInboxRequest(request)
    )
  }

  async #saveArchive(envelope: ArchivedEnvelope): Promise<void> {
    if (this.#archives.has(envelope.id)) return
    await this.#store.put(recordKey(this.#network, 'archive', envelope.id), encode({
      envelope,
      storedAt: Date.now()
    }))
    this.#archives.add(envelope.id)
    if (this.#archives.size > MAX_ARCHIVES) await this.#dropOldest('archive')
  }

  async #deliverTo(request: InboxRequest): Promise<void> {
    for (const id of this.#archives) {
      const bytes = await storeGet(this.#store, recordKey(this.#network, 'archive', id))
      if (!bytes) {
        this.#archives.delete(id)
        continue
      }
      const record = JSON.parse(decoder.decode(bytes))
      const envelope = record?.envelope as ArchivedEnvelope
      if (envelope?.recipientAccount === request.account && envelope.recipientDeviceId === request.deviceId)
        await this.#publish('archive-delivery', { envelope })
    }
  }

  async #receiveReceipt(receipt: DeliveryReceipt): Promise<boolean> {
    if (!receipt || receipt.network !== this.#network ||
        typeof receipt.messageId !== 'string' ||
        !Number.isFinite(receipt.timestamp) ||
        Math.abs(Date.now() - receipt.timestamp) > MAX_CLOCK_SKEW)
      return false
    const keys: Array<'archive' | 'outbox'> = ['archive', 'outbox']
    let verified = false
    for (const kind of keys) {
      const key = recordKey(this.#network, kind, receipt.messageId)
      const bytes = await storeGet(this.#store, key)
      if (!bytes) continue
      const stored = JSON.parse(decoder.decode(bytes))
      const envelope = kind === 'archive' ? stored.envelope : stored
      if (!(await this.#verifyReceipt(receipt, envelope))) continue
      await this.#store.delete(key)
      ;(kind === 'archive' ? this.#archives : this.#outbox).delete(receipt.messageId)
      verified = true
    }
    return verified
  }

  async #retryOutbox(): Promise<void> {
    if (!this.#started) return
    await this.#prune()
    for (const id of this.#outbox) {
      const bytes = await storeGet(this.#store, recordKey(this.#network, 'outbox', id))
      if (bytes) await this.#publish('direct', { envelope: JSON.parse(decoder.decode(bytes)) })
    }
  }

  async #prune(): Promise<void> {
    const cutoff = Date.now() - MAX_AGE
    for (const [kind, ids] of [['archive', this.#archives], ['outbox', this.#outbox]] as const) {
      for (const id of ids) {
        const key = recordKey(this.#network, kind, id)
        const bytes = await storeGet(this.#store, key)
        if (!bytes) {
          ids.delete(id)
          continue
        }
        const saved = JSON.parse(decoder.decode(bytes))
        const timestamp = kind === 'archive' ? saved.storedAt : saved.timestamp
        if (!Number.isFinite(timestamp) || timestamp < cutoff) {
          await this.#store.delete(key)
          ids.delete(id)
        }
      }
    }
  }

  async #dropOldest(kind: 'archive' | 'outbox'): Promise<void> {
    const ids = kind === 'archive' ? this.#archives : this.#outbox
    const id = ids.values().next().value
    if (!id) return
    await this.#store.delete(recordKey(this.#network, kind, id))
    ids.delete(id)
  }

  #wasSeen(id: string): boolean {
    const timestamp = this.#seen.get(id)
    return timestamp !== undefined && Date.now() - timestamp < MAX_AGE
  }

  #markSeen(id: string): void {
    this.#seen.set(id, Date.now())
    if (this.#seen.size > 4_000) {
      const oldestId = this.#seen.keys().next().value
      if (oldestId !== undefined) this.#seen.delete(oldestId)
    }
  }
}
