import { expect } from "chai";

import { deployFixture } from "../../utils/fixture";
import { handleDeposit } from "../../utils/deposit";
import { createOrder, executeOrder, handleOrder, OrderType } from "../../utils/order";
import { expandDecimals, decimalToFloat } from "../../utils/math";
import { errorsContract } from "../../utils/error";
import * as keys from "../../utils/keys";

describe("Config.DisabledOrderTypesReverts", () => {
  let fixture;
  let dataStore, orderHandler, ethUsdMarket, wnt;

  async function createMarketIncreasePosition() {
    await handleOrder(fixture, {
      create: {
        market: ethUsdMarket,
        initialCollateralToken: wnt,
        initialCollateralDeltaAmount: expandDecimals(10, 18),
        sizeDeltaUsd: decimalToFloat(200 * 1000),
        acceptablePrice: expandDecimals(5001, 12),
        orderType: OrderType.MarketIncrease,
        isLong: true,
      },
    });
  }

  function createParamsForOrderType(orderType: number) {
    if (orderType === OrderType.MarketSwap || orderType === OrderType.LimitSwap) {
      return {
        initialCollateralToken: wnt,
        initialCollateralDeltaAmount: expandDecimals(1, 18),
        swapPath: [ethUsdMarket.marketToken],
        orderType,
        acceptablePrice: 0,
        triggerPrice: orderType === OrderType.LimitSwap ? expandDecimals(5001, 12) : 0,
      };
    }

    if (orderType === OrderType.LimitIncrease) {
      return {
        market: ethUsdMarket,
        initialCollateralToken: wnt,
        initialCollateralDeltaAmount: expandDecimals(1, 18),
        sizeDeltaUsd: decimalToFloat(1000),
        acceptablePrice: expandDecimals(5001, 12),
        triggerPrice: expandDecimals(5000, 12),
        orderType,
        isLong: true,
      };
    }

    if (orderType === OrderType.LimitDecrease) {
      return {
        market: ethUsdMarket,
        initialCollateralToken: wnt,
        initialCollateralDeltaAmount: expandDecimals(1, 18),
        sizeDeltaUsd: decimalToFloat(1000),
        acceptablePrice: expandDecimals(4995, 12),
        triggerPrice: expandDecimals(5000, 12),
        orderType,
        isLong: true,
      };
    }

    return {
      market: ethUsdMarket,
      initialCollateralToken: wnt,
      initialCollateralDeltaAmount: expandDecimals(1, 18),
      sizeDeltaUsd: decimalToFloat(1000),
      acceptablePrice: expandDecimals(4995, 12),
      triggerPrice: expandDecimals(5002, 12),
      orderType: OrderType.StopLossDecrease,
      isLong: true,
    };
  }

  beforeEach(async function () {
    fixture = await deployFixture();
    ({ dataStore, orderHandler, ethUsdMarket, wnt } = fixture.contracts);

    await handleDeposit(fixture, {
      create: {
        market: ethUsdMarket,
        longTokenAmount: expandDecimals(1000, 18),
        shortTokenAmount: expandDecimals(2_000_000, 6),
      },
    });
  });

  it("reverts on create when disabled order types are flagged", async function () {
    const orderTypes = [
      OrderType.MarketSwap,
      OrderType.LimitSwap,
      OrderType.StopLossDecrease,
      OrderType.LimitIncrease,
      OrderType.LimitDecrease,
    ];

    for (const orderType of orderTypes) {
      const disabledKey = keys.createOrderFeatureDisabledKey(orderHandler.address, orderType);
      await dataStore.setBool(disabledKey, true);

      if ([OrderType.StopLossDecrease, OrderType.LimitDecrease].includes(orderType)) {
        await createMarketIncreasePosition();
      }

      await expect(createOrder(fixture, createParamsForOrderType(orderType)))
        .to.be.revertedWithCustomError(errorsContract, "DisabledFeature")
        .withArgs(disabledKey);

      await dataStore.setBool(disabledKey, false);
    }
  });

  it("reverts on execute when disabled order types are flagged", async function () {
    const orderTypes = [
      OrderType.MarketSwap,
      OrderType.LimitSwap,
      OrderType.StopLossDecrease,
      OrderType.LimitIncrease,
      OrderType.LimitDecrease,
    ];

    for (const orderType of orderTypes) {
      if ([OrderType.StopLossDecrease, OrderType.LimitDecrease].includes(orderType)) {
        await createMarketIncreasePosition();
      }

      await createOrder(fixture, createParamsForOrderType(orderType));
      const disabledKey = keys.executeOrderFeatureDisabledKey(orderHandler.address, orderType);
      await dataStore.setBool(disabledKey, true);

      await expect(executeOrder(fixture))
        .to.be.revertedWithCustomError(errorsContract, "DisabledFeature")
        .withArgs(disabledKey);

      await dataStore.setBool(disabledKey, false);
    }
  });
});
