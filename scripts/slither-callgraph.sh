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
mkdir -p slither-output
# Move generated .dot files into slither-output to keep project root clean
for f in *.call-graph.dot; do
  [[ -f "$f" ]] && mv "$f" slither-output/
done
echo "Call-graph DOT files written to slither-output/, e.g.:"
echo "  - slither-output/all_contracts.call-graph.dot"
echo "  - slither-output/ExchangeRouter.call-graph.dot"
echo "  - slither-output/DepositHandler.call-graph.dot, slither-output/OrderHandler.call-graph.dot, ..."

if [[ "${1:-}" == "--render" ]]; then
  if ! command -v dot &>/dev/null; then
    echo "dot not found. Install graphviz: brew install graphviz"
    exit 1
  fi
  mkdir -p docs/diagrams
  for name in all_contracts ExchangeRouter; do
    if [[ -f "slither-output/${name}.call-graph.dot" ]]; then
      dot -Tsvg -o "docs/diagrams/${name}.call-graph.svg" "slither-output/${name}.call-graph.dot"
      dot -Tpng -o "docs/diagrams/${name}.call-graph.png" "slither-output/${name}.call-graph.dot"
      echo "Rendered docs/diagrams/${name}.call-graph.{svg,png}"
    fi
  done
fi
