# Iroh browser collaboration architecture

Research date: 2026-07-24. Sources are current official iroh documentation,
API documentation, and first-party example repositories. Architecture statements
labelled **Inference** are recommendations derived from those sources rather than
claims made by iroh.

## Executive conclusion

A small, browser-only collaboration room is feasible with the same Rust-to-Wasm
pattern already used by Arcana:

1. one iroh `Endpoint` per open app instance;
2. one `Router` exposing `iroh-gossip` for room events and `iroh-blobs` for files;
3. one random room `TopicId`, plus one creator endpoint in a shareable join ticket;
4. a TypeScript/Svelte UI consuming a narrow `wasm-bindgen` wrapper.

The important caveat is that iroh's browser endpoints are not directly connected
today. Browsers cannot expose UDP sockets for iroh's hole punching, so **all browser
iroh traffic flows through a relay**, although it stays end-to-end encrypted. The
official docs explicitly recommend an application-specific Rust wrapper because
there is no packaged iroh Wasm npm module. The first-party examples already include
both a browser gossip chat and a browser blobs app. ([browser/Wasm support and
limitations](https://docs.iroh.computer/languages/wasm-browser), [official browser
examples](https://github.com/n0-computer/iroh-examples))

## Relevant upstream facts

### Endpoint, addressing, and relay model

- An endpoint is the normal connection-level object; iroh recommends a single
  endpoint per application so protocols share its connections. Endpoint IDs are
  Ed25519 public keys and QUIC connections are authenticated and end-to-end
  encrypted. A `Router` multiplexes independent application protocols on the same
  endpoint by ALPN. ([endpoints](https://docs.iroh.computer/concepts/endpoints),
  [protocol composition](https://docs.iroh.computer/what-is-iroh))
- A new endpoint gets a random identity by default. To keep the same Endpoint ID
  across launches, the application must persist and restore its `SecretKey`.
  ([endpoint identities](https://docs.iroh.computer/concepts/endpoints))
- An Endpoint ID identifies a peer but is not, by itself, dialing information.
  Address lookup can resolve its current relay/direct addresses. Without address
  lookup, the app must retain a full `EndpointAddr` or endpoint ticket; relay URLs
  and direct addresses can become stale. ([endpoint addressing](https://docs.iroh.computer/concepts/endpoints))
- Native iroh tries direct paths and falls back to relays, but browser iroh is
  categorically relay-only today. Relay nodes route encrypted packets and do not
  store application data. ([browser limitations](https://docs.iroh.computer/languages/wasm-browser),
  [relay architecture](https://docs.iroh.computer/concepts/relays))
- The default public relays are intended for development and hobby use, are
  rate-limited, and have no uptime or performance guarantee. Production browser
  file transfer or media would require accepting those constraints or using a
  dedicated/self-hosted relay. Relays can observe connection metadata even though
  they cannot read payloads. ([public relay policy](https://docs.iroh.computer/iroh-services/relays/public))

### Chat and room membership with gossip

- `iroh-gossip` is browser-buildable and the official browser-chat example is a
  TypeScript UI over a `wasm-bindgen` wrapper around a shared Rust `ChatNode`. It
  describes itself as a simple **ephemeral** gossip chat. ([browser support](https://docs.iroh.computer/languages/wasm-browser),
  [browser-chat example](https://github.com/n0-computer/iroh-examples/tree/main/browser-chat))
- Each room can be one 32-byte `TopicId`. The official guidance says one topic for
  everyone who should receive every message scales to a few thousand peers, far
  beyond this four-person use case. Joining requires at least one bootstrap peer
  already in the topic; an endpoint ticket can carry the dialing information.
  ([gossip guide](https://docs.iroh.computer/connecting/gossip))
- A topic is a broadcast tree with separate membership. Participants relay messages
  from other peers, and default gossip maintains up to five peer connections per
  topic. ([gossip API](https://docs.rs/iroh-gossip/latest/iroh_gossip/net/struct.Gossip.html))
- Gossip is deliberately weaker than a durable message queue: peers can join,
  leave, or drop messages; broadcast is probabilistic/eventual, and a lagging
  receiver can miss messages. Messages queued before the first connection can also
  be dropped if the internal channel fills. ([gossip semantics](https://docs.iroh.computer/connecting/gossip),
  [`Lagged` event](https://docs.rs/iroh-gossip/latest/iroh_gossip/api/enum.Event.html),
  [join/queue behavior](https://docs.rs/iroh-gossip/latest/iroh_gossip/net/struct.Gossip.html))

### Files with blobs

- `iroh-blobs` transfers opaque, content-addressed bytes identified by a BLAKE3 root
  hash. Transfers are streaming and incrementally verified; the protocol supports
  ranges and resumable downloads. An endpoint may be both provider and requester.
  ([blobs protocol](https://docs.iroh.computer/protocols/blobs))
- A blob ticket combines the content hash with provider dialing information. A
  downloader can expose progress events and the downloader can coordinate multiple
  sources. ([blobs tutorial](https://docs.iroh.computer/protocols/blobs))
- The first-party examples include `browser-blobs`, demonstrating that the protocol
  can be wrapped for browser use. ([browser-blobs example](https://github.com/n0-computer/iroh-examples/tree/main/browser-blobs))
- Relays do not retain files. Therefore, in a browser-only room, a file remains
  fetchable only while at least one browser that has the blob is online and serving
  it, unless the application adds an explicit persistent provider. This is an
  **inference** from the provider/requester blob model and stateless relay design.

### Persistence and offline behavior

- Gossip is a live broadcast substrate, not chat history or an offline inbox. The
  official browser chat is explicitly ephemeral. Local UI history and endpoint
  identity therefore need browser persistence such as IndexedDB if they should
  survive reloads; cross-device catch-up requires an additional sync protocol.
  ([browser-chat example](https://github.com/n0-computer/iroh-examples/tree/main/browser-chat),
  [endpoint identity persistence](https://docs.iroh.computer/concepts/endpoints))
- `iroh-docs` is the upstream durable-sync composition: docs metadata reconciles,
  blobs hold values, and gossip announces live updates. Its documented persistent
  implementations use filesystem storage (`redb` and an `FsStore`), while the
  Wasm page only expressly identifies gossip as browser-supported and the example
  suite does not show browser docs. **Inference:** do not make `iroh-docs` part of
  the first browser MVP without a focused Wasm/storage spike. ([documents protocol](https://docs.iroh.computer/protocols/documents),
  [Wasm protocol status](https://docs.iroh.computer/languages/wasm-browser))
- Closing or suspending the browser page removes its live endpoint. With no server
  storing room state, nobody can deliver to an offline participant and a room with
  no open participants has no live bootstrap node. This is an **inference** from
  browser lifecycle, gossip bootstrap requirements, and stateless relays.

## Recommended minimal room protocol

The narrow Wasm wrapper can expose a single `CollaborationNode`:

```text
spawn(saved_secret_key?) -> endpoint_id
create_room(display_name) -> join_ticket
join_room(ticket, display_name)
events() -> stream<RoomEvent>
send_chat(text)
offer_file(bytes, name, media_type) -> FileOffer
download_file(offer) -> stream<DownloadProgress>
leave()
```

Internally it owns one endpoint, one router, one gossip instance/topic, and one
in-memory blob store. A join ticket should carry at least a random room/topic ID and
one or more bootstrap endpoint tickets. Room messages are signed structured data,
not HTML:

```text
Presence      { participant, displayName, generation }
Chat          { id, sender, sentAt, text }
FileOffered   { id, sender, name, size, mediaType, hash, providers }
FileAvailable { fileId, provider }
```

For the smallest useful MVP, keep chat and files ephemeral. Store only the local
Endpoint secret, display name, and optional local transcript in IndexedDB. A
participant announces a file offer over gossip; each interested peer pulls the
content from the announced provider through blobs. Once downloaded, a peer may
announce itself as another provider if the browser blob store supports serving that
copy.

The invitation is a bearer capability, not an account. Use a cryptographically
random room ID and validate that every application message is signed by its claimed
Endpoint ID. If removal/revocation is required, add an explicit room membership
protocol and endpoint allowlist; iroh exposes connection hooks for rejecting peers,
but it does not supply application-level room authorization automatically.
([connection admission hooks](https://docs.iroh.computer/about/faq))

## What 2, 3, and 4 participants look like

| People | Gossip/chat                                                                                                                                                                                                                | File transfer                                                                                                       |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 2      | Creator is the bootstrap; joiner connects and both subscribe to one topic.                                                                                                                                                 | Receiver pulls once from sender.                                                                                    |
| 3      | Third peer needs any live member as bootstrap; gossip discovers/maintains the room overlay and broadcasts once at the API level.                                                                                           | One sender normally serves two recipient downloads; a completed recipient can become another source if implemented. |
| 4      | Same topic and ticket model. Default gossip allows up to five neighbor connections per peer, so four is comfortably inside its intended small-room shape; application code must not rely on a particular overlay topology. | One sender normally serves three recipient downloads, possibly distributed among providers.                         |

All iroh connections in that table are relay-carried when both endpoints are browser
pages. Gossip prevents application code from manually broadcasting chat to every
peer, but it does not make file bytes a single-copy multicast.

## Scope recommendation

1. **Phase 1:** ephemeral room, presence, chat, and blob file offers/downloads.
2. **Phase 2:** persist local identity and recent transcript in IndexedDB if room
   continuity across reloads becomes important.
3. **Phase 3:** add multiple file providers or a persistent provider only if files
   must survive the original sender leaving.

This keeps the product stateless and reuses the existing Arcana deployment pattern,
while keeping the product focused on chat and peer-owned files.
