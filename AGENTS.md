# e7g.eu engineering guide

## Product constraints

- e7g.eu is a stateless, browser-only PWA. Do not add a backend, database, analytics, or account system without an explicit product decision.
- TypeScript is the only programming language. Svelte files use `<script lang="ts">` and Svelte 5 runes.
- Use current browser APIs behind focused modules. Permission denial, unavailable hardware, insecure contexts, and unsupported APIs are normal UI states, not exceptional crashes.
- The deployed application lives in `apps/web`. Every mini-app is a lazy-loaded SvelteKit route below `apps/web/src/routes/apps` and is registered once in `$lib/apps/catalog.ts`.
- Keep a mini-app local to its route until two real callers need the same behavior. Put genuinely shared browser behavior in `$lib/browser`, pure domain logic in `$lib/domain`, and reusable presentation in `$lib/ui`.

## Architecture

- A mini-app route is the product seam: it owns page UI and lifecycle and imports deep modules with small interfaces.
- Browser modules hide permission and event-subscription implementation and return cleanup functions. UI code must clean up camera, geolocation, animation, and event listeners when unmounted.
- When two mini-apps repeat the same hardware lifecycle, deepen it into a shared browser module rather than duplicating it. In particular, `$lib/browser/camera.ts` should own camera permission, stream attachment, start/restart/stop cleanup, device enumeration and selection, and capability inspection for the QR scanner and color inspector.
- Keep feature policy outside that shared camera interface: QR detection cadence and lens filtering belong to the scanner, while color sampling, freezing, and pipette behavior belong to the color inspector. Share the device lifecycle, not incidental feature behavior.
- Pure calculations accept values and return results. Do not reach for browser globals from domain modules; this keeps them directly testable through their public interface.
- Add a package under `packages/*` only after code is shared across deployables or has a coherent independent interface. Do not create pass-through packages or hypothetical adapters.
- The app catalog is the single source of truth for launcher labels, descriptions, routes, colors, and capability notes. Adding a tool should usually require one catalog entry and one route.

## Coding style

- Prefer the simplest correct implementation. Avoid speculative abstractions and configuration.
- Keep modules cohesive, names explicit, and control flow unsurprising. DRY means one authoritative rule or calculation, not deduplicating incidental resemblance.
- Use semantic HTML, visible keyboard focus, accessible labels, sufficient contrast, and reduced-motion preferences. Design mobile-first and verify wide layouts too.
- Never render scanned or external text as HTML. Treat camera, GPS, clipboard, and share data as untrusted.
- Use `@rexa-developer/tiks` exclusively for short UI, alert, and timer sounds. Do not add audio files, synthesize replacement cues directly with Web Audio, or introduce another sound package without an explicit product decision. Initialize audio from a user gesture, expose mute control, keep cues sparse, and never use sound as the only feedback channel.
- Keep dependencies scarce. Before installing one, verify that a platform API or a small local module cannot reasonably do the job. Record why a runtime dependency is justified in the pull request.
- Test behavior at module interfaces. Prefer pure tests for calculations and narrow browser-module tests; avoid tests coupled to implementation details.

## Tooling

Vite+ owns Node, pnpm, dependencies, tasks, Vite, Vitest, linting, and formatting. Do not invoke `npm`, `npx`, `pnpm`, standalone `vite`, standalone `vitest`, Prettier, or ESLint.

- Install: `vp install` (`vp install --frozen-lockfile` in CI)
- Dependencies: `vp add <package>`, `vp add -D <package>`, `vp remove <package>`, `vp why <package>`
- Develop: `vp run dev`
- Check and fix: `vp check`, `vp check --fix`
- Type-check Svelte: `vp run typecheck`
- Test: `vp test`, `vp test watch`
- Build/preview: `vp run build`, `vp run preview`
- Inspect runtime: `vp env current`, `vp env doctor`

Node 24+ can execute `.ts` scripts only when their TypeScript syntax is erasable. Node does not type-check them or honor `tsconfig` path aliases. Use explicit `.ts` imports and `import type`; browser code still goes through SvelteKit/Vite.

## Git history

- Use Conventional Commits for every commit: `<type>(optional-scope): <imperative summary>`.
- Prefer the narrowest accurate type, such as `feat`, `fix`, `refactor`, `test`, `docs`, `build`, or `chore`.
- Keep each commit cohesive. Do not mix unrelated cleanup into a feature or fix commit.
- Once a change is implemented and the relevant checks pass, Codex may create the commit without asking again. The user pushes commits manually; Codex must not push unless explicitly requested.
- Before a commit is pushed, follow-up changes may be folded into it with `git commit --amend` when the user requests that history shape. Never amend a commit already present on a remote branch unless explicitly authorized.

Before handing off a change, run `vp check`, `vp run typecheck`, `vp test`, and `vp run build`. Add only the narrowest relevant test for behavior changed.
