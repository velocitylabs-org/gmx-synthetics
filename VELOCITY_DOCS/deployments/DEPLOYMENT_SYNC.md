# Deployment Sync

Reads contract deployment artifacts from `deployments/<chain>/`, upserts them into the `contract_deployments` Supabase table, and flips the `contract_deployment_pointers` row to the new version. Consumers subscribe to the pointer table via Supabase Realtime and are notified automatically on each flip.

## Versioning

Each chain has a `deployments/<chain>/.version` file containing a semver string (e.g. `1.0.2`). This is the sole version counter — Supabase is the source of truth for the full deployment history.

**Why not `versions/` snapshot files?** The `versions/` directory (previously used by `extract-deployment-addresses.ts`) was a manual snapshot system that duplicated what Supabase already stores. It was removed to keep a single source of truth. `extract-deployment-addresses.ts` was removed along with it.

**Why not git SHA?** SHA strings are opaque and not meaningful to operators. Semver makes it easy to communicate breaking changes (`major`), new contracts (`minor`), or redeployments (`patch`).

## Prerequisites

Live runs need `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the environment. Locally these come from **Doppler (`-c stg`)** — operators wrap the npm invocation with `doppler run`. In CI they come from GitHub Actions secrets. No `.env` file is required.

```sh
doppler login   # once per machine
```

## Operator workflow

```
1. Deploy contracts     → deployments/<chain>/ updated locally
2. Dry-run              → preview next version and contracts, no writes
3. Live local run       → wrap with `doppler run -p nivo -c stg --`,
                          bumps .version, upserts to STAGING Supabase
4. Commit + push        → deploy-sync.yml fires on deployments/** change,
                          upserts to PROD Supabase via GitHub Actions
                          secrets (idempotent, no re-bump)
```

**Two Supabase targets, same schema.** Staging and production both expose `contract_deployments` + `contract_deployment_pointers`. The `upsert-deployments` npm script is intentionally a bare `ts-node` invocation. Credentials are supplied externally to the script:

- **Locally:** `doppler run -p nivo -c stg -- pnpm run upsert-deployments --chain <folder> --chain-label <label>` — Doppler injects the staging Supabase creds.
- **In CI:** `.github/workflows/deploy-sync.yml` sets `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` as step env from GitHub Actions secrets (prod creds), then calls `pnpm run upsert-deployments`.

Operators never write to prod from a laptop — prod writes only happen via the workflow. **Do not wrap this npm script with `doppler run` inside `package.json` — `doppler` is not installed on the GitHub Actions runner and CI will break.** The `doppler run` wrapper belongs on the operator's command line, not in the script definition.

## Usage

All local runs must be prefixed with `doppler run -p nivo -c stg --` so the staging Supabase credentials are injected. The CLI flags after `pnpm run upsert-deployments` are:

```sh
doppler run -p nivo -c stg -- pnpm run upsert-deployments \
  --chain <folder>       \  # deployment folder under deployments/ (e.g. baseSepolia, base)
  --chain-label <label>     # DB chain identifier (e.g. base-sepolia, base-mainnet)
```

### Dry-run (no credentials needed, no writes)

Doppler is not required for a dry-run — the script exits before touching Supabase:

```sh
pnpm run upsert-deployments --chain baseSepolia --chain-label base-sepolia --dry-run
```

Shows the next version and all contracts that would be upserted without touching the `.version` file or Supabase.

### Local, pre-commit run — patch bump (default)

```sh
doppler run -p nivo -c stg -- pnpm run upsert-deployments --chain baseSepolia --chain-label base-sepolia
# 1.0.1 → 1.0.2
```

### Minor or major bump

```sh
doppler run -p nivo -c stg -- pnpm run upsert-deployments --chain baseSepolia --chain-label base-sepolia --bump minor
# 1.0.1 → 1.1.0

doppler run -p nivo -c stg -- pnpm run upsert-deployments --chain baseSepolia --chain-label base-sepolia --bump major
# 1.0.1 → 2.0.0
```

Use `minor` when adding new contracts to an existing deployment. Use `major` for breaking changes (e.g. redeployment from scratch, incompatible ABI change).

After a live run, commit the bumped `.version` file alongside the deployment artifacts:

```sh
git add deployments/baseSepolia/.version deployments/baseSepolia/
git commit -m "chore: deploy baseSepolia v1.0.2"
```

## How consumers are notified

When `upsert-deployments` runs (locally or via CI), it updates the `version` field on the `contract_deployment_pointers` row for the target chain to the latest deployed version. This single write is the trigger for all downstream consumers.

**nivo-api** subscribes to `UPDATE` events on `contract_deployment_pointers` via Supabase Realtime. On receiving a pointer flip it:
1. Logs the old and new version.
2. Fetches the new set of contracts from `contract_deployments`.
3. Validates all required contracts are present.
4. Atomically replaces the in-memory cache — subsequent requests are served from the new version within seconds.
5. If the re-fetch or validation fails, the old cache is kept and the error is logged loudly (graceful degradation — the API keeps serving rather than crashing).

**Manual testing:** To trigger a Realtime notification without a full deployment, edit the `version` field directly in the Supabase Table Editor (`contract_deployment_pointers` → `base-sepolia` row). Flip it to a non-existent version to test graceful degradation, or flip it back to the current version to test a clean reload.

## CI

The workflow at `.github/workflows/deploy-sync.yml` triggers on any push to `main` that changes `deployments/**`. It runs with `--no-bump` — the version is read from the already-committed `.version` file and the upsert is idempotent.

Secrets required in repo settings: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
