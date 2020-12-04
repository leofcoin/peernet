import {version} from './../../package.json'

export default {
  version: ({send}) => send({client: '@peernet/api/http', version}),
  ready: ({send}) => {
    if (globalThis.states.ready) send(true)
    else pubsub.subscribe('ready', () => send(true))
  },
  storage: async (params, {send, error}) => {
    console.log(params);
    const {name, root, key, value, method} = params
    try {
      if (name && root) {
        globalThis[name] = globalThis[name] || await new LeofcoinStorage(name, root)
      } else {
        return error('Expected name & root')
      }
      if (method === 'put') {
        await globalThis[name].put(key, value)
        return send('ok')
      }
      if (method === 'remove') {
        await globalThis[name].remove(key, value)
        return send('ok')
      }
      value = await globalThis[name].get(key)
      return send(value)
    } catch (e) {
      return error(e)
    }
  },
  getConfig: async (params, {send, error}) => {
    try {
      const config = await api.getConfig(params)
      send(config)
    } catch (e) {
      error(e)
    }
  },
  setMinerConfig: async (params, {send, error}) => {
    try {
      await api.setMinerConfig(params)
      send('ok')
    } catch (e) {
      error(e)
    }
  },
  getMinerConfig: async ({send, error}) => {
    try {
      const config = await api.getMinerConfig()
      send(config)
    } catch (e) {
      error(e)
    }
  },
  wallet: async ({send}) => {
    const wallet = await walletStore.get()
    send(wallet)
  },
  addresses: async ({send, error}) => {
    try {
      const adresses = await api.addresses()
      send(adresses)
    } catch (e) {
      error(e)
    }
  },
  accountNames: async (params, {send, error}) => {
    try {
      const adresses = await api.accountNames(params.index)
      send(adresses)
    } catch (e) {
      error(e)
    }
  },
  accounts: async ({send}) => {
    const accounts = await accountStore.get()
    send(accounts)
  },
  account: async (params, {send}) => {
    const account = await accountStore.get(params)
    send(account)
  },
  balance: async (params, {send, error}) => {
    console.log('balance');
    try {
      console.log(await api.getBalanceForAddress(params.address));
      const value = await api.getBalanceForAddress(params.address)
      send(value)
    } catch (e) {
      console.log(e);
      error(e)
    }
  },
  balanceAfter: async (params, {send, error}) => {
    try {
      const value = await api.getBalanceForAddressAfter(params.address, params.index)
      send(value)
    } catch (e) {
      error(e)
    }
  },
  mine: async (params, {send, error}) => {
    api.mine(params)
    send('ok')
  },
  lastBlock: async ({send, error}) => {
    try {
      const value = await api.lastBlock()
      send(value)
    } catch (e) {
      error(e)
    }
  },
}
