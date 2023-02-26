# peernet

## Usage
```js
import Peernet from '@leofcoin/peernet'


const config = {
  network: 'leofcoin:peach',
  networkVersion: 'peach',
  stars: ['wss://peach.leofcoin.org']
}

const node = await new Peernet(config)
// ... setup some things
await node.start()

console.log(globalThis.peernet)
```



## API
#### addRequestHandler

examples
```js
peernet.addRequestHandler('lastBlock', () => {
  let response;
  const height = await chainStore.get('localIndex')
  const hash = await chainStore.get('localBlock')
  response = JSON.stringify({ height: height.toString(), hash: hash.toString() })
  return new ResponseMessage({ response })
  // or
  return new peernet.protos['peernet-response']({ response })
})
```

```js
peernet.addRequestHandler('hello', () => {
  return new ResponseMessage({ response: 'hi' })
  // or
  return new peernet.protos['peernet-response']({ response: 'hi' })
})
```

## Development

`note: you need to install jsproject`
```sh
npm i -g @vandeurenglenn/project
```

### watch
```sh
npm run w
```
### compile
```sh
npm run c
```
### serve html
```sh
npm run demo
```

