# Stack research and architecture implications

Research date: 2026-07-18. Sources are official documentation and upstream source repositories.

## Recommendation in one page

- Build one deployable SvelteKit application in the monorepo, with routes such as `/`, `/apps/qr`, and `/apps/speedometer`. Keep each mini-app as a vertical feature module (UI plus its browser-API adapter and tests), and keep the launcher driven by a small typed app registry. Do not create shared packages until code has a second real consumer.
- Generate a fully static site with `@sveltejs/adapter-static` and prerender the routes. Browser-only work belongs in `onMount`, event handlers, or code guarded with SvelteKit's `browser` value. Do **not** set `ssr = false` globally just because the deployed app has no backend: SvelteKit documents significant startup, accessibility, and SEO costs for SPA mode and recommends prerendering where possible. ([SvelteKit SPA guidance](https://svelte.dev/docs/kit/single-page-apps), [adapter-static](https://svelte.dev/docs/kit/adapter-static))
- Use SvelteKit's native `src/service-worker.ts` integration for offline behavior. SvelteKit bundles and registers that file automatically and exposes generated build assets, static files, and a version through `$service-worker`; this is safer than retaining a hand-maintained list of hashed build artifacts. ([SvelteKit service workers](https://svelte.dev/docs/kit/service-workers))
- Deploy the static output to Vercel. `adapter-static` explicitly has zero-config support for Vercel and should be configured without adapter options there. If a backend is introduced later, switch to `@sveltejs/adapter-vercel`; Vercel recommends installing that adapter explicitly for version stability when using its server/edge features. ([adapter-static zero-config support](https://svelte.dev/docs/kit/adapter-static#zero-config-support), [SvelteKit on Vercel](https://vercel.com/docs/frameworks/full-stack/sveltekit))

## Vite+ as the only project toolchain

- Treat Vite+ as a global `vp` launcher plus a repository-local `vite-plus` dependency. The local dependency makes the toolchain reproducible. Put shared Vite, Vitest, Oxlint, Oxfmt, and Vite Task policy in the root `vite.config.ts` using `defineConfig` from `vite-plus`; app-local Vite settings may live with the app. ([getting started](https://viteplus.dev/guide/), [configuration](https://viteplus.dev/config/), [monorepos](https://viteplus.dev/guide/monorepo))
- Use the built-ins directly: `vp dev`, `vp build`, `vp preview`, `vp check`, and `vp test`. `vp check` combines formatting, linting, and TypeScript checks; enable `lint.options.typeAware` and `lint.options.typeCheck`. `vp test` is bundled Vitest and runs once by default, with `vp test watch` for development. ([check](https://viteplus.dev/guide/check), [test](https://viteplus.dev/guide/test), [command precedence](https://viteplus.dev/guide/troubleshooting))
- Use `vp install`, `vp add`, `vp add -D`, `vp remove`, and `vp update`, and commit the lockfile. Vite+ detects pnpm from `packageManager`, `devEngines.packageManager`, or a pnpm workspace/lockfile and manages the selected pnpm version; use `vp install --frozen-lockfile` in CI. ([dependency management](https://viteplus.dev/guide/install), [CI](https://viteplus.dev/guide/ci))
- Use root-configured Vite Tasks for workflows that need caching, dependency edges, inputs/outputs, or environment tracking. Configured tasks cache by default; package scripts do not. Long-running dev tasks must set `cache: false`. ([task runner](https://viteplus.dev/guide/run), [task configuration](https://viteplus.dev/config/run), [caching](https://viteplus.dev/guide/cache))
- Let `vp env` select Node. Resolution checks `.node-version`, then `devEngines.runtime`, then `engines.node`, then Vite+'s default/latest LTS. Since the project explicitly accepts churn, `vp env pin latest` expresses that policy in version control; `vp env current` and `vp env doctor` make it inspectable. ([environment management](https://viteplus.dev/guide/env))
- Modern Node can execute `.ts` containing erasable TypeScript syntax, but it does not type-check, ignores `tsconfig.json` (including `paths`), does not support TSX, and rejects TypeScript constructs that require code generation unless transform mode is enabled. This is suitable for small repository scripts, not browser application compilation; SvelteKit/Vite plus `vp check` remains the app pipeline. ([Node TypeScript support](https://nodejs.org/api/typescript.html))

Suggested `AGENTS.md` command contract:

```text
vp install [--frozen-lockfile]
vp add <package> / vp add -D <package> / vp remove <package>
vp dev [app-directory]
vp check [--fix]
vp test / vp test watch
vp build [app-directory]
vp run <task> [--filter ...]
vp env current / vp env doctor
```

Avoid direct `npm`, `pnpm`, `npx`, standalone `vite`/`vitest`, ESLint, or Prettier commands unless a documented escape hatch is required.

## UnoCSS with SvelteKit

- Install the Vite integration from `unocss`, put `UnoCSS()` before `sveltekit()` in `vite.config.ts`, create `uno.config.ts`, and import `virtual:uno.css` once from the root layout. UnoCSS scans `.svelte` files in the Vite build pipeline by default. ([UnoCSS Vite integration](https://unocss.dev/integrations/vite), [extraction defaults](https://unocss.dev/guide/extracting))
- Add `@unocss/extractor-svelte` only if using Svelte class directives such as `class:active`; ordinary `class="..."` utilities do not justify the extra dependency. The official SvelteKit example specifically configures the extractor for class-directive syntax. ([UnoCSS SvelteKit guidance](https://unocss.dev/integrations/vite#sveltekit))
- Prefer the regular global Vite plugin for this application. The separate scoped-Svelte integration has distinct limitations and is mainly relevant to component-library/scoped-output needs. ([Svelte scoped integration](https://unocss.dev/integrations/svelte-scoped))

## Reusing `seandlg/web-qr-scanner`

Inspection target: commit [`868af9d1e6251a7458ce5a1d3f2bf2d0fccb4bda`](https://github.com/seandlg/web-qr-scanner/tree/868af9d1e6251a7458ce5a1d3f2bf2d0fccb4bda), dated 2026-06-18.

What is worth porting into a Svelte feature module:

- The implementation selects native `BarcodeDetector` when available and otherwise uses the WASM polyfill, requests the environment-facing camera, enumerates/switches cameras, filters secondary phone lenses, checks torch capability, throttles detection to five passes per second, scans uploaded images, vibrates on success, validates HTTP(S) before offering to open a result, generates QR codes, and stores bounded local history. ([scanner source](https://github.com/seandlg/web-qr-scanner/blob/868af9d1e6251a7458ce5a1d3f2bf2d0fccb4bda/src/main.ts))
- Port the behavior and tests into Svelte lifecycle/state, rather than copying the global DOM lookup/event-listener structure. Camera streams and animation frames must be stopped when leaving the route or when visibility changes. The upstream already tests camera, detector, canvas, clipboard, service-worker, and local-storage behavior under jsdom, which is a useful test inventory. ([tests](https://github.com/seandlg/web-qr-scanner/blob/868af9d1e6251a7458ce5a1d3f2bf2d0fccb4bda/src/main.test.ts))
- Its direct runtime dependencies are `@undecaf/barcode-detector-polyfill`, `@undecaf/zbar-wasm`, and `qrcode`. Keep the first two only if a non-native scanner fallback is a product requirement; keep `qrcode` only if QR generation remains part of the mini-app. The repository patches the polyfill so ZBar is imported locally instead of from jsDelivr, which matches the offline/no-CDN requirement but must be revalidated against the current package and Vite build before carrying the patch forward. ([package manifest](https://github.com/seandlg/web-qr-scanner/blob/868af9d1e6251a7458ce5a1d3f2bf2d0fccb4bda/package.json), [polyfill patch](https://github.com/seandlg/web-qr-scanner/blob/868af9d1e6251a7458ce5a1d3f2bf2d0fccb4bda/setup/patches/%40undecaf__barcode-detector-polyfill.patch))
- The hand-written service worker hard-codes Vite output names and cache paths. Replace it with SvelteKit's generated `build`/`files` lists rather than porting it verbatim. ([upstream service worker](https://github.com/seandlg/web-qr-scanner/blob/868af9d1e6251a7458ce5a1d3f2bf2d0fccb4bda/public/sw.js), [SvelteKit service workers](https://svelte.dev/docs/kit/service-workers))

### License caveat

The referenced application repository contains no `LICENSE` file and its private package manifest has no `license` field. Public visibility is not permission to copy its source. Unless the owner confirms a license (or this is the user's own code), reuse the dependency choices and independently implement the behavior rather than copying source or assets verbatim. ([repository tree](https://github.com/seandlg/web-qr-scanner/tree/868af9d1e6251a7458ce5a1d3f2bf2d0fccb4bda), [package manifest](https://github.com/seandlg/web-qr-scanner/blob/868af9d1e6251a7458ce5a1d3f2bf2d0fccb4bda/package.json))

The user subsequently confirmed in this task that they are `seandlg` and own the referenced repository, authorizing the requested port into e7g.eu.

The dependency licenses are separate: `@undecaf/barcode-detector-polyfill` is MIT, `@undecaf/zbar-wasm` is LGPL, and `qrcode` declares MIT. The polyfill documentation says ZBar's WASM location/bundling must be handled deliberately and discusses the LGPL implications; retain the required license notices and validate distribution compliance. ([polyfill licensing and bundling](https://github.com/undecaf/barcode-detector-polyfill#build-configurations), [ZBar WASM repository](https://github.com/undecaf/zbar-wasm), [`qrcode` package manifest](https://github.com/soldair/node-qrcode/blob/master/package.json))
