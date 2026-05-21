# operator-app

> Promptable Operator's branded fork of [makeplane/plane](https://github.com/makeplane/plane).
>
> AGPL-3.0 (inherited from upstream). Downstream of `makeplane/plane`. Brand and per-workspace branding work is in progress — at the `operator-app-v0.1.0` baseline this repo is a no-op fork (zero patches to upstream Plane source).

This is the consumer-facing surface of the Promptable Operator product. Promptable Operator is an internal toolkit (in the [`promptable-operator`](https://github.com/Geppetto-Consulting/promptable-operator) repo) that uses Plane as its operational backbone — for tracking work items, pages, views, cycles, and richer agent-managed content surfaces.

## Status

- **`operator-app-v0.1.0`** — baseline fork. No patches to upstream source. Establishes the GHCR image pipeline so later phases can ship branded + extended images on the same plumbing.
- Subsequent phases (Phase 1+) layer on:
  - Brand strings (Plane → Promptable Operator) via centralised constants
  - Per-workspace brand customisation (logo, colour) at the workspace level
  - Public REST API additions for Pages, Views, and Cycles (`x-api-key` auth, MVP matches existing Issues API permissions)
  - Per-project terminology (Work Items → Contacts in REL, Drafts in CONTENT, etc.)
  - Bead↔Page mention surfacing
  - A documented monthly upstream rebase runbook

See the parent programme bead `ENG-42` in the Promptable Operator bead system for the full phase plan, and individual phase beads (`ENG-112` … `ENG-121`) for executor briefs.

## Version scheme

The fork uses **its own SemVer**, decoupled from upstream Plane's tags. Versions are tagged `operator-app-vX.Y.Z`:

- **X (major)** — major user-visible surface change (e.g. first stable branded release, terminology infrastructure landed, or a backward-incompatible behaviour change). `operator-app-v1.0.0` ships when the first sustainable-fork rehearsal (Phase 9) is complete and we have a documented upstream-merge runbook.
- **Y (minor)** — feature addition (e.g. a new public-API surface, a new branding hook, terminology component coverage milestone).
- **Z (patch)** — patch-only release (bug fixes, upstream-rebase no-op cycles, dependency bumps).

The current baseline is `operator-app-v0.1.0` — `0.x.y` because the fork has not yet shipped a stable branded release.

Image tags published to GHCR mirror the SemVer (so `operator-app-api:v0.1.0`, not `operator-app-api:operator-app-v0.1.0`).

## Container images

Each tag push (`operator-app-v*`) builds six images and publishes them to the GitHub Container Registry under `ghcr.io/geppetto-consulting/operator-app-<service>` with both the `vX.Y.Z` and `latest` tags:

| Service | Image |
|---|---|
| API (Django backend) | `ghcr.io/geppetto-consulting/operator-app-api` |
| Web (Next.js workspace UI) | `ghcr.io/geppetto-consulting/operator-app-web` |
| Admin (Next.js admin UI) | `ghcr.io/geppetto-consulting/operator-app-admin` |
| Space (Next.js public-share UI) | `ghcr.io/geppetto-consulting/operator-app-space` |
| Live (HocusPocus collaboration server) | `ghcr.io/geppetto-consulting/operator-app-live` |
| Proxy (Caddy reverse proxy) | `ghcr.io/geppetto-consulting/operator-app-proxy` |

`main` branch builds also publish a mutable `:main` tag for development use.

The build pipeline lives in [`.github/workflows/build-images.yml`](workflows/build-images.yml) and uses the GitHub-provided `GITHUB_TOKEN` (no PATs).

## Upstream remote

This fork tracks `makeplane/plane` and rebases against `upstream/preview` on a monthly cadence (see the rebase runbook landing in Phase 9).

When you clone the fork, configure the upstream remote:

```sh
git clone git@github.com:Geppetto-Consulting/operator-app.git
cd operator-app
git remote add upstream https://github.com/makeplane/plane.git
git fetch upstream
```

`git remote -v` should then show:

```
origin    git@github.com:Geppetto-Consulting/operator-app.git (fetch/push)
upstream  https://github.com/makeplane/plane.git (fetch/push)
```

## Where to look

For someone new to the fork:

- [`.github/workflows/build-images.yml`](workflows/build-images.yml) — image-build pipeline (the only fork-only file in the v0.1.0 baseline beyond this README).
- Everything else — upstream Plane source, unchanged at the `operator-app-v0.1.0` baseline. See upstream's [`README.md`](../README.md) for architecture, setup, and contribution docs.
- Future phases land fork-only files in new locations (e.g. `apps/api/plane/api/views/page.py` for the public Pages API) and centralised seams (e.g. `packages/constants/brand.ts` for brand strings) rather than in-place patches to upstream files. This keeps the monthly upstream rebase tractable.

## Licence

AGPL-3.0, inherited from upstream Plane. See [`LICENSE.txt`](../LICENSE.txt) for the full text. As an AGPL downstream we publish our source, link back to upstream, and (when the trademark-removal rebrand lands in Phase 1+) follow standard fork practice (cf. Vaultwarden, Forgejo).
