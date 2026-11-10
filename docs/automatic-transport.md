# Peernet 4: app-scoped discovery and automatic transports

## Application-scoped discovery

Discovery configuration has only `network` and `protocolVersion`. The network is
`<stable-app-uuid>:<network-name>`. Generate a v4 UUID once per app, commit it and
reuse it across devices, releases and renames; never generate one per node.

```js
import Peernet, { createNetwork } from '@leofcoin/peernet'
import { APP_ID } from './app-id.js'

const node = await new Peernet({
  network: createNetwork(APP_ID, 'public'),
  protocolVersion: '1'
}, password)
```

Star creates groups automatically, with no per-app server config or UUID registry.
Apps with different UUIDs stay separate even with the same network name and wire
version. `PEERNET_APP_ID` is the built-in library app ID; custom apps create their
own ID. The library defaults to that ID's `public` mesh and wire version `v1`.
`protocol`, `version`, `networkVersion` and `discoveryNetwork` are removed, not
aliases. Incorrect old options fail explicitly.

These labels are not authentication or private-network access control. Updated
SDKs use binary `swarm-v3`; legacy discovery remains separate, without downgrade.
The Leofcoin chain wrapper supplies its bundled-genesis chain ID automatically.
The chain wrapper retains its ledger identity, signature domain, wallet and root.
Peernet's wallet is independent of discovery: new apps use a Leofcoin identity
or an injected `identity` provider. The generic default root is now
`.peernet/<app-id>/<network-name>`. Existing standalone apps must pass their
existing `root` and identity provider when upgrading; nothing migrates, resets
or overwrites stored wallets automatically. Non-chain apps omit `chainId`.

Deploy Swarm/Star 0.11 first. Peernet 4 requires `@netpeer/swarm@^0.11.0`;
rebuild/publish both runtimes before upgrading the chain and launcher.
The `release.yml` workflow stages the tested npm package with provenance. A
maintainer approves it in npm's Staged Packages tab with 2FA. It never approves
its own stage or needs direct-publish permission. Approve Swarm before building
and staging Peernet, since clean installs require its dependency to be public.
Until then, normal builds and startup deliberately reject the old unscoped
Swarm SDK. Cross-repository development can use
`PEERNET_LOCAL_SWARM_DIR=../swarm/exports npm run build`; this is a verification
override, not a published dependency. Chain and launcher dependency upgrades
follow the compatible Peernet release. All mesh participants must be upgraded;
old and new discovery groups do not interoperate.

## Existing transport baseline

Peernet 3 adopts the published `@netpeer/swarm@0.10.0` transport. Normal nodes keep
the same startup API and configured discovery stars; no WebTransport URL, relay
secret, public certificate or extra relay process is required on ordinary peers.
Explicit `transport` restrictions/overrides remain supported.

Release verification builds both Node and browser bundles, keeps native transport
loaders out of browser resolution, cleans stale generated chunks, and tests a
packed artifact in a clean npm installation with registry-only dependencies.

This is a major release because the supported Node runtime moves from 19+ to
**24.15+**, matching the new native backend and Leofcoin launcher. The canonical
codec-first message format from peernet 2 is unchanged. This release does not
regenerate genesis, change allocations, replace identities, or delete stores.

## Operators

Upgrade discovery infrastructure and peer software together for the new fallback
handshakes. Public stars running swarm 0.10 can host their relay within the star
process and advertise it only after QUIC is listening. Existing DNS, trusted TLS
and UDP firewall configuration are infrastructure prerequisites, not client setup.

WebRTC remains the default direct transport. A ready relay is discovered from the
configured star and used on fallback, with tickets requested over that same star
connection. Circuit fallback also requires an actual reciprocal handshake before
reporting a peer connected; larger circuit payloads use shared PeerCore chunking.

Transport connectivity is not proof of chain synchronization or finality. Check
real block/state synchronization and finalized transactions after public rollout.

## Leofcoin release order

Publish peernet 4 only after review and build/tests. Then update every monorepo
consumer's peernet minimum to `^4.0.0` using actual npm metadata and regenerate the
monorepo lockfile. Rebuild and verify a standalone launcher install before
publishing chain/launch-chain. Do not commit local tarball or Git overrides.
