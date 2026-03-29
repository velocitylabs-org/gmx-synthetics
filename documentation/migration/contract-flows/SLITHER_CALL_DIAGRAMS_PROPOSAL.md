# Slither Function-Call Diagrams — Proposal

This document proposes how to use **Slither** to generate function-call diagrams for the flow:

**Users & LPs (EOA) → Routers (ExchangeRouter) → Handlers → Libraries / Utils / DataStore**

---

## 1. What we want to diagram

| Layer | Contracts | Main functions |
|-------|------------|----------------|
| **Entry (Router)** | `ExchangeRouter` | `createDeposit()`, `cancelDeposit()`, `createWithdrawal()`, `createOrder()`, `updateOrder()`, `cancelOrder()`, `multicall()`, `sendWnt()`, `sendTokens()` |
| **Handlers** | `DepositHandler`, `WithdrawalHandler`, `OrderHandler`, … (in `exchange/`) | e.g. `OrderHandler.executeOrder()` (keeper-only), handler `create*` / `cancel*` |
| **Libraries / Utils / DataStore** | `DepositStoreUtils`, `OrderUtils`, `TokenUtils`, `GasUtils`, `DataStore`, etc. | Called by handlers and routers |

The **Exchange Router** is the main user-facing entry; many actions go through **`multicall()`** (e.g. `sendWnt()` + `createDeposit()` or `createOrder()`).

---

## 2. Slither tools to use

- **`call-graph` printer**  
  Exports the call graph (who calls whom) to a **DOT** file. Use this as the main source for "Router → Handler → Libraries/Utils/DataStore" diagrams.

- **`function-summary` printer**  
  Prints per-function internal/external calls in a table. Useful to double-check and to document modifiers (e.g. `onlyOrderKeeper` on `executeOrder()`).

- **`inheritance-graph` printer** (optional)  
  DOT graph of inheritance (e.g. `ExchangeRouter` → `BaseRouter` → `PayableMulticall`). Helps show which entry points (e.g. `multicall`, `sendWnt`) live on the router.

---

## 3. Setup

### 3.1 Install Slither

**Option A — Pip (recommended for scripting)**

```bash
pip install slither-analyzer
# or
pipx install slither-analyzer
```

**Option B — Docker**

```bash
docker pull trailofbits/eth-security-toolbox
# run slither from inside the container with project mounted
```

**Option C — NPM (Hardhat plugin)**

```bash
npm install --save-dev hardhat-slither
# Then in hardhat.config.ts: require("hardhat-slither");
# Run: npx hardhat slither
```

### 3.2 Graphviz (to render DOT)

Required to turn `.dot` files into PNG/SVG:

```bash
# macOS
brew install graphviz
```

### 3.3 PATH (pip user install)

If you used `pip install slither-analyzer` (or `pip3`), the `slither` binary is often installed in the user Python bin directory, which may not be on your PATH. Add it so the `slither` command works:

```bash
# macOS / Linux — add to PATH for this session
export PATH="$HOME/Library/Python/3.9/bin:$PATH"

# To make it permanent, add the line above to ~/.zshrc or ~/.bashrc
```

Then verify:

```bash
slither --version   # e.g. 0.11.4
dot -V              # e.g. graphviz version 12.2.1
```

### 3.4 Verify setup (optional)

From the project root after `npx hardhat compile`:

```bash
slither . --compile-force-framework hardhat --ignore-compile --skip-clean --print function-summary 2>&1 | head -80
```

If this prints contract/function tables (and any IR parsing warnings), Slither is using Hardhat's artifacts correctly.

---

## 4. Recommended workflow

### Why plain `slither .` fails

This repo has both **Foundry** (`foundry.toml`) and **Hardhat**. Slither detects Foundry first and runs `forge build`, which fails with **"Stack too deep"** in some contracts (e.g. `ExecuteWithdrawalUtils.sol`) because Foundry's default solc settings don't use `via_ir`. Hardhat compiles the same code successfully.

**Fix:** Force Slither to use **Hardhat** and **existing artifacts** (no recompile):

```bash
slither . --compile-force-framework hardhat --ignore-compile --skip-clean --print call-graph
```

- `--compile-force-framework hardhat` — use Hardhat instead of Foundry  
- `--ignore-compile` — don't run `hardhat compile` / `forge build`; use existing `artifacts/`  
- `--skip-clean` — don't run `hardhat clean` before compile

Ensure Hardhat has already compiled once: `npx hardhat compile`.

### Step 1: Compile the project (once)

Ensure Hardhat artifacts exist:

```bash
npx hardhat compile
```

### Step 2: Run Slither from repo root

From the project root:

```bash
# Add Slither to PATH if you used pip (see 3.3)
export PATH="$HOME/Library/Python/3.9/bin:$PATH"

# Call graph — writes .dot files in the current directory
slither . --compile-force-framework hardhat --ignore-compile --skip-clean --print call-graph

# Human-readable function summary (calls + modifiers)
slither . --compile-force-framework hardhat --ignore-compile --skip-clean --print function-summary

# Optional: inheritance only
slither . --compile-force-framework hardhat --ignore-compile --skip-clean --print inheritance-graph
```

Output: Slither writes DOT files in the **current directory**, including:

- `all_contracts.call-graph.dot` — full call graph (large)
- `ExchangeRouter.call-graph.dot`, `DepositHandler.call-graph.dot`, `OrderHandler.call-graph.dot`, etc. — per-contract graphs

### Step 3: Locate the DOT output

Check Slither's stdout for a line like:

```text
INFO:Printers:Call Graph: path/to/output.dot
```

Often the file is written next to the first input contract or in the current directory.

### Step 4: Render the diagram

```bash
# Replace with actual path from Slither output
dot -Tpng -o call-graph.png path/to/output.dot
dot -Tsvg -o call-graph.svg path/to/output.dot
```

### Step 5: Focus the diagram (optional)

The full call graph can be large. To emphasize **Router → Handlers → Utils/DataStore**:

- **Option A — Filter by contract names**  
  Write a small script (e.g. Python) that reads the DOT file and keeps only nodes (and edges between them) whose labels match:
  - Routers: `ExchangeRouter`, `BaseRouter`, `SubaccountRouter`, etc.
  - Handlers: `DepositHandler`, `WithdrawalHandler`, `OrderHandler`, …
  - Utils/Libraries/DataStore: `DepositStoreUtils`, `OrderUtils`, `TokenUtils`, `GasUtils`, `DataStore`, `EventEmitter`, etc.  
  Then render the filtered DOT.

- **Option B — Target specific entry contracts**  
  Run Slither only on the router and exchange directories so the graph is smaller:
  ```bash
  slither contracts/router/ExchangeRouter.sol contracts/exchange/DepositHandler.sol contracts/exchange/OrderHandler.sol contracts/exchange/WithdrawalHandler.sol --compile-force-framework hardhat --ignore-compile --skip-clean --print call-graph
  ```
  (Adjust list to match the handlers you care about; Slither will pull in dependencies and still produce a full graph for those files.)

- **Option C — Use `function-summary`**  
  Grep the function-summary output for `ExchangeRouter`, `createDeposit`, `createOrder`, `executeOrder`, etc., and manually draw or refine a Mermaid/diagram focused on the six entry points and keeper flows.

---

## 5. Diagram content to highlight

When documenting the flow, it helps to make explicit:

1. **EOA → Router**  
   Entry points: `createDeposit`, `cancelDeposit`, `createWithdrawal`, `createOrder`, `updateOrder`, `cancelOrder`, and `multicall` (which delegates to `sendWnt` / `sendTokens` and the above).

2. **Router → Handlers**  
   - `ExchangeRouter.createDeposit` → `depositHandler.createDeposit`
   - `ExchangeRouter.createWithdrawal` → `withdrawalHandler.createWithdrawal`
   - `ExchangeRouter.createOrder` / `updateOrder` / `cancelOrder` → `orderHandler.*`

3. **Handlers → Utils / DataStore**  
   From the call graph you'll see Handler calls into `*StoreUtils`, `*Utils`, `DataStore`, `EventEmitter`, etc.

4. **Keeper/relayer-only paths**  
   e.g. `OrderHandler.executeOrder()` (and other `onlyOrderKeeper` functions in `exchange/`). The **function-summary** printer shows modifiers, so you can annotate the diagram with "keeper-only" where relevant.

5. **multicall**  
   In the call graph, `multicall` will show as calling `delegatecall` (or similar); the actual user-facing "logical" flow is "EOA calls multicall with payload [sendWnt, createDeposit]" so the diagram can show `multicall` as an alternate entry that leads to the same handler functions.

---

## 6. Suggested repo layout (optional)

If you automate this, you could add:

- `scripts/slither-callgraph.sh` — runs `slither . --print call-graph` and then `dot` to produce `docs/diagrams/call-graph.png` (or `.svg`).
- `scripts/slither-summary.sh` — runs `slither . --print function-summary` and redirects to `docs/diagrams/function-summary.txt`.
- Optionally a small Python/Node script that filters the DOT by the contract list above and writes `docs/diagrams/call-graph-router-handlers.dot` and a rendered image.

---

## 7. Summary

| Goal | Slither command | Output |
|------|------------------|--------|
| Full function call graph | `slither . --compile-force-framework hardhat --ignore-compile --skip-clean --print call-graph` | `.dot` in project root (e.g. `all_contracts.call-graph.dot`) → PNG/SVG |
| Per-function calls + modifiers | `slither . --compile-force-framework hardhat --ignore-compile --skip-clean --print function-summary` | Text (e.g. for annotating diagrams) |
| Inheritance (router/handlers) | `slither . --compile-force-framework hardhat --ignore-compile --skip-clean --print inheritance-graph` | `.dot` → PNG/SVG |
| Focused graph | Slither on specific contracts with same flags, or filter DOT | Smaller diagram for Router → Handlers → Utils |

Running the call-graph command above (after `npx hardhat compile`) writes DOT files in the project root; use **function-summary** to document keeper-only and other access control on the diagram.
