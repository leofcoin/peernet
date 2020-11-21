'use strict';

require('crypto');
var swarm = require('@geut/discovery-swarm-webrtc');
var wrtc = require('wrtc');
var PubSub = require('@vandeurenglenn/little-pubsub');
var sha256 = require('crypto-js/sha256');
var bs32 = require('bs32');
var MultiWallet = require('@leofcoin/multi-wallet');
var fetch$1 = require('node-fetch');
var websocket = require('websocket');
var http$1 = require('http');
var Koa = require('koa');
var protons = require('protons');
var bs58 = require('bs58');
var isHex = require('is-hex');
var varint = require('varint');
var createKeccakHash = require('keccak');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var swarm__default = /*#__PURE__*/_interopDefaultLegacy(swarm);
var wrtc__default = /*#__PURE__*/_interopDefaultLegacy(wrtc);
var PubSub__default = /*#__PURE__*/_interopDefaultLegacy(PubSub);
var sha256__default = /*#__PURE__*/_interopDefaultLegacy(sha256);
var bs32__default = /*#__PURE__*/_interopDefaultLegacy(bs32);
var MultiWallet__default = /*#__PURE__*/_interopDefaultLegacy(MultiWallet);
var fetch__default = /*#__PURE__*/_interopDefaultLegacy(fetch$1);
var Koa__default = /*#__PURE__*/_interopDefaultLegacy(Koa);
var protons__default = /*#__PURE__*/_interopDefaultLegacy(protons);
var bs58__default = /*#__PURE__*/_interopDefaultLegacy(bs58);
var isHex__default = /*#__PURE__*/_interopDefaultLegacy(isHex);
var varint__default = /*#__PURE__*/_interopDefaultLegacy(varint);
var createKeccakHash__default = /*#__PURE__*/_interopDefaultLegacy(createKeccakHash);

class DiscoPeer {
  constructor(id, connection) {
    this.id = id;
    this.connection = connection;
    
    this.connection.on('data', message => pubsub.publish('data', message));
  }
  
  request(data) {
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).slice(-12);
      data = Buffer.from(JSON.stringify({id, data}));
      const _onData = message => {
        message = JSON.parse(message.toString());
        if (message.id !== id) return
        
        resolve(message.data);        
      };
      
      pubsub.subscribe('data', _onData);
      
      // cleanup subscriptions
      setTimeout(() => {
        pubsub.unsubscribe('data', _onData);
      }, 5000);
      
      this.write(data);
    });
    
  }
  
  write(data) {
    this.connection.send(data);
  }
  
  on(event = 'data', cb) {
    pubsub.subscribe(event, cb);
    // this.connection.on(event, cb)
  }
  
  removeListener(event = 'data', cb) {
    pubsub.unsubscribe(event, cb);    
  }
}

globalThis.connections = new Map();
globalThis.pubsub = globalThis.pubsub || new PubSub__default['default']();

class socketDiscovery {
  constructor(options = {}) {
    if (!options.id) options.id = Buffer.from('00000000000000000000000000000000');
    
    this.id = options.id;
    
    this.sw = swarm__default['default']({
      id: options.id,
      bootstrap: ['wss://discovery-swarm.herokuapp.com', 'ws://localhost:4000'],
      simplePeer: {
        wrtc: wrtc__default['default']
      }
    });
     
    this.topic = Buffer.from(sha256__default['default']('peernet-v0.1.0').toString());
     
    this.sw.join(this.topic.slice(0, 32));
     
    const arrayOfPeers = this.sw.getPeers();
    
    this.sw.on('connection', async (connection, info) => {
      // connected
      const id = info.id.toString();
      if (id === this.id.toString()) return
      
      const channel = connection.channelName;
      let channels = [channel];
      let peer;
      if (connections.has(id)) {
        const value = connections.get(id);
        const _channels = value.channels;
        channels = [ ...channels, ..._channels ];
        peer = value.peer;
      } else {
        peer = new DiscoPeer(id, connection);
        pubsub.publish('peer:connected', peer);
      }
      connections.set(id, {channels, peer});
      // connection.on('data', (data) => console.log({data}))
      // connection.write('peerId')
    });
    
    this.sw.on('candidates-updated', async (channel, candidates) => {
      // TODO: Channels ...
      for (const candidate of candidates) {
        const id = candidate.toString();
        let channels = [channel];
        if (id === this.id.toString()) return
        console.log({id});
        
        if (!connections.has(id)) {
          const connection = await this.sw.connect(channel, candidate);
          const peer = new DiscoPeer(id, connection);
          connections.set(id, {channels, peer});
          pubsub.publish('peer:connected', peer);
        } else {
          const value = connections.get(id);
          const _channels = value.channels;
          channels = [ ...channels, ..._channels ];
          connections.set(id, {channels, peer: value.peer});
        }
      
      }
    });
    
    this.sw.on('connection-closed', (connection, info) => {
      setTimeout(() => {
        if (connections.has(info.id.toString())) connections.delete(info.id.toString());
      }, 500);
    });
    
    if (globalThis.onbeforeunload) globalThis.onbeforeunload = () => {
      this.sw.leave(this.topic);
      return setTimeout(() => {
        
      }, 1000)
    };
  }
  
  _peers() {
    return this.sw.getPeers()
  }
}

// const level = require('level');
const LevelStore = require('datastore-level');
const { homedir } = require('os');
const { join } = require('path');
const Key = require('interface-datastore').Key;
const {readdirSync, mkdirSync} = require('fs');

class LeofcoinStorage$1 {

  constructor(path, root = '.leofcoin', home = true) {
    if (!home) this.root = root;
    else this.root = join(homedir(), root);
    if (readdirSync) try {
      readdirSync(this.root);
    } catch (e) {
      let _path = home ? homedir() : root;
      const parts = root.split('/');
      if (e.code === 'ENOENT') {
        
        if (parts.length > 0) {
          for (const path of parts) {
            _path = join(_path, path);
            try {
              readdirSync(_path);
            } catch (e) {
              if (e.code === 'ENOENT') mkdirSync(_path);
              else throw e
            }
          }
        } else {
          mkdirSync(this.root);
        }
      } else throw e
    }
    this.db = new LevelStore(join(this.root, path));
    // this.db = level(path, { prefix: 'lfc-'})
  }
  
  toBuffer(value) {
    if (Buffer.isBuffer(value)) return value;
    if (typeof value === 'object' ||
        typeof value === 'boolean' ||
        !isNaN(value)) value = JSON.stringify(value);
        
    return Buffer.from(value)
  }
  
  async many(type, _value) {    
    const jobs = [];
    
    for (const key of Object.keys(_value)) {
      const value = this.toBuffer(_value[key]);
      
      jobs.push(this[type](key, value));
    }
    
    return Promise.all(jobs)
  }
  
  async put(key, value) {
    if (typeof key === 'object') return this.many('put', key);
    value = this.toBuffer(value);
        
    return this.db.put(new Key(String(key)), value);    
  }
  
  async query() {
    const object = {};
    
    for await (let query of this.db.query({})) {
      const key = query.key.baseNamespace();
      object[key] = this.possibleJSON(query.value);
    }
    
    return object
  }
  
  async get(key) {
    if (!key) return this.query()
    if (typeof key === 'object') return this.many('get', key);
    let data = await this.db.get(new Key(String(key)));
    if (!data) return undefined
        
    return this.possibleJSON(data)
  }
  
  async has(key) {
    if (typeof key === 'object') return this.many('has', key);
    
    try {
      await this.db.get(new Key(String(key)));
      return true;
    } catch (e) {
      return false
    }
  }
  
  async delete(key) {
    return this.db.delete(new Key(String(key)))
  }
  
  async size() {
    const object = await this.query();
    return Object.keys(object).length
  }
  
  possibleJSON(data) {
    let string = data.toString();
    if (string.charAt(0) === '{' && string.charAt(string.length - 1) === '}' || 
        string.charAt(0) === '[' && string.charAt(string.length - 1) === ']' ||
        string === 'true' ||
        string === 'false' ||
        !isNaN(string)) 
        return JSON.parse(string);
        
    if (isNaN(data)) return data.toString()
    return data
  }

}

var version = "0.1.0";

var api$1 = {
  version: ({send}) => send({client: '@peernet/api/http', version}),
  ready: ({send}) => {
    if (globalThis.states.ready) send(true);
    else pubsub.subscribe('ready', () => send(true));
  },
  storage: async (params, {send, error}) => {
    console.log(params);
    const { name, root, key, value, method } = params;
    try {
      if (name && root) {
        globalThis[name] = globalThis[name] || await new LeofcoinStorage(name, root);
      } else {
        return error('Expected name & root')
      }
      if (method === 'put') {
        await globalThis[name].put(key, value);
        return send('ok')
      } 
      if (method === 'remove') {
        await globalThis[name].remove(key, value);
        return send('ok')
      }
      value = await globalThis[name].get(key);
      return send(value)
    } catch (e) {
      return error(e)
    }
  },
  getConfig: async (params, {send, error}) => {
    try {
      const config = await api.getConfig(params);
      send(config);
    } catch (e) {
      error(e);
    }
  },
  setMinerConfig: async (params, {send, error}) => {
    try {
      await api.setMinerConfig(params);
      send('ok');
    } catch (e) {
      error(e);
    }
  },
  getMinerConfig: async ({send, error}) => {
    try {
      const config = await api.getMinerConfig();
      send(config);
    } catch (e) {
      error(e);
    }
  },
  wallet: async ({send}) => {
    const wallet = await walletStore.get();
    send(wallet);
  },
  addresses: async ({send, error}) => {
    try {
      const adresses = await api.addresses();
      send(adresses);
    } catch (e) {
      error(e);
    }
  },
  accountNames: async (params, {send, error}) => {
    try {
      const adresses = await api.accountNames(params.index);
      send(adresses);
    } catch (e) {
      error(e);
    }
  },
  accounts: async ({send}) => {
    const accounts = await accountStore.get();
    send(accounts);
  },
  account: async (params, {send}) => {
    const account = await accountStore.get(params);
    send(account);
  },
  balance: async (params, {send, error}) => {
    console.log('balance');
    try {
      console.log(await api.getBalanceForAddress(params.address));
      const value = await api.getBalanceForAddress(params.address);
      send(value);
    } catch (e) {
      console.log(e);
      error(e);
    }
  },  
  balanceAfter: async (params, {send, error}) => {
    try {
      const value = await api.getBalanceForAddressAfter(params.address, params.index);
      send(value);
    } catch (e) {
      error(e);
    }
  },
  mine: async (params, {send, error}) => {
    api.mine(params);
    send('ok');
  },
  lastBlock: async ({send, error}) => {
    try {
      const value = await api.lastBlock();
      send(value);
    } catch (e) {
      error(e);
    }
  }
};

const fullLog = text => {
  return console.log(`${new Date()}: ${text}`)
};

const originIsAllowed = (requestOrigin, origin) => {
  // put logic here to detect whether the specified origin is allowed.
  if (origin && requestOrigin !== origin) return false;
  return true;
};

/**
 * @module socketResponse
 *
 * @param {object} connection socket connection
 * @param {string} route the route to handle
 */
var socketConnection = (request, protocol, origin) => {  
	if (origin && !originIsAllowed(request.origin, origin)) {
		// Make sure we only accept requests from an allowed origin
		request.reject();
    fullLog(`Connection from origin ${request.origin} rejected.`);
		return;
	}
  // console.log(request);
  const connection = request.accept(protocol, request.origin);
  fullLog(`Connection accepted @${protocol}`);
  return connection;
};

/**
 * @module socketResponse
 *
 * @param {object} connection socket connection
 * @param {string} url the request url
 */
var socketResponse = (connection, url, id, customEvent) => {
  const send = (data = 'ok', status = 200) => connection.send(
    JSON.stringify({url, status, value: data, id, customEvent})
  );
  const error = data => connection.send(JSON.stringify({url, value: data}));
  return {
    connection,
    send,
    error
  }
};

const socketRequestServer = (options, routes = {}) => {
  // if (!routes && !routes.port && options) routes = options;
  // else if (!options && !routes) return console.error('no routes defined');

  let {httpServer, httpsServer, port, protocol, credentials, origin, pubsub } = options;
  if (!pubsub) pubsub = new PubSub__default['default']({verbose: false});
  if (!port) port = 6000;
  const connections = [];
  let connection;
  const startTime = new Date().getTime();
  // default routes
  if (!routes.ping) routes.ping = (response) => response.send(new Date().getTime());
    if (!routes.uptime) routes.uptime = (response) => {
      const now = new Date().getTime();
      response.send(now - startTime);
    };
    if (!routes.pubsub) {
      routes.pubsub = (params, response) => {
        if (!response) {
          response = params;
          params = {};
        }
        
        if (!params.topic) params.topic = 'pubsub';
                
        const topic = params.topic;
        delete params.topic;
        
        if (params.subscribe) {
          pubsub.subscribe(topic, message => {
            response.connection.send(JSON.stringify({url: topic, status: 200, value: message}));
          });
          response.send('ok', 200);
        } else if (params.unsubscribe) {
          pubsub.unsubscribe(topic, message => {
            response.connection.send(JSON.stringify({url: topic, status: 200, value: message}));
          });
          for (const connection of connections) {
            if (connection !== response.connection) connection.send(JSON.stringify({url: topic, status: 200, value: params}));
          }
          response.send('ok', 200);
        }
        else if (params.value !== undefined)
          // should only be send raw to stars
          // for (const connection of connections) {
            // if (connection !== response.connection) connection.send(JSON.stringify({
              // url: topic, status: 200, value: params
            // }));
          // }
          pubsub.publish(topic, params.value);
          response.send('ok', 200);
      };
      
    }
    globalThis.peerMap = new Map();
    if (!routes.peernet) {
      routes.peernet = (params, response) => {
        if (params.join) {
          peerMap.set(params.peerId, params.address);
          response.send([...peerMap.values()]);
          for (const connection of connections) {
            if (connection !== response.connection)
              socketResponse(connection, 'peernet', 'peernet').send({discovered: params.address});
          }
          return
        }
        if (!params.join) {
          peerMap.delete(params.peerId);
          return response.send()
        }
      };
    }
  // if (!protocol) protocol = 'echo-protocol';
  if (!httpServer && !httpsServer) {
    const { createServer } = credentials ? require('https') : require('http');
    if (credentials) httpServer = createServer(credentials);
    else httpServer = createServer();

    httpServer.listen(port, () => {
      console.log(`listening on ${port}`);
    });
  }

	const socketServer = new websocket.server({
  	httpServer,
  	autoAcceptConnections: false
	});

	socketServer.on('request', request => {

    connection = socketConnection(request, protocol, origin);
    connections.push(connection);

    const routeHandler = message => {
      let data;
      if (message.type) {
        switch (message.type) {
          case 'binary':
            data = message.binaryData.toString();
            break;
          case 'utf8':
            data = message.utf8Data;
            break;
        }
      }
      const { route, params, url, id, customEvent } = JSON.parse(data);
      // ignore api when customEvent is defined
      if (customEvent) return;
      if (routes[url]) {
        if (!params) return routes[url](socketResponse(connection, url, id));
        return routes[url](params, socketResponse(connection, url, id));
      }
      else return socketResponse(connection, url, id).error(`nop handler found for '${message.url}'`);
    };

    connection.on('message', routeHandler);
	});

  return {
    close: () => socketServer.shutDown(),
    connections
  };
};

var http = (config = {}) => {
  if (typeof config !== 'object') config = {};
  if (!config.protocol) config.protocol = 'peernet-v0.1.0';
  if (!config.port) config.port = 1000;
  if (!config.host) config.host = '127.0.0.1';
  
  const app = new Koa__default['default']();
  
  app.use(async ctx => {
    const url = ctx.url.split('/api/')[1];
    if (url === 'version') ctx.body = {client: '@peernet/api/http', version};
  });
  
  const httpServer = http$1.createServer(app.callback());
  
  config.httpServer = httpServer;
  
  httpServer.listen(config.port, () => {
    console.log(`listening on ${config.port}`);
  });
  
  return socketRequestServer(config, api$1)
};

var clientApi = _pubsub => {
  
  const subscribe = (topic, cb) => {
    _pubsub.subscribe(topic, cb);
  };
  
  const unsubscribe = (topic, cb) => {
    _pubsub.unsubscribe(topic, cb);
  };
  
  const publish = (topic, value) => {
    _pubsub.publish(topic, value);
  };
  
  const _connectionState = (state) => {
    switch (state) {
      case 0:
        return 'connecting'
      case 1:
        return 'open'
      case 2:
        return 'closing'
      case 3:
        return 'closed'
    }
  };
  /**
   * @param {string} type
   * @param {string} name
   * @param {object} params
   */
  const request = (client, request) => {
    return new Promise((resolve, reject) => {
      
      const state = _connectionState(client.readyState);
      if (state !== 'open') return reject(`coudn't send request to ${client.id}, no open connection found.`)
      
      request.id = Math.random().toString(36).slice(-12);
      const handler = result => {
        if (result && result.error) return reject(result.error)
        resolve({result, id: request.id, handler});
      };
      subscribe(request.id, handler);
      send(client, request);
    });
  };
  
  const send = async (client, request) => {
    return client.send(JSON.stringify(request))
  };

  const pubsub = client => {
    return {
      publish: (topic = 'pubsub', value) => {        
        return send(client, {url: 'pubsub', params: { topic, value }})
      },
      subscribe: (topic = 'pubsub', cb) => {
        subscribe(topic, cb);
        return send(client, {url: 'pubsub', params: { topic, subscribe: true }})
      },
      unsubscribe: (topic = 'pubsub', cb) => {
        unsubscribe(topic, cb);        
        return send(client, {url: 'pubsub', params: { topic, unsubscribe: true }})
      },
      subscribers: _pubsub.subscribers
    }
  };
  
  const server = (client) => {
    return {
      uptime: async () => {
        try {
          const { result, id, handler } = await request(client, {url: 'uptime'});        
          unsubscribe(id, handler);
          return result
        } catch (e) {
          throw e
        }
      },
      ping: async () => {
        try {
          const now = new Date().getTime();
          const { result, id, handler } = await request(client, {url: 'ping'});
          unsubscribe(id, handler);
          return (Number(result) - now)
        } catch (e) {
          throw e
        }
      }
    }
  };
  
  const peernet = (client) => {
    return {
      join: async (params) => {
        try {
          params.join = true;
          const requested = { url: 'peernet', params };
          const { result, id, handler } = await request(client, requested);        
          unsubscribe(id, handler);
          return result
        } catch (e) {
          throw e
        }
      },
      leave: async (params) => {
        try {
          params.join = false;
          const requested = { url: 'peernet', params };
          const { result, id, handler } = await request(client, requested);        
          unsubscribe(id, handler);
          return result
        } catch (e) {
          throw e
        }
      }
    }
  };
  
  return { send, request, pubsub, server, subscribe, unsubscribe, publish, peernet }
};

const socketRequestClient = (url, protocols = 'echo-protocol', options = { retry: false, pubsub: false }) => {
  let { pubsub, retry } = options;
  if (!pubsub) pubsub = new PubSub__default['default']({verbose: false});
  
  const api = clientApi(pubsub);
  
  let tries = 0;

  const onerror = error => {
    if (pubsub.subscribers['error']) {
      pubsub.publish('error', error);
    } else {
      console.error(error);
    }
  };

  const onmessage = message => {
    const {value, url, status, id} = JSON.parse(message.data.toString());
    const publisher = id ? id : url;
    if (status === 200) {
      pubsub.publish(publisher, value);
    } else {
      pubsub.publish(publisher, {error: value});
    }

  };  

  const clientConnection = client => {
    const startTime = new Date().getTime();
    return {
      client,
      request: async req => {
        const { result, id, handler } = await api.request(client, req);
        pubsub.unsubscribe(id, handler);
        return result
      },
      send: req => api.send(client, req),
      subscribe: api.subscribe,
      unsubscribe: api.unsubscribe,
      subscribers: api.subscribers,
      publish: api.publish,
      pubsub: api.pubsub(client),
      uptime: () => {
        const now = new Date().getTime();
        return (now - startTime)
      },
      peernet: api.peernet(client),
      server: api.server(client),
      close: exit => {
        client.onclose = message => {
          if (exit) process.exit();
        };
        client.close();
      }
    }
  };
  
  return new Promise((resolve, reject) => {
    const init = () => {
      let ws;
      if (typeof process === 'object') {
        ws = require('websocket').w3cwebsocket;
      } else {
        ws = WebSocket;
      }
      const client = new ws(url, protocols);

      client.onmessage = onmessage;
      client.onerror = onerror;
      client.onopen = () => {
        tries = 0;
        resolve(clientConnection(client));
      };
      client.onclose = message => {
        tries++;
        if (!retry) return reject(options)
        if (tries > 5) {
          console.log(`${protocols} Client Closed`);
          console.error(`could not connect to - ${url}/`);
          return resolve(clientConnection(client))
        }
        if (message.code === 1006) {
          console.log('Retrying in 10 seconds');
          setTimeout(() => {
            return init();
          }, retry);
        }
      };
    };
    return init();
  });
};

class HttpClientApi {
  constructor(config = {}) {
    if (!config.apiPath) config.apiPath = 'api';
    
    const address = `ws://${config.host}:${config.port}`;
    
    this.apiUrl = url => `${address}/${url}`;
    return (async () => {
      this.client = await socketRequestClient(address, config.protocol, {pubsub: config.pubsub, retry: 3000});
      return this
    })()
  }
  
  async get (url, obj) {
    const headers = {};
    let body = null;
    let method = 'GET';
    if (obj) {
      method = 'POST';
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(obj);
    }
    let response = await this.client.request(url, { headers, body, method });
    const type = response.headers.get('content-type').split(';')[0];
    if (type==='application/json') response = await response.json();
    return response
  }
  
  async put (url, obj) {
    const headers = {};
    let body = {};
    if (obj) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(obj);
    }
    
    let response = await fetch(this.apiUrl(url), { method: 'PUT', headers, body});
    const type = response.headers.get('content-type').split(';')[0];
    if (type==='application/json') response = await response.json();
    return response
  }
}

class HttpClientApi$1 extends HttpClientApi {
  constructor(config = {}) {
    config.apiPath = 'api';
    return (async () => {
      await super(config);
      
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
      };
      this.keys = Object.keys(this.properties);
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

var httpClient = (config = {}) => {
  if (typeof config !== 'object') config = {};
  if (!config.protocol) config.protocol = 'peernet-v0.1.0';
  if (!config.port) config.port = 1000;
  if (!config.host) config.host = '127.0.0.1';
    
  return new HttpClientApi$1(config)
};

class LeofcoinStorageClient {
  constructor(name, root) {
    this.name = name;
    this.root = root;
  }
  
  async get(key) {
    try {
      const result = await globalThis.peernet.client.request('storage', {
        name: this.name,
        root: this.root,
        key
      });
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
      });
      return result
    } catch (e) {
      console.log(e);
      return undefined
    }
  }
}

var proto = `
// PeernetMessage
message PeernetMessage {
  required bytes data = 1;
  required bytes signature = 2;
  optional bytes from = 3;
  optional bytes to = 4;
  optional string id = 5;
}`;

var codecs = {  
  // just a hash
  'disco-hash': {
    codec: '30',
    hashAlg: 'dbl-keccak-512'//,
    // testnet: 'olivia'
  },
  'peernet-dht': {
    codec: '706468',
    hashAlg: 'keccak-256'
  },
  'peernet-dht-response': {
    codec: '706472',
    hashAlg: 'keccak-256'
  },
  // data
  'peernet-data': {
    codec: '706461',
    hashAlg: 'keccak-256'
  },
  'peernet-data-response': {
    codec: '70646172',
    hashAlg: 'keccak-256'
  },
  // message
  'peernet-message': {
    codec: '706d65',
    hashAlg: 'keccak-512'
  },
  // normal block
  'leofcoin-block': {
    codec: '6c62',
    hashAlg: 'dbl-keccak-512'//,
    // testnet: 'olivia'
  },
  // itx
  'leofcoin-itx': {
    codec: '6c69',
    hashAlg: 'keccak-512'//,
    // testnet: 'olivia'
  },
  // peer reputation
  'leofcoin-pr': {
    codec: '6c70',
    hashAlg: 'keccak-256'//,
    // testnet: 'olivia'
  }
};

class PeernetCodec {
  constructor(buffer, _codecs) {
    if (_codecs) this.codecs = { ...codecs, ..._codecs};
    else this.codecs = codecs;
    if (buffer) {
      if (Buffer.isBuffer(buffer)) {
        const codec = varint__default['default'].decode(buffer);
        const name = this.getCodecName(codec);
        
        if (name) {
          this.name = name;
          this.encoded = buffer; 
          this.decode(buffer);
        } else {
          this.encode(buffer);
        }
        
        
      }
      if (typeof buffer === 'string') {
        if (this.codecs[buffer]) this.fromName(buffer);
        else if (isHex__default['default'](buffer)) this.fromHex(buffer);
        else if (bs32__default['default'].test(buffer)) this.fromBs32(buffer);
        else this.fromBs58(buffer);        
      } 
      if (!isNaN(buffer)) if (this.codecs[this.getCodecName(buffer)]) this.fromCodec(buffer);
    }
  }
  
  fromEncoded(encoded) {
    const codec = varint__default['default'].decode(encoded);
    const name = this.getCodecName(codec);
    this.name = name;
    this.encoded = encoded; 
    this.decode(encoded);
  }
  
  fromHex(hex) {
    this.encoded = Buffer.from(hex, 'hex');
    this.decode();
  }
  
  fromBs32(input) {
    this.encoded = bs32__default['default'].decode(input);
    this.decode();
  }
  
  fromBs58(input) {
    this.encoded = bs58__default['default'].decode(input);
    this.decode();
  }
  
  getCodec(name) {
    return this.codecs[name].codec
  }
  
  getCodecName(codec) {
    return Object.keys(this.codecs).reduce((p, c) => {
      if (parseInt(Buffer.from(`${this.getCodec(c)}`, 'hex').toString('hex'), 16) === codec) return c;
      else return p;
    }, undefined)
  }
  
  getHashAlg(name) {
    return this.codecs[name].hashAlg
  }
  
  fromCodec(codec) {    
    this.name = this.getCodecName(codec);
    this.hashAlg = this.getHashAlg(this.name);
    
    this.codec = this.getCodec(this.name);
    this.codecBuffer = Buffer.from(varint__default['default'].encode(parseInt(Buffer.from(`${this.codec}`, 'hex').toString('hex'), 16)), 'hex');
  }
  
  fromName(name) {
    const codec = this.getCodec(name);
    this.name = name;    
    this.codec = codec;
    this.hashAlg = this.getHashAlg(name);
    this.codecBuffer = Buffer.from(varint__default['default'].encode(parseInt(Buffer.from(`${codec}`, 'hex').toString('hex'), 16)), 'hex');
  }
  
  toBs32() {
    this.encode();
    return bs32__default['default'].encode(this.encoded)
  }
  
  toBs58() {
    this.encode();
    return bs58__default['default'].encode(this.encoded)
  }
  
  toHex() {
    return this.encoded.toString('hex')
  }
  
  decode() {
    const codec = varint__default['default'].decode(this.encoded);
    this.fromCodec(codec);
    this.name = this.getCodecName(codec);
  }
  
  encode() {
    const codec = Buffer.from(varint__default['default'].encode(parseInt(Buffer.from(`${this.codec}`, 'hex').toString('hex'), 16)), 'hex');
    this.encoded = codec;
    return this.encoded
  }
}

class DiscoHash {
  constructor(buffer, options = {}) {
    if (options.name) this.name = options.name;
    else this.name = 'disco-hash';
    if (options.codecs) this.codecs = options.codecs;
    if (buffer) {
      
      if (Buffer.isBuffer(buffer)) {
        this.discoCodec = new PeernetCodec(buffer, this.codecs);
        const name = this.discoCodec.name;
        
        if (name) {
          this.name = name;
          this.decode(buffer);
        } else {
          this.encode(buffer);
        }
      }
      
      if (typeof buffer === 'string') {
        if (isHex__default['default'](buffer)) this.fromHex(buffer);
        if (bs32__default['default'].test(buffer)) this.fromBs32(buffer);
        else this.fromBs58(buffer);
      } else if (typeof buffer === 'object') this.fromJSON(buffer);
    }
    
  }
  
  get prefix() {
    return Buffer.concat([this.discoCodec.codecBuffer, this.length])
  }
  
  get length() {
    return Buffer.from(varint__default['default'].encode(this.size))
  }
  
  get buffer() {
    return this.hash
  }
  
  toHex() {
    return this.hash.toString('hex')
  }
  
  fromHex(hex) {
    return this.decode(Buffer.from(hex, 'hex'))
  }
  
  fromJSON(json) {
    return this.encode(Buffer.from(JSON.stringify(json)))
  }
  
  toBs32() {
    return bs32__default['default'].encode(this.hash)
  }
  
  fromBs32(bs) {
    return this.decode(bs32__default['default'].decode(bs))
  }
  
  toBs58() {
    return bs58__default['default'].encode(this.hash)
  }
  
  fromBs58(bs) {
    return this.decode(bs58__default['default'].decode(bs))
  }
  
  toString(encoding = 'utf8') {
    return this.hash.toString(encoding)
  }
  
  encode(buffer, name) {
    if (!this.name && name) this.name = name;
    if (!buffer) buffer = this.buffer;
    this.discoCodec = new PeernetCodec(this.name, this.codecs);
    this.discoCodec.fromName(this.name);
    let hashAlg = this.discoCodec.hashAlg;
    if (hashAlg.includes('dbl')) {
      hashAlg = hashAlg.replace('dbl-', '');
      buffer = createKeccakHash__default['default'](hashAlg.replace('-', '')).update(buffer).digest();          
    }    
    this.digest = createKeccakHash__default['default'](hashAlg.replace('-', '')).update(buffer).digest();   
    this.size = this.digest.length;
    
    this.codec = this.discoCodec.encode();
    this.codec = this.discoCodec.codecBuffer;
    this.hash = Buffer.concat([
      this.prefix,
      this.digest
    ]);
    
    return this.hash
  }
  
  validate(buffer) {
    if (Buffer.isBuffer(buffer)) {
      const codec = varint__default['default'].decode(buffer);              
      if (this.codecs[codec]) {
        this.decode(buffer);
      } else {
        this.encode(buffer);
      }      
    }
    if (typeof buffer === 'string') {
      if (isHex__default['default'](buffer)) this.fromHex(buffer);
      if (bs32__default['default'].test(buffer)) this.fromBs32(buffer);
    }
    if (typeof buffer === 'object') this.fromJSON(buffer);
  }
  
  decode(buffer) {
    this.hash = buffer;
    const codec = varint__default['default'].decode(buffer);
    
    this.discoCodec = new PeernetCodec(codec, this.codecs);
    // TODO: validate codec
    buffer = buffer.slice(varint__default['default'].decode.bytes);        
    this.size = varint__default['default'].decode(buffer);
    this.digest = buffer.slice(varint__default['default'].decode.bytes);        
    if (this.digest.length !== this.size) {
      throw new Error(`hash length inconsistent: 0x${this.hash.toString('hex')}`)
    }
    
    // const discoCodec = new DiscoCodec(codec, this.codecs)
    
    this.name = this.discoCodec.name;
    
    
    this.size = this.digest.length;
    
    return {
      codec: this.codec,
      name: this.name,
      size: this.size,
      length: this.length,
      digest: this.digest
    }
  }
}

class FormatInterface {
  constructor(buffer, proto, options = {}) {    
    this.protoEncode = proto.encode;
    this.protoDecode = proto.decode;
    if (options.name) this.name = options.name;
    this.hashFormat = options.hashFormat || 'bs32';
    
    if (Buffer.isBuffer(buffer)) {
      const codec = new PeernetCodec(buffer);
      
      if (codec.name) {
        this.fromEncoded(buffer);
      } else {
        this.create(buffer);
      }        
    } else if (typeof buffer === 'string') {
      if (isHex__default['default'](buffer)) this.fromHex(buffer);
      else if (bs32__default['default'].test(buffer)) this.fromBs32(buffer);
      else this.fromBs58(buffer); 
    } else if (typeof buffer === 'object' && !Array.isArray(buffer)) {
      this.create(buffer);
    }
  }
  
  get peernetHash() {
    return new DiscoHash(this.decoded, {name: this.name})
  }
  
  get hash() {
    const upper = this.hashFormat.charAt(0).toUpperCase();
    const format = `${upper}${this.hashFormat.substring(1, this.hashFormat.length)}`;
    return this.peernetHash[`to${format}`]()
  }
    
  decode() {
    let encoded = this.encoded;
    const discoCodec = new PeernetCodec(this.encoded.toString('hex'));
    encoded = encoded.slice(discoCodec.codecBuffer.length);
    this.name = discoCodec.name;
    this.decoded = this.protoDecode(encoded);
    return this.decoded
  }
  
  encode(decoded) {    
    if (!decoded) decoded = this.decoded;
    const codec = new PeernetCodec(this.name);
    this.encoded = Buffer.concat([codec.codecBuffer, this.protoEncode(decoded)]);
    return this.encoded
  }
  
  fromEncoded(encoded) {
    const codec = new PeernetCodec(encoded);
    this.name = codec.name;
    this.encoded = encoded; 
    this.decode();
  }
  
  fromHex(hex) {
    this.encoded = Buffer.from(hex, 'hex');
    this.decode();
  }  
  
  fromBs32(input) {
    this.encoded = bs32__default['default'].decode(input);
    this.decode();
  }
  
  fromBs58(input) {
    this.encoded = bs58__default['default'].decode(input);
    this.decode();
  }
  
  toHex() {
    if(!this.encoded) this.encode();
    return this.encoded.toString('hex')
  }
  
  toBs32() {    
    if(!this.encoded) this.encode();
    return bs32__default['default'].encode(this.encoded)
  }
  
  toBs58() {    
    if(!this.encoded) this.encode();
    return bs58__default['default'].encode(this.encoded)
  }
  
  create(data) {
    this.decoded = data;
    this.encode(data);
  }
}

class PeernetMessage extends FormatInterface {
  
  get keys() {
    return [ 'data', 'signature', 'from', 'to', 'id' ]
  }
  
  constructor(buffer) {
    const name = 'peernet-message';
    super(buffer, protons__default['default'](proto).PeernetMessage, {name});
  }
}

var proto$1 = `
// PeernetDHTMessage
message PeernetDHTMessage {
  required string hash = 1;
}
`;

class DHTMessage extends FormatInterface {
  
  get keys() {
    return [ 'hash' ]
  }
  
  constructor(data) {
    const name = 'peernet-dht';
    super(data, protons__default['default'](proto$1).PeernetDHTMessage, {name});
  }
}

var proto$2 = `
// PeernetDHTMessageResponse
message PeernetDHTMessageResponse {
  required string hash = 1;
  required bool has = 2;
}
`;

class DHTMessageResponse extends FormatInterface {
  
  get keys() {
    return [ 'hash', 'has' ]
  }
  
  constructor(data) {
    const name = 'peernet-dht-response';
    super(data, protons__default['default'](proto$2).PeernetDHTMessageResponse, {name});
  }
}

var proto$3 = `
// PeernetDataMessage
message PeernetDataMessage {
  required string hash = 1;
}
`;

class DataMessage extends FormatInterface {
  
  get keys() {
    return [ 'hash' ]
  }
  
  constructor(data) {
    const name = 'peernet-data';
    super(data, protons__default['default'](proto$3).PeernetDataMessage, {name});
  }
}

var proto$4 = `
// PeernetDataMessageResponse
message PeernetDataMessageResponse {
  required string hash = 1;
  required bytes data = 2;
}
`;

class DataMessageResponse extends FormatInterface {
  
  get keys() {
    return [ 'hash', 'data' ]
  }
  
  constructor(data) {
    const name = 'peernet-data-response';
    super(data, protons__default['default'](proto$4).PeernetDataMessageResponse, {name});
  }
}

const lastFetched = {
  address: {
    value: undefined,
    timestamp: 0
  },
  ptr: {
    value: undefined,
    timestamp: 0
  }
};

const getAddress = async () => {
  const {address} = lastFetched;
  const now = Math.round(new Date().getTime() / 1000);
  if (now - address.timestamp > 300) {
    address.value = await fetch__default['default']('https://ipv6.icanhazip.com/');
    address.value = await address.value.text();
    address.timestamp = Math.round(new Date().getTime() / 1000);  
    lastFetched.address = address;
  }
  
  return address.value
};

const degreesToRadians = degrees => {
  return degrees * Math.PI / 180;
};

const distanceInKmBetweenEarthCoordinates = (lat1, lon1, lat2, lon2) => {
  var earthRadiusKm = 6371;

  var dLat = degreesToRadians(lat2-lat1);
  var dLon = degreesToRadians(lon2-lon1);

  lat1 = degreesToRadians(lat1);
  lat2 = degreesToRadians(lat2);
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2); 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return earthRadiusKm * c;
};

class DhtEarth {
  /**
   * 
   */
  constructor() {
    this.providerMap = new Map();
  }
  
  /**
   * 
   */
  async getCoordinates(provider) {
    const {address} = provider;
    // const {address} = parseAddress(provider)
    const request = `http://ip-api.com/json/${address}`;
    let response = await fetch__default['default'](request);
    response = await response.json();
    const { lat, lon } = response;
    return { latitude: lat, longitude: lon }
  }
  
  /**
   * 
   */
  async getDistance(peer, provider) {
    const { latitude, longitude } = await this.getCoordinates(provider.address);
    return {provider, distance: distanceInKmBetweenEarthCoordinates(peer.latitude,peer.longitude,latitude,longitude)}
  }
  
  /**
   * 
   */
  async closestPeer(providers) {
    let all = [];
    const address = await getAddress();
    const peerLoc = await this.getCoordinates(address);
    
    for (const provider of providers) {
      all.push(this.getDistance(peerLoc, provider));
    }
    
    all = await Promise.all(all);
    
    const closestPeer = all.reduce((p, c) => {
      if (c.distance === NaN) c.distance = 0;
      if (c.distance < p || p === 0) return c.provider;
    }, 0);
    
    return closestPeer;
  }
  
  /**
   * 
   */
  async providersFor(hash) {
    return this.providerMap.get(hash);
  }  
  
  /**
   * 
   */  
  async addProvider(address, hash) {
    let providers = [];
    if (this.providerMap.has(hash)) providers = this.providerMap.get(hash);
      
    providers = new Set([...providers, address]);
    this.providerMap.set(hash, providers);
    return providers;
  }
  
  
}

const debug = log => {
  if (globalThis.DEBUG) console.log(`%c ${log}`, 'color: #0080ff;');
};

globalThis.leofcoin = globalThis.leofcoin || {};
globalThis.peernet = globalThis.peernet || {};
const https = (() => {
  if (!globalThis.location) return false;
  return Boolean(globalThis.location.protocol === 'https:')
})();

class Peernet {
  constructor(options = {}) {
    this.network = options.network || 'leofcoin';
    const parts = this.network.split(':');
    
    if (!options.root) {
      if (parts[1])  options.root = `.${parts[0]}/peernet/${parts[1]}`;
      else options.root = `.${this.network}/peernet`;
    }
    
    // peernetDHT aka closesPeer by coordinates
    this.dht = new DhtEarth();
    
    this._init(options);
    
    this.peers = [];
    this.protos = {
      'peernet-message': PeernetMessage,
      'peernet-dht': DHTMessage,
      'peernet-dht-response': DHTMessageResponse,
      'peernet-data': DataMessage,
      'peernet-data-response': DataMessageResponse
    };
  }
  async hasDaemon() {
    try {
      let response = await fetch__default['default']('http://127.0.0.1:1000/api/version');
      response = await response.json();
      return Boolean(response.client === '@peernet/api/http')
    } catch (e) {
      return false
    }
  }
  
  async environment() {
    const _navigator = globalThis.navigator;
    if (!_navigator) {
      return 'node'
    } else if (_navigator && /electron/i.test(_navigator.userAgent)) {
      return 'electron'
    } else {
      return 'browser'
    }
  }

  async target() {
    let daemon = false;
    const environment = await this.environment();
    if (!https) daemon = await this.hasDaemon();

    return { daemon, environment }
  }
  
  async _init(options) {
    const { daemon, environment } = await this.target();
    if (daemon) {
      globalThis.peernet.client = await httpClient({protocol: 'peernet-v0.1.0', host: '127.0.0.1', port: 1000});
      globalThis.accountStore = globalThis.accountStore || await new LeofcoinStorageClient('lfc-account', options.root);
      globalThis.walletStore = globalThis.walletStore || await new LeofcoinStorageClient('lfc-wallet', options.root);
      globalThis.blockStore = globalThis.blockStore || await new LeofcoinStorageClient('lfc-block', options.root);
    } else {
      globalThis.accountStore = globalThis.accountStore || new LeofcoinStorage$1('lfc-account', options.root);
      globalThis.walletStore = globalThis.walletStore || new LeofcoinStorage$1('lfc-wallet', options.root);
      globalThis.blockStore = globalThis.blockStore || new LeofcoinStorage$1('lfc-block', options.root);
      
      if (environment !== 'browser') http();
    }
    
    const { walletId } = await accountStore.get('public');
    // peernet id
    options.id = Buffer.from(walletId.slice(0, 32));
    this.id = walletId;
    this.peerId = options.id;
    
    pubsub.subscribe('peer:connected', peer => {
      peer.on('data', message => this.protoHandler(message, peer));
      this.peers.push(peer);
    });
    this.client = new socketDiscovery(options);
  }
  
  protoFor(data) {
    if (!Buffer.isBuffer(data)) data = Buffer.from(data);
    const codec = new PeernetCodec(data);
    if (!codec.name) throw new Error('proto not found')
    const Proto = this.protos[codec.name];
    return new Proto(data)
  }
  
  async protoHandler(message, peer) {
    message = JSON.parse(message.toString());
    const id = message.id;
    message = new PeernetMessage(Buffer.from(message.data));
    
    const codec = new PeernetCodec(message.decoded.data);
    let Proto = this.protos[codec.name];
    
    let proto = new Proto(message.decoded.data);
    if (proto.name === 'peernet-dht') {
      const hash = proto.decoded.hash;
      const has = await this.has(hash);      
      const data = new DHTMessageResponse({hash, has});
      
      const message = {
        from: this.client.id,
        to: Buffer.from(peer.id),
        data: data.encoded
      };
      
      const signature = await this.hashAndSignMessage(message);
      
      const node = new PeernetMessage({
        ...message,
        signature
      });
      
      peer.write(Buffer.from(JSON.stringify({id, data: node.encoded})));
    } else if (proto.name === 'peernet-data') {
      const hash = proto.decoded.hash;
      const has = await blockStore.has(hash);
      if (has) {
        let data = await blockStore.get(hash);
        data = new DataMessageResponse({hash, data: Buffer.from(data)});
        const message = {
          from: this.client.id,
          to: Buffer.from(peer.id),
          data: data.encoded
        };
        const signature = await this.hashAndSignMessage(message);
        
        const node = new PeernetMessage({
          ...message,
          signature
        });
        
        peer.write(Buffer.from(JSON.stringify({id, data: node.encoded})));
      }
    }
    // PeernetDHTMessage()
    // PeernetDHTMessageResponse
    // pubsub.publish('socket-data', { message, peer })
  }
  
  /**
   * performs a walk and resolves first encounter
   */
  async walk(hash) {
    if (!hash) throw 'hash expected, received undefined'
    const data = new DHTMessage({hash});
    for (const peer of this.peers) {
      const message = {
        from: this.client.id,
        to: Buffer.from(peer.id),
        data: data.encoded
      };
      const hasher = new DiscoHash(message, { name: 'peernet-message' });
      const identity = await walletStore.get('identity');
      
      const wallet = new MultiWallet__default['default'](this.network);
      wallet.import(identity.multiWIF);
      const signature = wallet.sign(hasher.hash.slice(0, 32));
      
    
      const node = new PeernetMessage({
        ...message,
        signature
      });
      
      const result = await peer.request(node.encoded);
      
      let proto = this.protoFor(result.data);
      
      if (proto.name !== 'peernet-message') throw new Error('Nodes/Data should be send encapsulated by peernet-message')
      const from = proto.decoded.from;
      proto = this.protoFor(proto.decoded.data);
      
      if (proto.name !== 'peernet-dht-response') throw new Error(`Routing error: Received proto ${proto.name} expected peernet-dht-response`)

      const peerInfo = {
        family: peer.connection.remoteFamily || peer.connection.localFamily,
        address: peer.connection.remoteAddress || peer.connection.localAddress,
        port: peer.connection.remotePort || peer.connection.localPort,
        id: from
      };
      
      if (proto.decoded.has) this.dht.addProvider(peerInfo, proto.decoded.hash);
    }
  }
  
  
  async providersFor(hash) {
    let providers = await this.dht.providersFor(hash);
    // walk the network to find a provider
    if (!providers || providers.length === 0) {
      await this.walk(hash);
      providers = await this.dht.providersFor(hash);
      // second walk the network to find a provider
      if (!providers || providers.length === 0) {
        await this.walk(hash);
        providers = await this.dht.providersFor(hash);
      }
    }
    // undefined if no providers given
    return providers
  }
  
  async get(hash) {
    debug(`get ${hash}`);
    let data = await blockStore.has(hash);
    if (data) return await blockStore.get(hash)
    let providers = await this.providersFor(hash);
    if (!providers || providers.size === 0) throw `nothing found for ${hash}`
    debug(`found ${providers.size} for ${hash}`);
    
    // get closest peer on earth
    const closestPeer = await this.dht.closestPeer(providers);
    
    // get peer instance by id
    const id = closestPeer.id.toString();
    const closest = this.peers.filter((peer) => {
      if (peer.id.toString() === id) return peer
    });
    
    data = new DataMessage({hash});
    
    const message = {
      from: this.client.id,
      to: Buffer.from(id),
      data: data.encoded
    };
    
    const signature = await this.hashAndSignMessage(message);
    
    const node = new PeernetMessage({
      ...message,
      signature
    });
        
    data = await closest[0].request(node.encoded);
    let proto = this.protoFor(Buffer.from(data.data));
    proto = this.protoFor(proto.decoded.data);
    this.put(hash, proto.decoded.data);
    return proto.decoded.data
  }
  
  async put(hash, data) {
    return await blockStore.put(hash, data)
  }
  
  async has(hash) {
    return await blockStore.has(hash)
  }
  
  async hashAndSignMessage(message) {
    const hasher = new DiscoHash(message, { name: 'peernet-message' });
    const identity = await walletStore.get('identity');
    
    const wallet = new MultiWallet__default['default'](this.network);
    wallet.import(identity.multiWIF);
    return wallet.sign(hasher.hash.slice(0, 32))
  }
  
  // async block(index) {
  //   const _values = []
  //   for (const peer of this.peers) {
  //     const value = await peer.request({type: 'block', index})
  //     console.log(value);
  //   }
  // 
  // }
}

module.exports = Peernet;
