# peernet

Peer-to-peer networking for Leofcoin and distributed applications.

## Features
- Decentralized peer discovery and messaging
- Pluggable request handlers
- File and data sharing
- Works in Node.js, browser, and Electron

## Installation

```sh
npm install @leofcoin/peernet
```

## Usage

```js
import Peernet from '@leofcoin/peernet'

const config = {
  network: 'leofcoin:peach',
  networkVersion: 'peach',
  stars: ['wss://peach.leofcoin.org']
}

// If your identity is password-protected, prompt for password:
import passwordPrompt from '@leofcoin/peernet/src/prompts/password/node.js';
const password = await passwordPrompt();

const node = await new Peernet(config, password)
await node.start()

console.log(globalThis.peernet)
```

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

