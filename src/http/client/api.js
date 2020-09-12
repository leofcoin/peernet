import HttpClientApi from './http-client.js'

export default class extends HttpClientApi {
  constructor(config = {}) {
    config.apiPath = 'api';
    return (async () => {
      await super(config)
      
      this.properties = {
        wallet: 'get',
        version: 'get',
        addresses: 'get',
        config: 'get',
        account: 'get',
        accounts: 'get',
        transaction: 'any',
        transactions: 'get',
        block: 'get',
        blocks: 'get'   
      }
      this.keys = Object.keys(this.properties)
      return this
    })()
    
  }
  
  async request(url, data) {
    return await this.client.request({url, params: data})
  }  
  
  async ready() {
    return await this.request('ready')
  }
  
  async version() {
    return await this.request('version')
  }
  
  async account(index) {
    return await this.request('account', {index})
  }
}