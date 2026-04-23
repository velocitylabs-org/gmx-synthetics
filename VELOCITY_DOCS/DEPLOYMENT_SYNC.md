# Deployment Sync

Reads contract deployment artifacts from `deployments/<chain>/`, upserts them into the `contract_deployments` Supabase table, and flips the `contract_deployment_pointers` row to the new version. Consumers subscribe to the pointer table via Supabase Realtime and are notified automatically on each flip.

## Versioning

Each chain has a `deployments/<chain>/.version` file containing a semver string (e.g. `1.0.2`). This is the sole version counter — Supabase is the source of truth for the full deployment history.

**Why not `versions/` snapshot files?** The `versions/` directory (previously used by `extract-deployment-addresses.ts`) was a manual snapshot system that duplicated what Supabase already stores. It was removed to keep a single source of truth. `extract-deployment-addresses.ts` was removed along with it.

**Why not git SHA?** SHA strings are opaque and not meaningful to operators. Semver makes it easy to communicate breaking changes (`major`), new contracts (`minor`), or redeployments (`patch`).

## Prerequisites

Supabase credentials are required for live runs (not dry-runs). Provide them via a `.env` file in the repo root or as exported shell variables:

```sh
# .env or shell export
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

## Operator workflow

```
1. Deploy contracts     → deployments/<chain>/ updated locally
2. Dry-run              → preview next version and contracts, no writes
3. Live local run       → bumps .version, upserts to dev Supabase
4. Commit + push        → CI fires on deployments/** change,
                          upserts to prod Supabase (idempotent, no re-bump)
```

## Usage

```sh
pnpm run upsert-deployments \
  --chain <folder>       \  # deployment folder under deployments/ (e.g. baseSepolia, base)
  --chain-label <label>     # DB chain identifier (e.g. base-sepolia, base-mainnet)
```

### Dry-run (no credentials needed, no writes)

```sh
pnpm run upsert-deployments --chain baseSepolia --chain-label base-sepolia --dry-run
```

Shows the next version and all contracts that would be upserted without touching the `.version` file or Supabase.

### Local, pre-commit run — patch bump (default)

```sh
pnpm run upsert-deployments --chain baseSepolia --chain-label base-sepolia
# 1.0.1 → 1.0.2
```

### Minor or major bump

```sh
pnpm run upsert-deployments --chain baseSepolia --chain-label base-sepolia --bump minor
# 1.0.1 → 1.1.0

pnpm run upsert-deployments --chain baseSepolia --chain-label base-sepolia --bump major
# 1.0.1 → 2.0.0
```

Use `minor` when adding new contracts to an existing deployment. Use `major` for breaking changes (e.g. redeployment from scratch, incompatible ABI change).

After a live run, commit the bumped `.version` file alongside the deployment artifacts:

```sh
git add deployments/baseSepolia/.version deployments/baseSepolia/
git commit -m "chore: deploy baseSepolia v1.0.2"
```

## CI

The workflow at `.github/workflows/deploy-sync.yml` triggers on any push to `main` that changes `deployments/**`. It runs with `--no-bump` — the version is read from the already-committed `.version` file and the upsert is idempotent.

Secrets required in repo settings: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
