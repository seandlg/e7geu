# Third-party notices

The QR scanner uses these runtime libraries:

- `@undecaf/barcode-detector-polyfill`, MIT License
- `qrcode`, MIT License
- `@undecaf/zbar-wasm`, LGPL-2.1-or-later

The ZBar WebAssembly work remains a replaceable, separately distributed library. Its source and license information are available from [undecaf/zbar-wasm](https://github.com/undecaf/zbar-wasm). The local package patch changes only the module import location so the browser loads the installed package rather than a CDN copy.

Arcana's networking bridge uses `iroh` and its transitive Rust dependencies. Iroh is distributed under the MIT or Apache-2.0 licenses. Its source and license information are available from [n0-computer/iroh](https://github.com/n0-computer/iroh). The browser bridge is based on Iroh's dual-licensed browser examples and is shipped as a separately generated WebAssembly module.

The Background Remover uses these runtime libraries and model assets:

- `@huggingface/transformers`, Apache-2.0 License
- `onnxruntime-web`, MIT License
- U²-NetP model and configuration, Apache-2.0 License

The U²-NetP files are pinned from [`BritishWerewolf/U-2-Netp`](https://huggingface.co/BritishWerewolf/U-2-Netp/tree/7112208dbac3a3642496c8d54e2f0f9bb3dc1dc8). The distributed ONNX model has SHA-256 `309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8`. Its Apache-2.0 license text is shipped alongside the model. The architecture originates from [xuebinqin/U-2-Net](https://github.com/xuebinqin/U-2-Net).

The same-origin WebAssembly runtime is pinned from `onnxruntime-web@1.26.0-dev.20260416-b7804b056c`. The Asyncify module used by most browsers has SHA-256 `e0c0c6d3e73d43b8a249972f8358f845b08cc16fec3c80efafdf8bed40366786`; the Safari module has SHA-256 `f4f290847a4df02d0b93cdbf39b4b0e71acefbe80573e7e6b9342a7abd7b290a`.
