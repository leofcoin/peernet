export type ByteSource = ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>

export type ByteSink =
  | WritableStream<Uint8Array>
  | {
      write(chunk: Uint8Array): void | Promise<void>
      close?(): void | Promise<void>
      abort?(reason?: unknown): void | Promise<void>
    }

export type FileStreamProgress = {
  transferredBytes: number
  totalBytes?: number
  completedChunks: number
  totalChunks?: number
}

export const asAsyncBytes = async function* (source: ByteSource): AsyncGenerator<Uint8Array> {
  if (Symbol.asyncIterator in source) {
    for await (const chunk of source as AsyncIterable<Uint8Array>) yield new Uint8Array(chunk)
    return
  }
  const reader = (source as ReadableStream<Uint8Array>).getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) return
      if (value?.length) yield new Uint8Array(value)
    }
  } finally {
    reader.releaseLock()
  }
}

/** Convert arbitrary input buffers into consistently sized file chunks. */
export const fixedSizeChunks = async function* (
  source: ByteSource,
  chunkSize: number,
  signal?: AbortSignal
): AsyncGenerator<Uint8Array> {
  if (!Number.isSafeInteger(chunkSize) || chunkSize <= 0) throw new TypeError('chunkSize must be a positive integer')
  let output = new Uint8Array(chunkSize)
  let offset = 0
  for await (const input of asAsyncBytes(source)) {
    let inputOffset = 0
    while (inputOffset < input.length) {
      if (signal?.aborted) throw signal.reason ?? new Error('File stream was aborted')
      const length = Math.min(chunkSize - offset, input.length - inputOffset)
      output.set(input.subarray(inputOffset, inputOffset + length), offset)
      inputOffset += length
      offset += length
      if (offset === chunkSize) {
        yield output
        output = new Uint8Array(chunkSize)
        offset = 0
      }
    }
  }
  if (offset) yield output.slice(0, offset)
}

/** Pipe into either a Web WritableStream or a minimal sink interface. */
export const writeFileStream = async (
  stream: ReadableStream<Uint8Array>,
  sink: ByteSink,
  signal?: AbortSignal
): Promise<void> => {
  if ('getWriter' in sink) {
    await stream.pipeTo(sink as WritableStream<Uint8Array>, { signal })
    return
  }
  const writer = sink as Exclude<ByteSink, WritableStream<Uint8Array>>
  try {
    for await (const chunk of asAsyncBytes(stream)) {
      if (signal?.aborted) throw signal.reason ?? new Error('File stream was aborted')
      await writer.write(chunk)
    }
    await writer.close?.()
  } catch (error) {
    await writer.abort?.(error)
    throw error
  }
}
