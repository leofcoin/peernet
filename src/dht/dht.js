import fetch from 'node-fetch'

/**
 * Keep history of fetched address and ptr
 * @property {Object} address
 * @property {Object} ptr
 */
const lastFetched = {
  address: {
    value: undefined,
    timestamp: 0,
  },
  ptr: {
    value: undefined,
    timestamp: 0,
  },
}

const getAddress = async () => {
  const {address} = lastFetched
  const now = Math.round(new Date().getTime() / 1000);
  if (now - address.timestamp > 1200000) {
    address.value = await fetch('https://icanhazip.com/')
    address.value = await address.value.text()
    address.timestamp = Math.round(new Date().getTime() / 1000);
    lastFetched.address = address;
  }

  return address.value
}

const degreesToRadians = (degrees) => {
  return degrees * Math.PI / 180;
}

const distanceInKmBetweenEarthCoordinates = (lat1, lon1, lat2, lon2) => {
  const earthRadiusKm = 6371;

  const dLat = degreesToRadians(lat2-lat1);
  const dLon = degreesToRadians(lon2-lon1);

  lat1 = degreesToRadians(lat1);
  lat2 = degreesToRadians(lat2);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return earthRadiusKm * c;
}

export default class DhtEarth {
  /**
   *
   */
  constructor() {
    this.providerMap = new Map();
  }

  /**
   * @param {Object} address
   * @return {Object} {latitude: lat, longitude: lon}
   */
  async getCoordinates(address) {
    // const {address} = parseAddress(provider)
    const request = `https://whereis.leofcoin.org/?ip=${address}`
    let response = await fetch(request)
    response = await response.json()
    const {lat, lon} = response;
    return {latitude: lat, longitude: lon}
  }

  /**
   * @param {Object} peer
   * @param {Object} provider
   * @return {Object} {provider, distance}
   */
  async getDistance(peer, provider) {
    const {latitude, longitude} = await this.getCoordinates(provider.address)
    return {provider, distance: distanceInKmBetweenEarthCoordinates(peer.latitude, peer.longitude, latitude, longitude)}
  }

  /**
   * @param {Array} providers
   * @return {Object} closestPeer
   */
  async closestPeer(providers) {
    let all = []
    const address = await getAddress();
    const peerLoc = await this.getCoordinates(address)

    for (const provider of providers) {
      all.push(this.getDistance(peerLoc, provider))
    }

    all = await Promise.all(all)

    const closestPeer = all.reduce((p, c) => {
      if (c.distance === NaN) c.distance = 0
      if (c.distance < p || p === 0) return c.provider;
    }, 0)

    return closestPeer;
  }

  /**
   * @param {String} hash
   * @return {Array} providers
   */
  providersFor(hash) {
    return this.providerMap.get(hash);
  }

  /**
   * @param {String} address
   * @param {String} hash
   * @return {Array} providers
   */
  async addProvider(address, hash) {
    let providers = [];
    if (this.providerMap.has(hash)) providers = this.providerMap.get(hash)

    providers = new Set([...providers, address])
    this.providerMap.set(hash, providers)
    return providers;
  }
}
