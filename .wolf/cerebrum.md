# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Do not edit manually unless correcting an error.
> Last updated: 2026-04-28

## User Preferences

<!-- How the user likes things done. Code style, tools, patterns, communication. -->

## Key Learnings

- **Project:** gmx-synthetics
- **Description:** Contracts for GMX Synthetics.
- **`upsert-deployments` npm script must stay BARE — no `doppler run` wrapper inside `package.json`.** Operators wrap externally on the command line: `doppler run -p nivo -c stg -- pnpm run upsert-deployments --chain <folder> --chain-label <label>` (Doppler `stg` supplies the staging Supabase creds). CI (`.github/workflows/deploy-sync.yml`) calls the same bare script with `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` from GitHub Actions secrets (= prod) — the runner has no Doppler CLI, so any wrapper baked into the npm script breaks CI. Other mainnet scripts (`deploy:base:mainnet`, `config:redact-features:mainnet*`) correctly bake `doppler run -c prd` because they never run in CI.

## Do-Not-Repeat

<!-- Mistakes made and corrected. Each entry prevents the same mistake recurring. -->
<!-- Format: [YYYY-MM-DD] Description of what went wrong and what to do instead. -->

- [2026-05-14] Do NOT bake `doppler run` into the `upsert-deployments` npm script in `package.json`. It must stay `ts-node ci/scripts/upsert-deployments.ts`. The GH Actions runner has no Doppler CLI, so a wrapper inside the script breaks `deploy-sync.yml` (which supplies creds directly via GitHub secrets). Operators wrap externally: `doppler run -p nivo -c stg -- pnpm run upsert-deployments ...` to write to staging. The "integrated doppler" commit (5e3c4849, 2026-05-12) made this mistake — it wasn't caught because no `deployments/**` change has triggered the workflow since.

## Decision Log

<!-- Significant technical decisions with rationale. Why X was chosen over Y. -->
