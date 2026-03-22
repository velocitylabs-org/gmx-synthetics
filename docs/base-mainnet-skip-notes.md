# Base Mainnet Deploy Skip Notes

## TL;DR (Impacted Files)

**Still outstanding or intentionally conditional**

- `package.json`
- `config/vaultV1.ts` (interim — see roadmap below)
- `config/feeDistributor.ts` (interim — Nivo fee system redesign)
- `scripts/validateMarketConfigsUtils.ts`
- `deploy/configureRoles.ts`

**Peer mainnet inputs (implemented in repo — re-verify before live deploy)**

- `config/general.ts` — GMX removed from shared defaults; `base` / `baseSepolia` use `NIVO_PROTOCOL_FEE_AND_HOLDING` (same address as Sepolia deployer policy until treasury is final).
- `config/oracle.ts` — Base `dataStreamFeedVerifier` + `chainlinkPaymentToken` set from peer; confirm against Chainlink docs at deploy time.
- `config/tokens.ts` — Base `dataStreamFeedId` for WETH, USDC, GBP, JPY from peer; confirm `dataStreamFeedDecimals` (and stream metadata) against Chainlink docs.

**Out of scope for Nivo (not listed here)**

- **Edge Oracle (Chaos Labs):** does not support FX; not useful for Nivo. No checklist or deployment guidance for Edge in this document.

## Why this doc exists

This records **remaining** Base mainnet vs Sepolia adaptation differences (placeholders, validation helpers, roles). Items that were temporarily fork-skipped and later unskipped are intentionally omitted.

## Conditional behavior (Base mainnet vs Sepolia adaptation)

Only items that still differ intentionally or need production follow-up are listed below. Scripts that were previously fork-skipped and are now unskipped are **not** documented here.

### `config/general.ts` (production follow-up)

- Shared `generalConfig` no longer defaults `feeReceiver` / `holdingAddress` to GMX (`AddressZero` until overridden per network).
- `base` and `baseSepolia` both set `feeReceiver` and `holdingAddress` to `NIVO_PROTOCOL_FEE_AND_HOLDING` in code (same wallet as the historical Sepolia deployer policy).
- **Outstanding:** If Base mainnet must use a different treasury / multisig than that wallet, update the constant or override `base` only before production.

### `config/vaultV1.ts` (roadmap)

- **What it is today:** only used for **fee distribution to GMX V1 stakers** (legacy GMX path). It is **not** a Nivo product requirement.
- **Direction:** remove reliance on this for Nivo and **redesign `FeeDistributor` (and related fee plumbing)** for something that suits Nivo (work in progress).
- **Until then:** `base` may still carry bring-up placeholders so constructor wiring / fork deploys succeed; treat as **technical debt**, not a long-term Base mainnet design.

### `config/feeDistributor.ts` (roadmap)

- **Direction:** align with the **Nivo-specific FeeDistributor / fee system** above rather than extending GMX + `esGmx` semantics indefinitely.
- **Until then:** `base` may use fork-bring-up token addresses; **`esGmx`** in particular may remain placeholder until the new design and tokenomics are fixed.

### `package.json`

- Fork helper scripts set `DEPLOY_ON_FORK=true` (and Anvil dev key) so local fork runs are explicit; this does **not** gate deployment scripts anymore beyond your own conventions.

## Non-skip but critical fork fix

### `scripts/validateMarketConfigsUtils.ts`

- Added `recommendedMarketConfig.base` (mirroring the Nivo `baseSepolia` set).
- This is not a skip; it prevents validation crashes during `deployAndConfigureMarkets.ts` on `base`.
- Effect: resolves errors like missing `JPY:USDC:USDC` recommendation lookup.

## Other relevant behavior to review before real mainnet deploy

### `deploy/configureRoles.ts`

- `rolesToRemove` now has `base: []` and fallback `rolesToRemove[network.name] || []`.
- This prevents iterator crashes, but role grants still require deployer permissions (`ROLE_ADMIN` path).
- On mainnet, ensure deployer and role-admin strategy are explicitly validated before running deploy.

### Oracle contract (peer)

- Expect a **small Oracle-contract improvement** from the team before locking the final mainnet cut; coordinate before treating oracle bytecode as frozen.

## Mainnet preflight checklist

- Run mainnet deploy commands **without** `DEPLOY_ON_FORK=true`.
- Confirm your deployment environment does not export `DEPLOY_ON_FORK`.
- Re-verify in Chainlink documentation: Base `dataStreamFeedVerifier`, `chainlinkPaymentToken`, and Data Stream feed IDs / decimals in `config/tokens.ts` (`base`).
- Confirm `feeReceiver` / `holdingAddress` for `base` match the intended production treasury (vs `NIVO_PROTOCOL_FEE_AND_HOLDING`).
- **Bridge / fund operational wallets:** bridge tokens as needed and **check balances** on the relevant addresses (**ETH** for gas, **LINK** or other tokens required for Chainlink / oracle operations on Base).
- Validate role-admin ownership and grant authority ahead of `configureRoles`.
- Run a final dry run against a fresh Base mainnet fork before going live.
