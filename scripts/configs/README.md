# Feature Management Architecture (Maintenance Guide)

This document explains how feature configuration is organized and maintained in this repository, with a focus on long-term operations rather than one-time ticket implementation details.

It is intended for engineers who need to:
- disable or re-enable protocol features safely
- add new feature flags in a maintainable way
- run consistent verification and evidence capture workflows

## Goals of this architecture

- Keep feature management centralized under one orchestrator entrypoint.
- Separate mutation scripts from verification scripts.
- Use neutral naming so scripts remain useful beyond a single ticket.
- Make all changes reversible (`disable` and `enable` paths).
- Support deterministic evidence generation for audits and operations.

## Directory structure and responsibilities

Feature management lives under `scripts/configs/` and is split by concern.

### `scripts/configs/index.ts`
- Primary orchestrator entrypoint.
- Reads environment toggles and decides which config/validation modules to run.
- Should remain the single composition layer for feature flows.

### `scripts/configs/helpers/`
- Shared runtime and contract access helpers.
- Typical responsibilities:
  - network/runtime adaptation for fork contexts
  - deployment-aware contract resolution
  - config-keeper signer resolution
- Keep these helpers generic and reusable; avoid feature-specific logic here.

### `scripts/configs/configs/`
- Mutation scripts only.
- These scripts write config state (or dry-run write intent).
- Prefer feature-focused modules (for example, order features vs pool risk guards).
- Each script should support reversible state where applicable.

### `scripts/configs/validations/`
- Readback and assertion scripts only.
- No writes in validation modules.
- Should be CI-friendly:
  - clear per-check output
  - non-zero exit on mismatch when configured (`FAIL_ON_MISMATCH=true`)

## Design conventions for future feature sets

When adding new managed features, follow this pattern.

1. Add or extend a typed feature spec module in helpers (single source of truth).
2. Add feature-specific state setters in `configs/`.
3. Add matching readback validators in `validations/`.
4. Wire modules in `index.ts` behind neutral environment toggles.
5. Keep package scripts minimal and stable; avoid ticket IDs in command names.

## Naming standards

- Avoid ticket-specific names in:
  - script filenames
  - env vars
  - package scripts
- Prefer lifecycle-oriented names:
  - `set...FeatureState`
  - `verify...FeatureState`
  - `config:features:*` commands

This keeps maintenance intuitive when features are later re-enabled or further constrained.

## Operational modes

All feature operations should support two modes:

- Dry-run mode (`WRITE=false`)
  - prints intended writes
  - no on-chain mutation
- Write mode (`WRITE=true`)
  - executes config writes
  - logs transaction outputs for evidence

Feature state intent should also be explicit (for example, disabled vs enabled target state), so engineers can run both redaction and rollback workflows from the same architecture.

## Validation model

Validation should be layered and explicit:

- Per-feature readback validations (state-level correctness).
- Invariant validations (system-level consistency).
- Targeted smoke tests for still-enabled paths.
- Expected-fail tests for intentionally disabled paths.

Validation scripts should produce output that can be consumed both by engineers and CI jobs.

## Test policy after redaction

Maintain three clear categories in docs and run artifacts:

- Must pass: invariant/state/guardrail checks for enabled paths.
- Must fail (expected-fail): disabled features revert correctly.
- Must skip (intentional): legacy behavior suites for intentionally removed functionality.

Always publish skip-accounting details (`what was skipped` + `why`) and final pass/skip/fail counts.

## Evidence and audit trail

Archive outputs for each run in a timestamped folder:

- `docs/mainnet-configurations/<workstream-or-ticket>/<timestamp>/`

Recommended contents:
- dry-run logs
- write logs and tx hashes
- validation outputs
- invariant outputs
- short `README.md` with exact commands and run summary

This evidence model supports change review, incident response, and rollback planning.

## What this architecture does not do

- It does not remove deployed contracts from bytecode history.
- It does not replace role hygiene and governance controls.
- It does not make deployment-surface decisions by itself (that belongs to deployment policy and release governance).

## Maintenance checklist for adding a new feature flag

- Add typed spec entry for the feature key and resolver inputs.
- Add setter script in `configs/` with dry-run/write support.
- Add validator script in `validations/` with mismatch fail mode.
- Add orchestrator toggle wiring in `index.ts`.
- Confirm package command surface stays concise and neutral.
- Add evidence output for dry-run/write/verify.
- Update guardrail docs if CI behavior changes.

Following this structure keeps feature governance deterministic, reversible, and easy to operate across future protocol hardening cycles.

## CI validation preset endpoint

The validation-only preset (`FEATURES=validate`) runs only `RUN_FEATURE_VALIDATIONS` with all
other workstreams disabled. It is invoked by `scripts/configs/run-feature-validation.sh`, which
also sets the safety-critical flags (`WRITE=false`, `TARGET_DISABLED_STATE=true`, `FAIL_ON_MISMATCH=true`)
that are intentionally absent from the preset type.

Package endpoints:

- `npm run config:features:basesepolia:validate`
- `npm run config:features:mainnet:validate`

### Maintenance rules

When adding/removing feature toggles in `scripts/configs/index.ts`, update
`scripts/configs/presets/validate.ts` to include the new key. The TypeScript compiler
will reject a partial `FeatureFlags` object, so drift is caught at compile time.
