# SCRUM275 Step 8 — Production evidence (Base mainnet + Base Sepolia)

This bundle closes out **Step 8** from `../20260511-124500/04-acceptance-checklist.md`: mainnet dry-run / write / readback evidence, plus **Base Sepolia** execution evidence for the same orchestrator profile.

## Scope note

- **Feature-flag readback** in `03-mainnet-validate.log` matches `scripts/configs/validations/verifyFeaturesState.ts` (shift, atomic withdrawal, JIT, subaccount, gasless).
- **Order redaction + pool risk guards** explicit readback for this ticket is deferred to the follow-up ticket (team agreement).

## Networks and commands

| Chain        | Chain ID | Dry-run | Write | Validate only |
|-------------|----------|---------|-------|----------------|
| Base mainnet | 8453 | `npm run config:features:mainnet:dryrun` | `npm run config:features:mainnet` | `npm run config:features:validate:mainnet` |
| Base Sepolia | 84532 | `npm run config:features:basesepolia:dryrun` | `npm run config:features:basesepolia` | `npm run config:features:validate:basesepolia` |

Reproduce full transcripts locally (Node 24 recommended):

```bash
npm run config:features:mainnet:dryrun    2>&1 | tee docs/mainnet-configurations/remaining-feature-redaction/20260511-step8-production-evidence/01-mainnet-dryrun.log
npm run config:features:basesepolia:dryrun 2>&1 | tee docs/mainnet-configurations/remaining-feature-redaction/20260511-step8-production-evidence/04-basesepolia-dryrun.log
```

## Base mainnet — write batch tx hashes (operator run)

ConfigKeeper: `0xAed31d3C8942B38eec87Fe5830a671C1A3D0d967`

| Step | Basescan (8453) |
|------|-----------------|
| Create-order disable batch | https://basescan.org/tx/0xabeeeb3c295384e0a1a5025decba228cfd2ec52c865e865d05ce4ff3f121f583 |
| Execute-order disable batch | https://basescan.org/tx/0xcb411e783bcf389fd7155a01d915a05ba50e227d896c32fb04bd91d1ab79ac2f |
| Pool risk guards batch | https://basescan.org/tx/0x17b9513d14fc369a1726144d8a19469123a08ed4d5b8d573dbabeef9868096a3 |
| Shift features batch | https://basescan.org/tx/0x57f897f4220a9fe53a59b60e6c46e38797bc3205e9fcd2429552825eba9d74fa |
| JIT feature batch | https://basescan.org/tx/0x303d7c3b74885b6f42a4309092dcd4572d2e782249fd745d5beb69740b4c7e93 |
| Subaccount feature batch | https://basescan.org/tx/0x6ec7eb0454df7e7bd2660a52be39e9e99ac766aee7fc3c827bf49fe79188176e |
| Gasless feature batch | https://basescan.org/tx/0xf2d903b6272dcfb97af9c55a34553b99cc4d3c8678328db59b5107d54d1a36d3 |
| Atomic withdrawal feature batch | https://basescan.org/tx/0xf899af7767b4094f12a26e8cd47cf9482248096c6aebae36215fd1558f647fe7 |

## Base Sepolia — write batch tx hashes (84532)

ConfigKeeper: `0x6DdBBB0834084185BeF7Bd1567E835E44683600D`

| Step | Sepolia Basescan |
|------|------------------|
| Create-order disable batch | https://sepolia.basescan.org/tx/0xd50fc876e67d09b6004d00c4bfd7d10e8447fa59363683219bb49956bedaca55 |
| Execute-order disable batch | https://sepolia.basescan.org/tx/0xe01d8af6fb0a3acbb2bb042491c34752c60507c6047c12ce893b259ea3e2c828 |
| Pool risk guards batch | https://sepolia.basescan.org/tx/0x6d7943abd2cbfd5bebaa436d9d54c227bc9a9a08166079fceb62b916a4714d28 |
| Shift features batch | https://sepolia.basescan.org/tx/0x584347769a24c76594e2c8df4f06d30c42890dd96a09c127b52eb54bc58c3a72 |
| JIT feature batch | https://sepolia.basescan.org/tx/0x49be99dd148243c92bb808e8f89d68b60e8290abd93888a376a91ee09bef4aa3 |
| Subaccount feature batch | https://sepolia.basescan.org/tx/0x3b1b6c72dc5aba4f981016065bfd9f089cdbf895088065ebca9dcec31d7ad518 |
| Gasless feature batch | https://sepolia.basescan.org/tx/0x0eb1ff3a554333e6fb855966f7fb4bcbaa5dbd75a9e54245eed8a8bd7bdc72d9 |
| Atomic withdrawal feature batch | https://sepolia.basescan.org/tx/0x586f926b6dd83457034ef8c4ff4a1b021b975259f843ce9c5105ec11c536f9d3 |

Full transcript: `05-basesepolia-write.log`.

## Files in this bundle

| File | Description |
|------|-------------|
| `01-mainnet-dryrun.log` | `config:features:mainnet:dryrun` transcript |
| `02-mainnet-write.log` | `config:features:mainnet` transcript (tx sent / mined lines) |
| `03-mainnet-validate.log` | `config:features:validate:mainnet` transcript |
| `04-basesepolia-dryrun.log` | `config:features:basesepolia:dryrun` transcript (`--network baseSepolia`, chain id 84532) |
| `05-basesepolia-write.log` | `config:features:basesepolia` write transcript (`WRITE=true`, tx hashes above) |
| `06-basesepolia-validate.log` | `config:features:validate:basesepolia` transcript (readback-only profile) |
| `07-post-mainnet-note.md` | Closeout summary |
| `README.md` | This file |

## Base Sepolia — explorer

- Sepolia explorer: `https://sepolia.basescan.org/tx/<hash>` (chain id **84532**).
- Evidence this bundle hit Sepolia: `04-basesepolia-dryrun.log` (simulation) and `05-basesepolia-write.log` (on-chain writes); both show `--network baseSepolia` and Sepolia deployment addresses (e.g. `ConfigKeeper: 0x6DdBBB0834084185BeF7Bd1567E835E44683600D`).
