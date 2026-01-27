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

## In-Memory Broadcasts

Peernet supports in-memory data sharing for fast, temporary distribution of files or data objects between peers. This feature allows you to broadcast a file or data object, which is then available for retrieval by other peers (or yourself) until the process is restarted or the in-memory cache is cleared.

### Usage Example

```js
// Broadcast a file or data object in-memory
const fileObj = {
  path: '/example',
  content: new TextEncoder().encode('hello world'),
  links: []
};
const hash = await peernet.broadcast(fileObj);

// Another peer can request the data by hash
// (handled internally by peernet.handleData)
```

### Detailed Example

```js
// 1. Broadcast a file object in-memory
const fileObj = {
  path: '/example',
  content: new TextEncoder().encode('Hello Peernet!'),
  links: []
};
const hash = await peernet.broadcast(fileObj);
console.log('Broadcasted hash:', hash);

// 2. Simulate a peer requesting the data by hash
const mockPeer = {
  connected: true,
  send: async (data, id) => {
    // Handle the received data (for demo/testing)
    const DataResponseProto = globalThis.peernet.protos['peernet-data-response'];
    const decodedProto = await new DataResponseProto(data);
    await decodedProto.decode();
    const decodedContent = new TextDecoder().decode(decodedProto.decoded.data);
    console.log('Received content:', decodedContent);
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

