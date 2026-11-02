# peernet

Peer-to-peer networking for Leofcoin and distributed applications.

## Features
- Decentralized peer discovery and messaging
- Pluggable request handlers
- File and data sharing
- Works in Node.js, browser, and Electron

## Installation

### Breaking content-address format in 2.0

Peernet 2.x uses `@leofcoin/codec-format-interface` 2.x. All generated content
addresses use canonical `codec → digest byte length → digest` headers. Length-first
hashes are not supported by the hash parser. Stored 1.x content-address indexes
and linked manifests are not automatically migrated or rewritten.

Upgrade all message producers and consumers together. For a chain deployment,
coordinate the messages, workers, browser node and genesis migration before
starting against new state. Back up existing stores and owner identities; this
package does not delete or reset them. Do not mix old content-addressed chainstate
with the new format or treat an installation update as a completed network reset.

```sh
npm install @leofcoin/peernet
```

## Usage

```js
import Peernet from '@leofcoin/peernet'

const config = {
  network: 'leofcoin:peach',
  networkVersion: 'peach',
  // Optional per-installation transport identity; defaults to the wallet identity.
  routingId: 'lfc-peer-a1b2c3d4',
  stars: ['wss://peach.leofcoin.org']
}

// If your identity is password-protected, prompt for password:
import passwordPrompt from '@leofcoin/peernet/src/prompts/password/node.js';
const password = await passwordPrompt();

const node = await new Peernet(config, password)
await node.start()

console.log(globalThis.peernet)
```

`node.id` is the routing identity used for peer discovery and swarm connections.
When `routingId` is omitted it remains the wallet identity for backward
compatibility. `node.peerId` always identifies the loaded wallet and should be
used by applications that need the wallet identity, such as chain transaction
signing. Applications with multiple installations of the same wallet can
provide a distinct, persisted `routingId` for each installation.

### Encrypted chat archive mode

Applications that already create and verify encrypted chat envelopes can opt in
to Peernet's bounded ciphertext archive. Archive settings and records are keyed
by the complete Peernet network string (including its version, such as
`leofcoin:peach`) in the message store. Archive mode is disabled by default.
Records expire after 30 days and are limited to 500 messages per network.
Plaintext message fields are rejected; the application supplies verification
functions for the signed envelope, inbox request and delivery receipt.

```js
const archive = node.createArchiveMode({
  verifyEnvelope,
  verifyInboxRequest,
  verifyReceipt
})

await archive.setEnabled(true) // Explicit opt-in for this node and network.
archive.onMessage(({ envelope }) => {
  // Decrypt the envelope in the application, then acknowledge with a signed receipt.
})
await archive.start({ account, deviceId })
await archive.requestInbox(signedInboxRequest)

// The envelope must contain ciphertext, recipient account/device, timestamp,
// signature, and either `network` or a network-bound device certificate.
await archive.send(encryptedEnvelope)
await archive.acknowledge(signedDeliveryReceipt)
```

Inbox requests and receipts must be signed and verified by the application.
Archives forward only ciphertext and never decrypt messages. Disabling archive
mode deletes this network's locally archived copies; it does not revoke or
erase copies on other nodes. Delivery and best-effort deletion depend on
reachable peers.

## API

### addRequestHandler
Register a handler for custom requests:

```js
peernet.addRequestHandler('lastBlock', async () => {
  const height = await chainStore.get('localIndex')
  const hash = await chainStore.get('localBlock')
  const response = JSON.stringify({ height: height.toString(), hash: hash.toString() })
  return new ResponseMessage({ response })
  // or
  // return new peernet.protos['peernet-response']({ response })
})

peernet.addRequestHandler('hello', () => {
  return new ResponseMessage({ response: 'hi' })
})

peernet.addRequestHandler('version', () => {
  return new ResponseMessage({ response: { version: 1 } })
})
```

### Password Prompt
For password-protected identities, use the provided prompt:

- **Node.js:** `import passwordPrompt from '@leofcoin/peernet/src/prompts/password/node.js'`
- **Browser:** `import passwordPrompt from '@leofcoin/peernet/src/prompts/password/browser.js'`

```js
const password = await passwordPrompt();
const node = await new Peernet(config, password);
```

## In-Memory Broadcasts: API and Usage

**What is it?**  
The `broadcast` method allows you to share files or folders with peers, storing them in-memory (not persisted to disk). Data is available for direct retrieval by hash until the process restarts.

**API:**
```typescript
// For files:
peernet.broadcast(path: string, { content: Uint8Array }): Promise<string>

// For folders:
peernet.broadcast(path: string, { links: Array<{ path: string, hash: string }> }): Promise<string>
```

**Parameters:**
- `path` (string): The virtual path or identifier for the file or folder.
- `content` (Uint8Array): The file data (for files).
- `links` (Array): An array of `{ path, hash }` objects (for folders).

**Returns:**  
A `Promise` that resolves to a hash string, which can be used to retrieve the data.

---

### Examples

**Broadcast a file:**
```js
const hash = await peernet.broadcast('/hello.txt', {
  content: new TextEncoder().encode('Hello world!')
});
```

Files larger than 256 KiB are automatically split into independently hashed pieces. The returned hash identifies a manifest, so receivers can verify every piece and request only pieces they still need. Override the piece size with `chunkSize`:

```js
const hash = await peernet.broadcast('/video.mp4', {
  content: videoBytes,
  chunkSize: 1024 * 1024
})
```

For a pausable/resumable download, use the transfer controller:

```js
const transfer = peernet.download(hash, { pin: true })
const unsubscribe = transfer.onProgress(({ transferredBytes, totalBytes, state }) => {
  console.log(state, transferredBytes, totalBytes)
})

transfer.pause()
transfer.resume() // already completed pieces are not fetched again

const bytes = await transfer.result
unsubscribe()
```

`peernet.cat(hash)` also reassembles chunked files transparently. `pin: true` caches verified pieces in the local data store, allowing a later transfer instance to reuse them.

Downloads pipeline four chunks by default. Known manifest providers are reused for all chunk hashes and chunk requests rotate across those peers, allowing different pieces to arrive concurrently from different providers. Configure the queue with `transferConcurrency`. Chunk size adapts to payload size (256 KiB normally, 1 MiB from 32 MiB, and 4 MiB from 256 MiB); an explicit `chunkSize` always overrides it.

### Streaming files

Large files can be shared and downloaded without buffering the complete payload in memory. Browser `File` and `Blob` objects are supported directly:

```js
const [file] = document.querySelector('input[type=file]').files
const hash = await peernet.shareFile(file, {
  onProgress: ({ transferredBytes, totalBytes }) => {
    console.log('shared', transferredBytes, 'of', totalBytes)
  }
})

const stream = await peernet.downloadStream(hash, {
  pin: true,
  onProgress: ({ transferredBytes, totalBytes }) => {
    console.log('downloaded', transferredBytes, 'of', totalBytes)
  }
})
```

`broadcastStream(path, source)` accepts a Web `ReadableStream<Uint8Array>` or an async iterable, so Node streams that implement `Symbol.asyncIterator` work as sources too. `saveFile(hash, sink)` accepts a Web `WritableStream` or a framework-neutral `{ write, close?, abort? }` sink:

```js
const fileHandle = await window.showSaveFilePicker({ suggestedName: file.name })
const writable = await fileHandle.createWritable()
await peernet.saveFile(hash, writable, { pin: true })
```

All streaming methods accept an `AbortSignal`. Downloads preserve manifest order while retaining only the active concurrency window in memory. Each chunk is hash-verified before it is emitted.

Use byte ranges for media seeking or partial retrieval. The end offset is exclusive and only overlapping chunks are requested:

```js
const segment = await peernet.downloadStream(hash, {
  range: { start: 10 * 1024 * 1024, end: 12 * 1024 * 1024 },
  retries: 3
})
```

`resumeDownload(hash)` pins each verified piece. A later call reconstructs progress from the content-addressed cache and skips pieces already present, including after an application restart. Requests are distributed using observed provider latency, failures, and active load; stalled requests time out and pieces retry against another provider. Configure `requestTimeout` and `transferConcurrency` on the Peernet constructor.

Framework-neutral browser helpers are exported for applications that do not already have picker components:

```js
import { pickFile, pickFiles, createSaveSink } from '@leofcoin/peernet'

const file = await pickFile({ accept: 'video/*' })
const hash = await peernet.shareFile(file)

const directoryFiles = await pickFiles({ directory: true, multiple: true })
const directoryHash = await peernet.shareFiles(directoryFiles)

const sink = await createSaveSink({ suggestedName: file.name })
await peernet.saveFile(hash, sink)
```

### Pinning and replication

```js
await peernet.pinFile(hash)
await peernet.unpinFile(hash)

// Peers explicitly opt into storing replication requests.
const disableReplication = await peernet.enableReplication({
  maxBytes: 10 * 1024 * 1024 * 1024,
  accept: async (hash, requestingPeer) => true
})

const result = await peernet.replicate(hash, { replicas: 3, timeout: 15_000 })

// Recheck and repair the target every minute.
const stopMaintenance = peernet.maintainReplicas(hash, {
  replicas: 3,
  interval: 60_000,
  onUpdate: console.log
})
```

Replication is cooperative: storage peers choose whether to accept content and can enforce quotas. `replicate()` reports whether enough peers acknowledged the request rather than claiming durability when peers are offline.

### Optional BitTorrent interoperability

BitTorrent support is an adapter so applications can choose their preferred implementation without adding a peer-wire client and its attack surface to every Peernet installation:

```js
peernet.setTorrentAdapter(myTorrentAdapter)
const hash = await peernet.importTorrent(torrentFileOrMagnet)
const torrent = await peernet.exportTorrent(hash)
```

An adapter implements `importTorrent(source, context)` and `exportTorrent(hash, context)`. This boundary supports WebTorrent, native libtorrent bridges, or a server-side torrent service while keeping Peernet manifests, verification, and storage unchanged.

### App Kit: encrypted product workflows

The optional `@leofcoin/peernet/app-kit` entry adds application-level sharing without increasing the default Peernet bundle. It provides AES-256-GCM streaming encryption, capability links, password wrapping with PBKDF2, recipient-specific key wrapping hooks, expiry and local download policies, QR output, quota accounting, settings, and direct-to-sink saving.

```js
import { PeernetAppKit } from '@leofcoin/peernet/app-kit'

const app = new PeernetAppKit(peernet, {
  storage: localStorage,
  quotaBytes: 10 * 1024 * 1024 * 1024
})

const share = await app.shareEncrypted(file, {
  password: 'a separately communicated password',
  baseUrl: location.href,
  expiresIn: 7 * 24 * 60 * 60 * 1000,
  maxDownloads: 5
})

await navigator.clipboard.writeText(share.url)
const qrDataUrl = await share.toQrDataUrl()
```

On the receiving side:

```js
const opened = await app.open(location.href, { password })
const sink = await createSaveSink({ suggestedName: opened.name })
await opened.save(sink, { pin: true, onProgress: console.log })
```

The content hash and encrypted payload travel through Peernet; the AES key remains in the URL fragment or is password-/recipient-wrapped. URL fragments are not sent in HTTP requests. Recipient-restricted shares use application-provided `wrapKey` and `unwrapKey` callbacks so an app can connect its own account key system without Peernet prescribing one.

Expiry and download-count policies are locally enforced usability controls. They cannot erase plaintext already downloaded by another peer, and a fully offline recipient can reset local counters. Applications requiring globally authoritative limits should combine the App Kit with a trusted key-release or accounting service.

Settings can use any `localStorage`-compatible adapter:

```js
import { PeernetAppSettings } from '@leofcoin/peernet/app-kit'

const settings = new PeernetAppSettings({
  storage: localStorage,
  defaults: { theme: 'system', replicas: 3, autoPin: true }
})

settings.update({ theme: 'dark' })
```

### Large blocks

Blocks larger than 1 MiB are also chunked internally, without changing the public block API or the canonical block hash supplied by the chain:

```js
await peernet.block.put(blockHash, encodedBlock)
const encodedBlockAgain = await peernet.block.get(blockHash)

const transfer = peernet.block.download(blockHash)
transfer.pause()
transfer.resume()
const bytes = await transfer.result
```

The block manifest remains stored under the canonical block hash; individual chunks have their own transport hashes. Peernet verifies every chunk before reconstruction. The chain layer must still verify the reconstructed canonical block hash and perform normal consensus validation before loading it. Defaults can be configured with `blockChunkThreshold` and `blockChunkSize` in the Peernet constructor.

**Broadcast a folder:**
```js
const folderHash = await peernet.broadcast('/my-folder', {
  links: [
    { path: '/hello.txt', hash: hash }
  ]
});
```

**Retrieve data by hash (peer side):**
```js
const proto = { decoded: { hash } };
await peernet.handleData(peer, 'some-id', proto);
// The peer will receive either .data (for files) or .links (for folders)
```

---

### Notes

- If you broadcast a folder, only the `links` property is required; `content` should be omitted.
- If you broadcast a file, only the `content` property is required; `links` should be omitted.
- The hash returned is unique to the content or folder structure.
- Data is lost when the process restarts.

### In-Memory Broadcasts


Peernet supports in-memory data sharing for fast, temporary distribution of files or folders between peers. This feature allows you to broadcast a file (with content) or a folder (with just links), which is then available for retrieval by other peers (or yourself) until the process is restarted or the in-memory cache is cleared.

### Usage Example

```js
// Broadcast a file in-memory
const hash = await peernet.broadcast('/example', {
  content: new TextEncoder().encode('hello world')
});

// Broadcast a folder (just links) in-memory
const folderHash = await peernet.broadcast('/folder', {
  links: [
    { path: '/file1', hash: 'hash1' },
    { path: '/file2', hash: 'hash2' }
  ]
});

// Another peer can request the data by hash
// (handled internally by peernet.handleData)
```

### Detailed Example

```js
// 1. Broadcast a file in-memory
const hash = await peernet.broadcast('/example', {
  content: new TextEncoder().encode('Hello Peernet!')
});
console.log('Broadcasted hash:', hash);

// 2. Broadcast a folder in-memory
const folderHash = await peernet.broadcast('/folder', {
  links: [
    { path: '/file1', hash: 'hash1' },
    { path: '/file2', hash: 'hash2' }
  ]
});
console.log('Broadcasted folder hash:', folderHash);

// 3. Simulate a peer requesting the data by hash
const mockPeer = {
  connected: true,
  send: async (data, id) => {
    // Handle the received data (for demo/testing)
    const DataResponseProto = globalThis.peernet.protos['peernet-data-response'];
    const decodedProto = await new DataResponseProto(data);
    await decodedProto.decode();
    if (decodedProto.decoded.data) {
      const decodedContent = new TextDecoder().decode(decodedProto.decoded.data);
      console.log('Received content:', decodedContent);
    } else if (decodedProto.decoded.links) {
      console.log('Received folder links:', decodedProto.decoded.links);
    }
  }
};
const proto = { decoded: { hash } };
await peernet.handleData(mockPeer, 'test-id', proto);
```

### Data Flow Diagram

```
[You/Peer] --(broadcast)--> [Peernet Node: In-Memory Map]
     ^                                 |
     |                                 |
     +------(handleData request)--------+
```

- `broadcast()` stores the data in-memory and returns a hash.
- `handleData()` retrieves the data by hash and sends it to the requesting peer.

- The broadcasted data is stored in-memory and is not persisted to disk.
- Retrieval is by hash, matching the value returned from `broadcast()`.
- The feature is useful for ephemeral data, rapid prototyping, or testing.
- If the process restarts, the in-memory data is lost.

### Testing

Automated tests verify that broadcasting and retrieving in-memory data works as expected, including content integrity and hash matching.

## Folder Support (Files with Just Links)


Peernet supports "folders" as special file objects that contain only links to other files, without any content. This allows you to represent directory structures or collections of files.

**Example: Broadcasting a Folder**
```js
const folderHash = await peernet.broadcast('/folder', {
  links: [
    { path: '/file1', hash: 'hash1' },
    { path: '/file2', hash: 'hash2' }
  ]
});
```

**Retrieving a Folder**
When a folder is retrieved (e.g., via `handleData`), its `links` array will be preserved, and `content` will be empty or undefined.

**Test Coverage**
Automated tests verify that broadcasting and retrieving folders works as expected, ensuring the links are preserved and content is empty or undefined.

## Development

> **Note:** You need to install [jsproject](https://www.npmjs.com/package/@vandeurenglenn/project)

```sh
npm i -g @vandeurenglenn/project
```

### Scripts

- **Watch:**
  ```sh
  npm run watch
  ```
- **Build:**
  ```sh
  npm run build
  ```
- **Test:**
  ```sh
  npm test
  ```
- **Serve HTML Demo:**
  ```sh
  npm run demo
  ```

## License

MIT
