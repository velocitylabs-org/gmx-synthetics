#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
NETWORK="${1:-anvil}"

cd "${ROOT_DIR}"
WRITE=false TARGET_DISABLED_STATE=true FAIL_ON_MISMATCH=true FEATURES=validate npx hardhat run scripts/configs/index.ts --network "${NETWORK}"
