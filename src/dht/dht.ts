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

const fetchedCoordinates = {}

const getAddress = async () => {
  const {address} = lastFetched
  if (address) {
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
  providerMap = new Map<string, Set<string>>

  /**
   *
   */
  constructor() {
    this.providerMap = new Map();
  }
  async getCoordinates(address: string): Promise<object> {
    if (!fetchedCoordinates[address]) {
      const request = `https://whereis.leofcoin.org/?ip=${address}`
      let response = await fetch(request)
      response = await response.json()
      const {lat, lon} = response;
      fetchedCoordinates[address] = {latitude: lat, longitude: lon}
    }
    return fetchedCoordinates[address]
  }

  /**
   * @param {Object} peer
   * @param {Object} provider
   * @return {Object} {provider, distance}
   */
  async getDistance(peer: object, provider: object): object {
    const {latitude, longitude} = await this.getCoordinates(provider.address)
    return {provider, distance: distanceInKmBetweenEarthCoordinates(peer.latitude, peer.longitude, latitude, longitude)}
  }

  async closestPeer(providers: Array<any>): object {
    let all = []
    const address = await getAddress();
    const peerLoc = await this.getCoordinates(address)
    for (const provider of providers) {
      if (provider.address === '127.0.0.1' || provider.address === '::1') all.push({provider, distance: 0})
      else all.push(this.getDistance(peerLoc, provider))
    }

    all = await Promise.all(all);
    all = all.sort((previous, current) => previous.distance - current.distance)
    return all[0].provider;
  }

  hasProvider(hash: string): boolean {
    return this.providerMap.has(hash)
  }

  providersFor(hash: string): string[] {
    let providers = []
    if (this.providerMap.has(hash)) providers = [...this.providerMap.get(hash)]
    return providers
  }

  addProvider(address: string, hash: string): string[] {
    let providers:Set<string> = new Set()
    if (this.providerMap.has(hash)) {
      providers = this.providerMap.get(hash)
    }
    providers.add(address)
    this.providerMap.set(hash, providers)
  }

  removeProvider(address: string, hash: string): true | undefined {
    let deleted = undefined
    if (this.providerMap.has(hash)) {
      const providers = this.providerMap.get(hash)
      deleted = providers.delete(address) 
      deleted && this.providerMap.set(hash, providers)
    }
    return deleted;
  }
}
