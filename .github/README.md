# operator-app

> Promptable Operator's branded fork of [makeplane/plane](https://github.com/makeplane/plane).
>
> AGPL-3.0 (inherited from upstream). Downstream of `makeplane/plane`. Brand and per-workspace branding work is in progress — at the `operator-app-v0.1.0` baseline this repo is a no-op fork (zero patches to upstream Plane source).

This is the consumer-facing surface of the Promptable Operator product. Promptable Operator is an internal toolkit (in the [`promptable-operator`](https://github.com/Geppetto-Consulting/promptable-operator) repo) that uses Plane as its operational backbone — for tracking work items, pages, views, cycles, and richer agent-managed content surfaces.

## Status

- **`operator-app-v0.1.0`** — baseline fork. No patches to upstream source. Useful as a reference snapshot for future rebases.
- Subsequent phases (Phase 1+) layer on:
  - Brand strings (Plane → Promptable Operator) via centralised constants
  - Per-workspace brand customisation (logo, colour) at the workspace level
  - Public REST API additions for Pages, Views, and Cycles (`x-api-key` auth, MVP matches existing Issues API permissions)
  - Per-project terminology (Work Items → Contacts in REL, Drafts in CONTENT, etc.)
  - Bead↔Page mention surfacing
  - A documented monthly upstream rebase runbook

See the parent programme bead `ENG-42` in the Promptable Operator bead system for the full phase plan, and individual phase beads (`ENG-112` … `ENG-121`) for executor briefs.

## Build + run model

**No registry, no CI.** Both development and deployment build images directly from source.

### Local development (Mac, Docker Desktop)

```sh
git clone git@github.com:Geppetto-Consulting/operator-app.git
cd operator-app
docker compose up --build
```

Edit source, rebuild affected services with `docker compose up --build <service>`. Plane's own root `docker-compose.yml` (inherited from upstream) is the dev compose; it builds each service from its `Dockerfile`.

### Production (Hetzner)

The Hetzner box clones this repo and builds images on the host:

```sh
ssh root@<hetzner-ip>
cd /opt/operator-app
git pull
docker compose --env-file /opt/plane/.env build
docker compose --env-file /opt/plane/.env up -d
```

This matches the deploy pattern used elsewhere in `promptable-operator` (see `infra/mcp/deploy.sh` — `docker compose ... up -d --build`). No image-transfer step; the Hetzner box builds from the same source it just pulled.

The Promptable Operator stack's compose file (`promptable-operator/infra/plane/docker-compose.yml`) supports both modes via `PLANE_IMAGE_PREFIX` / `PLANE_VERSION` env vars — default is the official `makeplane/plane-*` images; switch to local-build mode when cutover lands (Phase 2).

## Version scheme

The fork uses **its own SemVer**, decoupled from upstream Plane's tags. Versions are tagged `operator-app-vX.Y.Z`:

- **X (major)** — major user-visible surface change (e.g. first stable branded release, terminology infrastructure landed, or a backward-incompatible behaviour change). `operator-app-v1.0.0` ships when the first sustainable-fork rehearsal (Phase 9) is complete and we have a documented upstream-merge runbook.
- **Y (minor)** — feature addition (e.g. a new public-API surface, a new branding hook, terminology component coverage milestone).
- **Z (patch)** — patch-only release (bug fixes, upstream-rebase no-op cycles, dependency bumps).

The current baseline is `operator-app-v0.1.0` — `0.x.y` because the fork has not yet shipped a stable branded release. Tags are reference markers; nothing builds or publishes off them automatically.

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

- Everything is upstream Plane source, unchanged at the `operator-app-v0.1.0` baseline. See upstream's [`README.md`](../README.md) for architecture, setup, and contribution docs.
- Fork-only additions (beyond this README) land in **new files** rather than as patches to upstream — e.g. `apps/api/plane/api/views/page.py` for the public Pages API (Phase 3), `packages/constants/brand.ts` for centralised brand strings (Phase 1). This keeps the monthly upstream rebase tractable.

## Licence

AGPL-3.0, inherited from upstream Plane. See [`LICENSE.txt`](../LICENSE.txt) for the full text. As an AGPL downstream we publish our source, link back to upstream, and (when the trademark-removal rebrand lands in Phase 1+) follow standard fork practice (cf. Vaultwarden, Forgejo).
