# 2026-05-11 — Feature redaction (pre-launch hardening)

Disabled protocol features that are not needed for the initial Nivo mainnet launch.
Applied to Base mainnet (8453) and Base Sepolia (84532) on 2026-05-11.

## What was changed

| Feature | Action |
|---------|--------|
| Order creation | Disabled |
| Order execution | Disabled |
| Pool risk guards | Applied caps + disabled inactive markets |
| Shift (create / cancel / execute) | Disabled |
| JIT execution | Disabled |
| Subaccount delegation | Disabled |
| Gasless relay flows | Disabled |
| Atomic withdrawal execution | Disabled |

## Config keeper

| Network | Address |
|---------|---------|
| Base mainnet | `0xAed31d3C8942B38eec87Fe5830a671C1A3D0d967` |
| Base Sepolia | `0x6DdBBB0834084185BeF7Bd1567E835E44683600D` |

## Base mainnet — transaction hashes

| Batch | Basescan |
|-------|----------|
| Create-order disable | https://basescan.org/tx/0xabeeeb3c295384e0a1a5025decba228cfd2ec52c865e865d05ce4ff3f121f583 |
| Execute-order disable | https://basescan.org/tx/0xcb411e783bcf389fd7155a01d915a05ba50e227d896c32fb04bd91d1ab79ac2f |
| Pool risk guards | https://basescan.org/tx/0x17b9513d14fc369a1726144d8a19469123a08ed4d5b8d573dbabeef9868096a3 |
| Shift features | https://basescan.org/tx/0x57f897f4220a9fe53a59b60e6c46e38797bc3205e9fcd2429552825eba9d74fa |
| JIT feature | https://basescan.org/tx/0x303d7c3b74885b6f42a4309092dcd4572d2e782249fd745d5beb69740b4c7e93 |
| Subaccount feature | https://basescan.org/tx/0x6ec7eb0454df7e7bd2660a52be39e9e99ac766aee7fc3c827bf49fe79188176e |
| Gasless feature | https://basescan.org/tx/0xf2d903b6272dcfb97af9c55a34553b99cc4d3c8678328db59b5107d54d1a36d3 |
| Atomic withdrawal feature | https://basescan.org/tx/0xf899af7767b4094f12a26e8cd47cf9482248096c6aebae36215fd1558f647fe7 |

## Base Sepolia — transaction hashes

| Batch | Sepolia Basescan |
|-------|-----------------|
| Create-order disable | https://sepolia.basescan.org/tx/0xd50fc876e67d09b6004d00c4bfd7d10e8447fa59363683219bb49956bedaca55 |
| Execute-order disable | https://sepolia.basescan.org/tx/0xe01d8af6fb0a3acbb2bb042491c34752c60507c6047c12ce893b259ea3e2c828 |
| Pool risk guards | https://sepolia.basescan.org/tx/0x6d7943abd2cbfd5bebaa436d9d54c227bc9a9a08166079fceb62b916a4714d28 |
| Shift features | https://sepolia.basescan.org/tx/0x584347769a24c76594e2c8df4f06d30c42890dd96a09c127b52eb54bc58c3a72 |
| JIT feature | https://sepolia.basescan.org/tx/0x49be99dd148243c92bb808e8f89d68b60e8290abd93888a376a91ee09bef4aa3 |
| Subaccount feature | https://sepolia.basescan.org/tx/0x3b1b6c72dc5aba4f981016065bfd9f089cdbf895088065ebca9dcec31d7ad518 |
| Gasless feature | https://sepolia.basescan.org/tx/0x0eb1ff3a554333e6fb855966f7fb4bcbaa5dbd75a9e54245eed8a8bd7bdc72d9 |
| Atomic withdrawal feature | https://sepolia.basescan.org/tx/0x586f926b6dd83457034ef8c4ff4a1b021b975259f843ce9c5105ec11c536f9d3 |

## Evidence files

`write.log` was never captured and cannot be reconstructed. The transaction hashes above are the permanent on-chain record.

| File | Contents |
|------|----------|
| `validate-retroactive-2026-06-30.log` | Retroactive readback — captured 2026-06-30 to close the original validation gap; confirms on-chain state is unchanged |

## Validation coverage gap

RESOLVED — see `validate-retroactive-2026-06-30.log`. `verifyFeaturesState.ts` has since been extended to cover order create/execute, closing the original gap.
