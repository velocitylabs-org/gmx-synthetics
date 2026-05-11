#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
PROFILE_PATH="${SCRIPT_DIR}/profiles/feature-validation.env"
NETWORK="${1:-anvil}"

set -a
# shellcheck disable=SC1090
source "${PROFILE_PATH}"
set +a

cd "${ROOT_DIR}"
npx hardhat run scripts/configs/index.ts --network "${NETWORK}"
