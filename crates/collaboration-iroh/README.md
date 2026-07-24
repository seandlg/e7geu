# Collaboration Iroh bridge

This application-specific Rust-to-WebAssembly bridge provides the collaboration
mini-app with an ephemeral signed gossip room and a bounded-memory live file
stream over an authenticated Iroh protocol. Files stay in the sender's browser
and are never imported into a blob store. The generated browser bindings are
checked into `apps/web/static/iroh` so the normal static web build does not
require Rust.

Rebuild the bindings with Rust 1.96+, Clang, LLD, and
`wasm-bindgen-cli` 0.2.121:

```sh
cargo build --manifest-path crates/collaboration-iroh/Cargo.toml --target wasm32-unknown-unknown --release
wasm-bindgen crates/collaboration-iroh/target/wasm32-unknown-unknown/release/collaboration_iroh.wasm --out-dir apps/web/static/iroh --out-name collaboration_iroh --target web --weak-refs
```
