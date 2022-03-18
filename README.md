# socket-discovery

## Usage
```js
import discovery from 'socket-discovery'
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

`note: you need to install jsproject`
```sh
npm i -g @vandeurenglenn/project
```
