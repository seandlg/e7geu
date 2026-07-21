# Arcana Iroh bridge

This narrow Rust crate exposes the Iroh endpoint operations Arcana needs: receive a private request, respond to it, and make an acknowledged request to a host endpoint. The checked-in browser bindings under `apps/web/static/iroh` let the normal static web build run without a Rust toolchain.

Rebuild the bindings with Rust 1.96+, Clang, LLD, and `wasm-bindgen-cli` 0.2.121:

```sh
cargo build --manifest-path crates/arcana-iroh/Cargo.toml --target wasm32-unknown-unknown --release
wasm-bindgen crates/arcana-iroh/target/wasm32-unknown-unknown/release/arcana_iroh.wasm --out-dir apps/web/static/iroh --target web --weak-refs
```
