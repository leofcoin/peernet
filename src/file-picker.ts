export type PickFilesOptions = {
  accept?: string
  multiple?: boolean
  directory?: boolean
  signal?: AbortSignal
}

const browserDocument = () => {
  if (typeof document === 'undefined') throw new Error('File pickers are only available in browser environments')
  return document
}

/** Framework-neutral fallback picker built on an ephemeral file input. */
export const pickFiles = (options: PickFilesOptions = {}): Promise<File[]> => {
  const owner = browserDocument()
  return new Promise((resolve, reject) => {
    const input = owner.createElement('input')
    input.type = 'file'
    input.accept = options.accept ?? ''
    input.multiple = options.multiple ?? false
    if (options.directory) input.setAttribute('webkitdirectory', '')
    const cleanup = () => {
      options.signal?.removeEventListener('abort', abort)
      input.remove()
    }
    const abort = () => {
      cleanup()
      reject(options.signal?.reason ?? new Error('File picker was aborted'))
    }
    input.addEventListener(
      'change',
      () => {
        const files = [...(input.files || [])]
        cleanup()
        resolve(files)
      },
      { once: true }
    )
    if (options.signal?.aborted) return abort()
    options.signal?.addEventListener('abort', abort, { once: true })
    input.click()
  })
}

export const pickFile = async (options: Omit<PickFilesOptions, 'multiple'> = {}): Promise<File | undefined> =>
  (await pickFiles({ ...options, multiple: false }))[0]

/** Use the File System Access API when available and return its writable sink. */
export const createSaveSink = async (options: { suggestedName?: string; types?: unknown[] } = {}) => {
  const picker = (globalThis as any).showSaveFilePicker
  if (typeof picker !== 'function') throw new Error('The File System Access save picker is not supported')
  const handle = await picker(options)
  return handle.createWritable() as Promise<WritableStream<Uint8Array>>
}
