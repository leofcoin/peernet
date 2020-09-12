export default class LeofcoinStorageClient {
  constructor(name, root) {
    this.name = name
    this.root = root
  }
  
  async get(key) {
    try {
      const result = await globalThis.peernet.client.request('storage', {
        name: this.name,
        root: this.root,
        key
      })
      return result
    } catch (e) {
      console.log(e);
      return undefined
    }
  }
  
  async put(key, value) {
    try {
      const result = await globalThis.peernet.client.request('storage', {
        name: this.name,
        root: this.root,
        key,
        value,
        method: 'put'
      })
      return result
    } catch (e) {
      console.log(e);
      return undefined
    }
  }
}