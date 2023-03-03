# breaking changes
## 1.0.10
### start
#### before
```js
const node = await new Node()
```

#### now
```js
const node = await new Node()
// gives time to setup things...
await node.start()
```

## 1.1.0
### autoStart
#### before
```js
const node = await new Node()
// gives time to setup things...
await node.start()
```

#### now
```js
const node = await new Node()
```
or

```js
const node = await new Node({autoStart: false}) // defaults to true
// gives time to setup things...
await node.start()
```