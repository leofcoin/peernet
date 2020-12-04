import HttpClientApi from './api.js'

export default (config = {}) => {
  if (typeof config !== 'object') config = {}
  if (!config.protocol) config.protocol = 'peernet-v0.1.0'
  if (!config.port) config.port = 1000
  if (!config.host) config.host = '127.0.0.1'

  return new HttpClientApi(config)
}
