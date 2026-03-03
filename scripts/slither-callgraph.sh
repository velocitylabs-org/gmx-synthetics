#!/usr/bin/env bash
# Generate Slither call-graph and other diagrams using Hardhat artifacts.
# Requires: slither (pip install slither-analyzer), graphviz (brew install graphviz), and a prior `npx hardhat compile`.
#
# Usage:
#   ./scripts/slither-callgraph.sh              # generate .dot files only
#   ./scripts/slither-callgraph.sh --render     # generate .dot and render ExchangeRouter + all_contracts to SVG/PNG

set -e
cd "$(dirname "$0")/.."

# Ensure slither is on PATH (pip user install)
export PATH="${HOME}/Library/Python/3.9/bin:${HOME}/.local/bin:$PATH"
if ! command -v slither &>/dev/null; then
  echo "slither not found. Install with: pip install slither-analyzer"
  echo "Then ensure PATH includes the install dir (e.g. export PATH=\"\$HOME/Library/Python/3.9/bin:\$PATH\")"
  exit 1
fi

echo "Running Slither (Hardhat artifacts, no recompile)..."
slither . \
  --compile-force-framework hardhat \
  --ignore-compile \
  --skip-clean \
  --print call-graph

echo ""
echo "Call-graph DOT files written in project root, e.g.:"
echo "  - all_contracts.call-graph.dot"
echo "  - ExchangeRouter.call-graph.dot"
echo "  - DepositHandler.call-graph.dot, OrderHandler.call-graph.dot, ..."

if [[ "${1:-}" == "--render" ]]; then
  if ! command -v dot &>/dev/null; then
    echo "dot not found. Install graphviz: brew install graphviz"
    exit 1
  fi
  mkdir -p docs/diagrams
  for name in all_contracts ExchangeRouter; do
    if [[ -f "${name}.call-graph.dot" ]]; then
      dot -Tsvg -o "docs/diagrams/${name}.call-graph.svg" "${name}.call-graph.dot"
      dot -Tpng -o "docs/diagrams/${name}.call-graph.png" "${name}.call-graph.dot"
      echo "Rendered docs/diagrams/${name}.call-graph.{svg,png}"
    fi
  done
fi
