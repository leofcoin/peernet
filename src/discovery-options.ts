import { normalizeNamespace, assertNetworkOptions, createNetwork, PEERNET_APP_ID } from '@netpeer/swarm/namespace'
export { createNetwork, PEERNET_APP_ID } from '@netpeer/swarm/namespace'

/** Only routing labels; wallet identities and storage roots are independent. */
export function discoveryOptions(options: {network?:string;protocolVersion?:string;chainId?:string}) {
  assertNetworkOptions(options)
  return normalizeNamespace({network:options.network ?? createNetwork(PEERNET_APP_ID,'public'),
    protocolVersion:options.protocolVersion ?? 'v1',...(options.chainId === undefined ? {} : {chainId:options.chainId})})
}
