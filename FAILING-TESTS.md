# Six Remaining Failing Tests

Run only these tests:

```bash
npm run test:failing
```

(or `npx hardhat test test/multichain/MultichainSubaccountRouter.ts test/router/SubaccountRouter.ts test/router/relay/GelatoRelayRouter.ts test/router/relay/SubaccountGelatoRelayRouter.ts --grep "execution fee should be capped|sponsoredCall: relay fee configuration|MarketIncrease order"`)

---

## 1. SubaccountRouter — "MarketIncrease order"

- **File:** `test/router/SubaccountRouter.ts`
- **Test:** `it("MarketIncrease order", ...)` (around line 86)
- **Failure location:** Line 271 — `expectBalance(wnt.address, user2.address, ["97887749120000000", "1000000000000"])`
- **What it does:** Creates a subaccount, sends WNT, adds subaccount, sets limits, creates a market-increase order, then checks that after the order is placed (before execution) the WNT balance of `user2` is close to `97887749120000000` (≈0.0979 WETH) with tolerance `1000000000000` (1e12 wei).
- **Why it fails:** Actual balance is `97910746040000000` (≈0.09791 WETH). The difference from expected is ~23e12 wei, which is larger than the allowed tolerance of 1e12. So either:
  - Gas/execution fees differ slightly from when the expected value was written, or
  - The tolerance is too tight and should be increased (e.g. to ~1e15 or a small percentage).

---

## 2. GelatoRelayRouter — "sponsoredCall: relay fee configuration"

- **File:** `test/router/relay/GelatoRelayRouter.ts`
- **Test:** `it("sponsoredCall: relay fee configuration", ...)` (line 609)
- **Failure location:** Line 679 — `expect(feeReceiverFromCalldata).eq(GELATO_RELAY_ADDRESS)`
- **What it does:** Sets relay fee config, sends createOrder as a “sponsored” call (fee receiver = user3), then parses the last 72 bytes of the tx calldata to read `feeReceiver`, `feeToken`, `feeAmount`. It asserts that the fee receiver address in calldata equals `GELATO_RELAY_ADDRESS`.
- **Why it fails:** `ethers.utils.getAddress(...)` on the calldata returns an EIP-55 checksummed address (mixed case). The constant `GELATO_RELAY_ADDRESS` is also mixed case. If the constant was ever changed to lowercase for hardhat-network-helpers, this assertion fails (expected string differs). Fix: compare addresses case-insensitively (e.g. `.toLowerCase()` on both) or ensure the constant matches the checksum form returned by `getAddress`.

---

## 3. SubaccountGelatoRelayRouter — "execution fee should be capped"

- **File:** `test/router/relay/SubaccountGelatoRelayRouter.ts`
- **Test:** `it("execution fee should be capped", ...)` (line 206)
- **Failure location:** Line 219 — `expect(order.numbers.executionFee).eq("9003720880000000")`
- **What it does:** Sets holding address and fee multiplier to 1, sets a high fee (101e15) and execution fee (1e17), sends createOrder, then checks that the order’s stored `executionFee` is exactly `9003720880000000` (≈0.009 WETH) and that user3’s WNT balance is `90996279120000000`.
- **Why it fails:** Actual `order.numbers.executionFee` is `8989804920000000` (slightly lower). The expected value is a fixed number that depends on gas and relay fee behavior. Small changes in gas consumption or fee logic produce a different stored execution fee. Options: relax to `closeTo("9003720880000000", tolerance)` with a small tolerance, or recompute the expected value for the current code/gas.

---

## 4. SubaccountGelatoRelayRouter — "execution fee should be capped if increased"

- **File:** `test/router/relay/SubaccountGelatoRelayRouter.ts`
- **Test:** `it("execution fee should be capped if increased", ...)` (line 991)
- **Failure location:** Line 1025 — `expect(order.numbers.executionFee).closeTo("8039135020000000", "10000000000000")`
- **What it does:** Creates an order with 1e15 execution fee, then sends an updateOrder that increases execution fee by 1e17 (with 2e17 fee paid). Asserts the order’s new `executionFee` is close to `8039135020000000` and holding-address WNT balance close to `92960864980000000`, both with tolerance 1e13.
- **Why it fails:** Actual execution fee is `7949457040000000` (or similar), outside the 1e13 window. Same cause as #3: exact fee depends on gas and capping logic; the hardcoded expected value or tolerance no longer matches. Adjust expected value or tolerance (e.g. larger tolerance or `closeTo` with a percentage).

---

## 5. MultichainSubaccountRouter — "execution fee should be capped"

- **File:** `test/multichain/MultichainSubaccountRouter.ts`
- **Test:** `it("execution fee should be capped", ...)` (line 235)
- **Failure location:** Line 248 — `expect(order.numbers.executionFee).eq("9003720880000000")` and line 249 — `expectBalance(wnt.address, user3.address, "90996279120000000")`
- **What it does:** Same scenario as #3 but in the multichain subaccount router: create order with high fee and execution fee, then assert exact stored execution fee and user3 WNT balance.
- **Why it fails:** Same as #3: actual execution fee is `8989804920000000` (or similar). Fix by using `closeTo` with a small tolerance or updating the expected value.

---

## 6. MultichainSubaccountRouter — "execution fee should be capped if increased"

- **File:** `test/multichain/MultichainSubaccountRouter.ts`
- **Test:** `it("execution fee should be capped if increased", ...)` (line 931)
- **Failure location:** Line 965 — `expect(order.numbers.executionFee).closeTo("8058060700000000", "10000000000000")` and line 966 — balance `closeTo("92941939300000000", "10000000000000")`
- **What it does:** Same as #4 but in the multichain subaccount router: create order, then update order with execution fee increase and check capped execution fee and holding balance.
- **Why it fails:** Actual values differ from the hardcoded expectations (e.g. `7958017440000000` vs `8058060700000000`). Again, gas/fee behavior has shifted. Fix by increasing tolerance or recomputing expected values.

---

## Summary

| # | Suite                      | Test name                              | Failure type        | Suggested fix                          |
|---|----------------------------|----------------------------------------|---------------------|----------------------------------------|
| 1 | SubaccountRouter           | MarketIncrease order                    | Balance tolerance   | Increase tolerance or adjust expected  |
| 2 | GelatoRelayRouter          | sponsoredCall: relay fee configuration | Address casing      | Compare addresses case-insensitively   |
| 3 | SubaccountGelatoRelayRouter| execution fee should be capped         | Exact fee match     | Use closeTo with tolerance             |
| 4 | SubaccountGelatoRelayRouter| execution fee should be capped if increased | closeTo out of range | Increase tolerance or expected       |
| 5 | MultichainSubaccountRouter | execution fee should be capped         | Same as #3          | Use closeTo with tolerance             |
| 6 | MultichainSubaccountRouter | execution fee should be capped if increased | Same as #4      | Increase tolerance or expected         |
