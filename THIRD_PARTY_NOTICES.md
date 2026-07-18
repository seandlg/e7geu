# Third-party notices

The QR scanner uses these runtime libraries:

- `@undecaf/barcode-detector-polyfill`, MIT License
- `qrcode`, MIT License
- `@undecaf/zbar-wasm`, LGPL-2.1-or-later

The ZBar WebAssembly work remains a replaceable, separately distributed library. Its source and license information are available from [undecaf/zbar-wasm](https://github.com/undecaf/zbar-wasm). The local package patch changes only the module import location so the browser loads the installed package rather than a CDN copy.
