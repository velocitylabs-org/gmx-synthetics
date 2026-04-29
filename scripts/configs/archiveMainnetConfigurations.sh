#!/usr/bin/env bash
set -euo pipefail

timestamp="$(date +%Y%m%d-%H%M%S)"
base_dir="docs/mainnet-configurations/scrum-225-226/${timestamp}"
mkdir -p "${base_dir}"

run_and_log() {
  local label="$1"
  shift
  local logfile="${base_dir}/${label}.log"
  echo "=================================================="
  echo "Running: $*"
  echo "Log: ${logfile}"
  echo "=================================================="
  "$@" 2>&1 | tee "${logfile}"
}

{
  echo "# SCRUM225-226 Mainnet Configuration Evidence"
  echo
  echo "- Timestamp: ${timestamp}"
  echo "- Working directory: $(pwd)"
  echo "- Operator: $(whoami)"
  echo "- Git revision: $(git rev-parse HEAD 2>/dev/null || echo unknown)"
  echo "- EXECUTE_MAINNET_WRITE: ${EXECUTE_MAINNET_WRITE:-false}"
  echo
  echo "## Output files"
  echo "- \`01-mainnet-dryrun.log\`"
  echo "- \`02-mainnet-execute.log\` (only when EXECUTE_MAINNET_WRITE=true)"
  echo "- \`03-post-verify-pool-caps-first-deposit.log\` (only when EXECUTE_MAINNET_WRITE=true)"
} > "${base_dir}/README.md"

run_and_log "01-mainnet-dryrun" pnpm config:scrum225-226:mainnet:dryrun

if [[ "${EXECUTE_MAINNET_WRITE:-false}" == "true" ]]; then
  run_and_log "02-mainnet-execute" npm run scrum-225-226-configurations-mainnet
  run_and_log "03-post-verify-pool-caps-first-deposit" npx hardhat run scripts/configs/verifyPoolCapsAndFirstDeposit.ts --network base
else
  echo "Skipping mainnet write and post-verify (set EXECUTE_MAINNET_WRITE=true to enable)" | tee -a "${base_dir}/README.md"
fi

echo "Evidence archived at: ${base_dir}"
