# e7g.eu

A browser-only toolbox presented as a fast, installable app drawer. It includes camera and GPS utilities, a sound meter, color inspector, party games, and repeating break timer; more focused apps can be added as SvelteKit routes.

Built with TypeScript, SvelteKit, UnoCSS, and Vite+. No backend and no user data collection. Arcana uses a small Rust-to-WebAssembly Iroh bridge for end-to-end encrypted browser multiplayer; browser traffic is relayed by Iroh infrastructure.

```sh
vp install
vp run dev
```

Quality gates: `vp check`, `vp run typecheck`, `vp test`, and `vp run build`.

For Vercel, import the repository and set the project root directory to `apps/web`; the static adapter writes the deployable site to `build`.
