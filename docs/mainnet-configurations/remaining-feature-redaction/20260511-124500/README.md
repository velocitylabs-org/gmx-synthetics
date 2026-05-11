# Remaining Feature Redaction - Pre-mainnet Evidence (SCRUM275)

This bundle captures the pre-mainnet fork execution evidence for the SCRUM275 remaining-feature redaction flow.

## Environment

- Network: `anvil` fork of Base mainnet
- Fork endpoint: `https://mainnet.base.org`
- Fork chainId: `8453`
- Hardhat runner: `scripts/configs/index.ts`

## Commands executed

1. `pnpm -s hardhat compile`
2. `pnpm -s config:features:fork:dryrun`
3. `pnpm -s config:features:fork`

## Outcomes

- Compile: success
- Fork dry-run: success (expected validation mismatches pre-write)
- Fork write + validate: success
- Final verification status: `Verification passed: all feature flags matched expected state.`

## Write transactions observed

- Create-order disable batch: `0x49b6a73f046a43cd43e240bf30ef922c4b10b93f4f0d4d259c79737c2636af49`
- Execute-order disable batch: `0xda0c7f28d69d934592affa5660f26013aa11b600e4db75cee8f0966c1eaa7927`
- Pool risk guards batch: `0xcd8edce440d576c22f3ae2b0bea602f1247ac96c2fb734de4c6c0ccc6a70c0a4`
- Shift feature batch: `0x580c440a3273d34314aa97889cc7157ac59aa5ea92ea42f4d47cfc54ede1f627`
- JIT feature batch: `0xf43f16b77a3b63b54a4162c90742ccb987b5c63cbb845183f035e382cad754d9`
- Subaccount feature batch: `0xfa334e1d87f93c0544044db73e9dc9a987a7814f1cd76b67863fb4463190eff2`
- Gasless feature batch: `0xd5f2a880278f0205d3e36c8e74c499a989205c16455bf2f1165a0ec207006e68`
- Atomic withdrawal feature batch: `0x974dc6de6f255ef6437610adf5c850ff56f1336d6c60566251d1f92391bfdef3`

## Files in this bundle

- `01-compile.log`
- `02-fork-dryrun.log`
- `03-fork-write-and-validate.log`

## Notes

- This is pre-mainnet evidence only.
- Mainnet dry-run/write/readback evidence will be appended in a post-mainnet bundle.
