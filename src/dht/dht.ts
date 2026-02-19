export declare type DHTProvider = {
  address: string
  id: string
}

export declare type DHTProviderDistanceResult = {
  provider: DHTProvider
  /**
   * distance on earth between peers in km
   */
  distance: number
}

export declare type DHTProviderMapValue = { [index: string]: DHTProvider }

declare type Coordinates = {
  longitude: number
  latitude: number
}

/**
 * Keep history of fetched address and ptr
 * @property {Object} address
 * @property {Object} ptr
 */
const lastFetched = {
  address: {
    value: undefined,
    timestamp: 0
  },
  ptr: {
    value: undefined,
    timestamp: 0
  }
}

const fetchedCoordinates = {}

export const getAddress = async () => {
  const { address } = lastFetched
  if (!address) {
    const value = await fetch('https://icanhazip.com/')
    address.value = await value.text()
    address.timestamp = Math.round(new Date().getTime() / 1000)
    lastFetched.address = address
  }

  return address.value
}

const degreesToRadians = (degrees) => {
  return (degrees * Math.PI) / 180
}

const distanceInKmBetweenEarthCoordinates = (lat1, lon1, lat2, lon2) => {
  const earthRadiusKm = 6371

  const dLat = degreesToRadians(lat2 - lat1)
  const dLon = degreesToRadians(lon2 - lon1)

  lat1 = degreesToRadians(lat1)
  lat2 = degreesToRadians(lat2)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadiusKm * c
}

export default class DhtEarth {
  providerMap: Map<string, DHTProviderMapValue> = new Map()

  async getCoordinates(address: string): Promise<Coordinates> {
    if (!fetchedCoordinates[address]) {
      const request = `https://whereis.leofcoin.org/?ip=${address}`
      let response = await fetch(request)
      const { lat, lon } = (await response.json()) as { lat: number; lon: number }
      fetchedCoordinates[address] = { latitude: lat, longitude: lon }
    }
    return fetchedCoordinates[address]
  }

  /**
   * @param {Object} peer
   * @param {Object} provider
   * @return {Object} {provider, distance}
   */
  async getDistance(
    peer: { latitude: number; longitude: number },
    provider: DHTProvider
  ): Promise<DHTProviderDistanceResult> {
    const { latitude, longitude } = await this.getCoordinates(provider.address)
    return {
      provider,
      distance: distanceInKmBetweenEarthCoordinates(peer.latitude, peer.longitude, latitude, longitude)
    }
  }

  async closestPeer(providers: Array<any>): Promise<DHTProvider> {
    let all = []
    const address = await getAddress()
    const peerLoc = await this.getCoordinates(address)

    for (const provider of providers) {
      if (!provider.address || provider.address === '127.0.0.1' || provider.address === '::1')
        all.push({ provider, distance: 0 })
      else all.push(this.getDistance(peerLoc, provider))
    }

    // todo queue
    all = await Promise.all(all)
    all = all.sort((previous, current) => previous.distance - current.distance)
    return all[0].provider
  }

  hasProvider(hash: string): boolean {
    return this.providerMap.has(hash)
  }

  providersFor(hash: string): DHTProviderMapValue {
    let providers: DHTProviderMapValue
    if (this.providerMap.has(hash)) providers = this.providerMap.get(hash)
    return providers
  }

  addProvider(provider: DHTProvider, hash: string) {
    if (!provider.address) provider.address = '127.0.0.1'
    let providers: DHTProviderMapValue = {}
    if (this.providerMap.has(hash)) {
      providers = this.providerMap.get(hash)
    }
    providers[provider.id] = provider
    this.providerMap.set(hash, providers)
  }

  removeProvider(id: string, hash: string) {
    if (this.providerMap.has(hash)) {
      const providers = this.providerMap.get(hash)
      delete providers[id]
      this.providerMap.set(hash, providers)
    }
  }
}
