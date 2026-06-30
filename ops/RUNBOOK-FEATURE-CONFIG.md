# Ops Runbook — Mainnet Config Changes

This runbook defines when and how to archive evidence for mainnet configuration changes on the Nivo protocol (Base mainnet, chain ID 8453).

It applies to any operation that writes protocol state via the config keeper role — feature flag changes, market parameter updates, risk guard adjustments, or similar. It is not required for read-only operations, testnet-only runs, or local fork testing.

For technical details on the underlying scripts (directory structure, how to add a new feature flag, fork testing), see [scripts/configs/README.md](../scripts/configs/README.md).

---

## When an evidence bundle is required

Any time a script is executed with `WRITE=true` (or equivalent) against Base mainnet, an evidence bundle must be created and committed alongside the PR that introduces or runs the change.

If in doubt: if real funds or real protocol state are affected, archive it.

---

## Steps

Run these in order. Do not skip to the write step without a passing dryrun.

### 1. Dryrun
```bash
DOPPLER_CONFIG=prd NETWORK=base pnpm run config:features:dryrun
```
Review the output. Confirm the intended operations match what is about to be executed. Do not proceed if anything looks unexpected.

### 2. Write
```bash
DOPPLER_CONFIG=prd NETWORK=base pnpm run config:features:write 2>&1 | tee ops/<bundle-dir>/write.log
```
Each transaction hash will appear in the terminal output and be captured in `write.log`.

### 3. Validate
```bash
DOPPLER_CONFIG=prd NETWORK=base pnpm run config:features:status 2>&1 | tee ops/<bundle-dir>/validate.log
```
The transcript must end with `Verification passed: all feature flags matched expected state.`

If the validate script does not cover every key that was written (see [Validation coverage gaps](#validation-coverage-gaps) below), note the gap in the bundle README.

---

## Bundle structure

Each change gets its own directory under `ops/`, named `YYYY-MM-DD-<short-description>/`.

```
ops/
  2026-05-11-feature-redaction/
    README.md
    write.log
    validate.log
```

**Naming rules:**
- Date is the date the mainnet write was executed, not the PR date
- Description is lowercase, hyphen-separated, plain English — no ticket numbers
- No `mainnet/` subdirectory unless the PR covers multiple chains at production level simultaneously (in which case use per-chain subdirs, e.g. `base/` and `arbitrum/`)

### README.md (required)

Every bundle must include a `README.md` with:
- One-sentence summary of what changed and why
- Config keeper address used
- Transaction hash table (one row per batch, with Basescan links)
- Any validation coverage gaps (see below)

Use `ops/2026-05-11-feature-redaction/README.md` as a reference, or copy this template:

```markdown
# YYYY-MM-DD — <short description>

<One-sentence summary of what changed and why.>

## Config keeper
<address used>

## Transaction hashes
| Batch | Basescan |
|-------|----------|
| <batch name> | <link> |

## Validation coverage gaps
<List any written keys not covered by the validate script, or write
"None — all written keys are covered by validate.log." if fully covered.>

## Evidence files
| File | Contents |
|------|----------|
| `write.log` | Write transcript — tx sent / mined confirmation |
| `validate.log` | Readback transcript — all flags matched expected state |
```

---

## Validation coverage gaps

The standard validate script (`verifyFeaturesState.ts`) does not cover all writable keys. If `write.log` includes transactions for keys that `validate.log` does not read back, add a **Validation coverage gap** section to the bundle README explicitly listing what is and is not covered.

Do not leave this implicit. A reader who sees only `validate.log` ending with "Verification passed" should not be left to assume it covers the full write. As of this writing, `verifyFeaturesState.ts` covers all order create/execute feature flags in addition to shift/JIT/subaccount/gasless/atomic withdrawal — the historical gap from the May 2026 redaction bundle has been resolved.

---

## What to keep, what to drop

| Artifact | Keep? | Reason |
|----------|-------|--------|
| `write.log` | Yes | On-chain evidence — tx hashes, mined confirmation |
| `validate.log` | Yes | Readback proof — verifies state after write |
| Dryrun logs | No | Simulation only, reproducible on demand |
| Fork / pre-flight logs | No | Not on-chain, reproducible on demand |
| Acceptance checklists | No | Process artifact, belongs in the PR description |
| Post-execution notes | No | Summarise in the bundle README instead |

Testnet (Base Sepolia) logs follow the same rule: transaction hashes may be listed in the README as reference, but testnet write/validate transcripts are not archived. Testnet state is not authoritative.

---

## Ownership

The engineer who executes the mainnet write is responsible for creating the bundle. The PR reviewer is responsible for confirming the bundle is present and complete before approving. Neither step is optional.

If the validate script does not cover all written keys at the time of the change, the gap must be noted in the README — not deferred silently.

---

## PR checklist

Include the following in the PR description for any PR that contains a mainnet config change:

```
## Mainnet config change
- [ ] `ops/YYYY-MM-DD-<description>/` bundle included
- [ ] `write.log` present and tx hashes visible
- [ ] `validate.log` present and ends with "Verification passed"
- [ ] Any validation gaps documented in bundle README
- [ ] README tx hash table complete with Basescan links
```
