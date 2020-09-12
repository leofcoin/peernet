import api from './api.js'
import server from './../../node_modules/socket-request-server/src/index'
import { createServer } from 'http'
import Koa from 'koa'
import {version} from './../../package.json'
export default (config = {}) => {
  if (typeof config !== 'object') config = {}
  if (!config.protocol) config.protocol = 'peernet-v0.1.0'
  if (!config.port) config.port = 1000
  if (!config.host) config.host = '127.0.0.1'
  
  const app = new Koa()
  
  app.use(async ctx => {
    const url = ctx.url.split('/api/')[1]
    if (url === 'version') ctx.body = {client: '@peernet/api/http', version}
  })
  
  const httpServer = createServer(app.callback())
  
  config.httpServer = httpServer
  
  httpServer.listen(config.port, () => {
    console.log(`listening on ${config.port}`);
  });
  
  return server(config, api)
}