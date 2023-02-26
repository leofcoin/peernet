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