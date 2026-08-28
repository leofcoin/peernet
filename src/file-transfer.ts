export type FileTransferState = 'idle' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed'

export type FileTransferProgress = {
  hash: string
  state: FileTransferState
  completedChunks: number
  totalChunks: number
  transferredBytes: number
  totalBytes: number
}

type ProgressListener = (progress: FileTransferProgress) => void

/** A resumable download. Completed chunks remain cached on the transfer instance. */
export default class FileTransfer {
  readonly hash: string
  state: FileTransferState = 'idle'
  result: Promise<Uint8Array>
  error?: unknown

  #fetch: (hash: string, index?: number) => Promise<Uint8Array | undefined>
  #decode: (data: Uint8Array) => Promise<any>
  #verify: (data: Uint8Array, hash: string) => Promise<boolean>
  #pin?: (hash: string, data: Uint8Array) => Promise<any>
  #verifyManifest: boolean
  #concurrency: number
  #stopped = false
  #listeners = new Set<ProgressListener>()
  #chunks = new Map<number, Uint8Array>()
  #resumeWaiters: Array<() => void> = []
  #resolve!: (value: Uint8Array) => void
  #reject!: (reason?: unknown) => void
  #totalChunks = 0
  #totalBytes = 0
  #started = false

  constructor(options: {
    hash: string
    fetch: (hash: string, index?: number) => Promise<Uint8Array | undefined>
    decode: (data: Uint8Array) => Promise<any>
    verify: (data: Uint8Array, hash: string) => Promise<boolean>
    pin?: (hash: string, data: Uint8Array) => Promise<any>
    verifyManifest?: boolean
    concurrency?: number
  }) {
    this.hash = options.hash
    this.#fetch = options.fetch
    this.#decode = options.decode
    this.#verify = options.verify
    this.#pin = options.pin
    this.#verifyManifest = options.verifyManifest !== false
    this.#concurrency = options.concurrency ?? 4
    if (!Number.isSafeInteger(this.#concurrency) || this.#concurrency <= 0)
      throw new TypeError('concurrency must be a positive integer')
    this.result = new Promise((resolve, reject) => {
      this.#resolve = resolve
      this.#reject = reject
    })
  }

  get progress(): FileTransferProgress {
    let transferredBytes = 0
    for (const chunk of this.#chunks.values()) transferredBytes += chunk.length
    return {
      hash: this.hash,
      state: this.state,
      completedChunks: this.#chunks.size,
      totalChunks: this.#totalChunks,
      transferredBytes,
      totalBytes: this.#totalBytes
    }
  }

  onProgress(listener: ProgressListener): () => void {
    this.#listeners.add(listener)
    listener(this.progress)
    return () => this.#listeners.delete(listener)
  }

  start(): this {
    if (!this.#started) {
      this.#started = true
      this.state = 'running'
      this.#emit()
      void this.#run()
    }
    return this
  }

  pause(): void {
    if (this.state === 'running') {
      this.state = 'paused'
      this.#emit()
    }
  }

  resume(): void {
    if (this.state !== 'paused') return
    this.state = 'running'
    const waiters = this.#resumeWaiters.splice(0)
    for (const resolve of waiters) resolve()
    this.#emit()
  }

  cancel(): void {
    if (this.state === 'completed' || this.state === 'failed' || this.state === 'cancelled') return
    this.state = 'cancelled'
    this.#stopped = true
    const error = new Error(`Transfer ${this.hash} was cancelled`)
    this.error = error
    const waiters = this.#resumeWaiters.splice(0)
    for (const resolve of waiters) resolve()
    this.#reject(error)
    this.#emit()
  }

  async #waitUntilRunning(): Promise<void> {
    if (this.state === 'paused') await new Promise<void>((resolve) => this.#resumeWaiters.push(resolve))
    if (this.state === 'cancelled') throw this.error
  }

  async #run(): Promise<void> {
    try {
      const manifestData = await this.#fetch(this.hash)
      if (!manifestData) throw new Error(`Unable to download ${this.hash}`)
      if (this.#verifyManifest && !(await this.#verify(manifestData, this.hash)))
        throw new Error(`Manifest hash mismatch for ${this.hash}`)
      const manifest = await this.#decode(manifestData)
      if (this.#pin) await this.#pin(this.hash, manifestData)

      if (!manifest.chunked) {
        if (manifest.links?.length) throw new Error(`${this.hash} is a directory`)
        const content = manifest.content || new Uint8Array()
        this.#totalChunks = 1
        this.#totalBytes = content.length
        this.#chunks.set(0, content)
        this.state = 'completed'
        this.#resolve(content)
        this.#emit()
        return
      }

      const links = manifest.links || []
      this.#totalChunks = links.length
      this.#totalBytes =
        Number(manifest.size) || links.reduce((sum: number, link: { size?: number }) => sum + (Number(link.size) || 0), 0)
      this.#emit()

      let nextIndex = 0
      const worker = async () => {
        while (!this.#stopped) {
          await this.#waitUntilRunning()
          const index = nextIndex++
          if (index >= links.length) return
          if (this.#chunks.has(index)) continue
          const encoded = await this.#fetch(links[index].hash, index)
          if (this.#stopped) return
          if (!encoded) throw new Error(`Missing chunk ${index + 1}/${links.length}`)
          if (!(await this.#verify(encoded, links[index].hash))) throw new Error(`Hash mismatch for chunk ${index + 1}`)
          const chunkNode = await this.#decode(encoded)
          const content = chunkNode.content || new Uint8Array()
          this.#chunks.set(index, content)
          if (this.#pin) await this.#pin(links[index].hash, encoded)
          this.#emit()
        }
      }
      await Promise.all(Array.from({ length: Math.min(this.#concurrency, links.length) }, () => worker()))

      const output = new Uint8Array(this.#totalBytes)
      let offset = 0
      for (let index = 0; index < this.#totalChunks; index++) {
        const chunk = this.#chunks.get(index)
        if (!chunk) throw new Error(`Missing downloaded chunk ${index + 1}`)
        output.set(chunk, offset)
        offset += chunk.length
      }
      this.state = 'completed'
      this.#resolve(offset === output.length ? output : output.slice(0, offset))
      this.#emit()
    } catch (error) {
      if (this.state === 'cancelled') return
      this.state = 'failed'
      this.#stopped = true
      this.error = error
      this.#reject(error)
      this.#emit()
    }
  }

  #emit(): void {
    const progress = this.progress
    for (const listener of this.#listeners) listener(progress)
  }
}
