# e7g.eu

A browser-only toolbox presented as a fast, installable app drawer. It includes a QR scanner, GPS speedometer, sound meter, and camera color inspector; more focused utilities can be added as SvelteKit routes.

Built with TypeScript, SvelteKit, UnoCSS, and Vite+. No backend and no user data collection.

```sh
vp install
vp run dev
```

Quality gates: `vp check`, `vp run typecheck`, `vp test`, and `vp run build`.

For Vercel, import the repository and set the project root directory to `apps/web`; the static adapter writes the deployable site to `build`.
