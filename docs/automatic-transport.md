# Peernet 3: automatic relay discovery

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

Publish peernet 3 only after review and build/tests. Then update chain's peernet
minimum to `^3.0.0` using the actual npm registry metadata and regenerate the
monorepo lockfile. Rebuild and verify a standalone launcher install before
publishing chain/launch-chain. Do not commit local tarball or Git overrides.
