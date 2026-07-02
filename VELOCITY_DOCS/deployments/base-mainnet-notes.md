# Base Mainnet Notes

This is a live deployment (soft launch on Base mainnet, no real volume yet, no real LPs yet).

## Active markets

GBP, BRL, MXN, COP — live with real Chainlink Data Stream feed IDs.

## Inactive markets (disabled, no oracle feed yet)

IDR, PHP, PEN, NGN, KES, ZAR, THB — deployed on-chain but disabled via `applyPoolRiskGuards.ts` (`DEFAULT_INACTIVE_INDEX_TOKENS`). No Chainlink Data Stream feed ID configured yet (HashZero in `config/tokens.ts`). Re-enable once feeds are available — see `scripts/configs/README.md`.

## Known technical debt

- **feeReceiver/holdingAddress** (`config/general.ts`): set to deployer wallet (`NIVO_PROTOCOL_FEE_AND_HOLDING`), not a dedicated treasury. OK today since all fee receiver factors are 0 — no FeeDistributor has been built yet. All fees currently go entirely to LPs by design (no fees collected by the protocol at this stage).
- **vaultV1.ts / feeDistributor.ts**: GMX V1 / esGmx legacy placeholders, unused. A Nivo-specific FeeDistributor has not been designed or built yet. esGmx address is stubbed with a placeholder.
