import { encodeData, hashData, hashString } from "../../../utils/hash";
import * as keys from "../../../utils/keys";
import { OrderType } from "../../../utils/order";
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getDeployedContract } from "./getDeployedContract";

export type ManagedFeatureId =
  | "CREATE_ORDER_FEATURE_DISABLED_MARKET_SWAP"
  | "CREATE_ORDER_FEATURE_DISABLED_LIMIT_SWAP"
  | "CREATE_ORDER_FEATURE_DISABLED_STOP_LOSS_DECREASE"
  | "CREATE_ORDER_FEATURE_DISABLED_LIMIT_INCREASE"
  | "CREATE_ORDER_FEATURE_DISABLED_LIMIT_DECREASE"
  | "EXECUTE_ORDER_FEATURE_DISABLED_MARKET_SWAP"
  | "EXECUTE_ORDER_FEATURE_DISABLED_LIMIT_SWAP"
  | "EXECUTE_ORDER_FEATURE_DISABLED_STOP_LOSS_DECREASE"
  | "EXECUTE_ORDER_FEATURE_DISABLED_LIMIT_INCREASE"
  | "EXECUTE_ORDER_FEATURE_DISABLED_LIMIT_DECREASE"
  | "CREATE_SHIFT_FEATURE_DISABLED"
  | "CANCEL_SHIFT_FEATURE_DISABLED"
  | "EXECUTE_SHIFT_FEATURE_DISABLED"
  | "EXECUTE_ATOMIC_WITHDRAWAL_FEATURE_DISABLED"
  | "JIT_FEATURE_DISABLED"
  | "SUBACCOUNT_FEATURE_DISABLED"
  | "GASLESS_FEATURE_DISABLED";

type ManagedFeatureScope = "module" | "module_with_order_type";

type ManagedFeatureSpecBase = {
  id: ManagedFeatureId;
  label: string;
  baseKey: string;
  scope: ManagedFeatureScope;
  defaultModuleContractNames: string[];
  moduleContractsEnvVar?: string;
};

export type ModuleFeatureSpec = ManagedFeatureSpecBase & {
  scope: "module";
};

export type OrderTypeFeatureSpec = ManagedFeatureSpecBase & {
  scope: "module_with_order_type";
  orderType: number;
};

export type ManagedFeatureSpec = ModuleFeatureSpec | OrderTypeFeatureSpec;

// `SUBACCOUNT_FEATURE_DISABLED` exists in on-chain Keys but is not currently exported in utils/keys.ts.
const SUBACCOUNT_FEATURE_DISABLED = hashString("SUBACCOUNT_FEATURE_DISABLED");

export const FEATURE_FLAG_SPECS: Record<ManagedFeatureId, ManagedFeatureSpec> = {
  CREATE_ORDER_FEATURE_DISABLED_MARKET_SWAP: {
    id: "CREATE_ORDER_FEATURE_DISABLED_MARKET_SWAP",
    label: "Disable create MarketSwap order",
    baseKey: keys.CREATE_ORDER_FEATURE_DISABLED,
    scope: "module_with_order_type",
    orderType: OrderType.MarketSwap,
    defaultModuleContractNames: ["OrderHandler"],
    moduleContractsEnvVar: "ORDER_FEATURE_MODULES",
  },
  CREATE_ORDER_FEATURE_DISABLED_LIMIT_SWAP: {
    id: "CREATE_ORDER_FEATURE_DISABLED_LIMIT_SWAP",
    label: "Disable create LimitSwap order",
    baseKey: keys.CREATE_ORDER_FEATURE_DISABLED,
    scope: "module_with_order_type",
    orderType: OrderType.LimitSwap,
    defaultModuleContractNames: ["OrderHandler"],
    moduleContractsEnvVar: "ORDER_FEATURE_MODULES",
  },
  CREATE_ORDER_FEATURE_DISABLED_STOP_LOSS_DECREASE: {
    id: "CREATE_ORDER_FEATURE_DISABLED_STOP_LOSS_DECREASE",
    label: "Disable create StopLossDecrease order",
    baseKey: keys.CREATE_ORDER_FEATURE_DISABLED,
    scope: "module_with_order_type",
    orderType: OrderType.StopLossDecrease,
    defaultModuleContractNames: ["OrderHandler"],
    moduleContractsEnvVar: "ORDER_FEATURE_MODULES",
  },
  CREATE_ORDER_FEATURE_DISABLED_LIMIT_INCREASE: {
    id: "CREATE_ORDER_FEATURE_DISABLED_LIMIT_INCREASE",
    label: "Disable create LimitIncrease order",
    baseKey: keys.CREATE_ORDER_FEATURE_DISABLED,
    scope: "module_with_order_type",
    orderType: OrderType.LimitIncrease,
    defaultModuleContractNames: ["OrderHandler"],
    moduleContractsEnvVar: "ORDER_FEATURE_MODULES",
  },
  CREATE_ORDER_FEATURE_DISABLED_LIMIT_DECREASE: {
    id: "CREATE_ORDER_FEATURE_DISABLED_LIMIT_DECREASE",
    label: "Disable create LimitDecrease order",
    baseKey: keys.CREATE_ORDER_FEATURE_DISABLED,
    scope: "module_with_order_type",
    orderType: OrderType.LimitDecrease,
    defaultModuleContractNames: ["OrderHandler"],
    moduleContractsEnvVar: "ORDER_FEATURE_MODULES",
  },
  EXECUTE_ORDER_FEATURE_DISABLED_MARKET_SWAP: {
    id: "EXECUTE_ORDER_FEATURE_DISABLED_MARKET_SWAP",
    label: "Disable execute MarketSwap order",
    baseKey: keys.EXECUTE_ORDER_FEATURE_DISABLED,
    scope: "module_with_order_type",
    orderType: OrderType.MarketSwap,
    defaultModuleContractNames: ["OrderHandler"],
    moduleContractsEnvVar: "ORDER_FEATURE_MODULES",
  },
  EXECUTE_ORDER_FEATURE_DISABLED_LIMIT_SWAP: {
    id: "EXECUTE_ORDER_FEATURE_DISABLED_LIMIT_SWAP",
    label: "Disable execute LimitSwap order",
    baseKey: keys.EXECUTE_ORDER_FEATURE_DISABLED,
    scope: "module_with_order_type",
    orderType: OrderType.LimitSwap,
    defaultModuleContractNames: ["OrderHandler"],
    moduleContractsEnvVar: "ORDER_FEATURE_MODULES",
  },
  EXECUTE_ORDER_FEATURE_DISABLED_STOP_LOSS_DECREASE: {
    id: "EXECUTE_ORDER_FEATURE_DISABLED_STOP_LOSS_DECREASE",
    label: "Disable execute StopLossDecrease order",
    baseKey: keys.EXECUTE_ORDER_FEATURE_DISABLED,
    scope: "module_with_order_type",
    orderType: OrderType.StopLossDecrease,
    defaultModuleContractNames: ["OrderHandler"],
    moduleContractsEnvVar: "ORDER_FEATURE_MODULES",
  },
  EXECUTE_ORDER_FEATURE_DISABLED_LIMIT_INCREASE: {
    id: "EXECUTE_ORDER_FEATURE_DISABLED_LIMIT_INCREASE",
    label: "Disable execute LimitIncrease order",
    baseKey: keys.EXECUTE_ORDER_FEATURE_DISABLED,
    scope: "module_with_order_type",
    orderType: OrderType.LimitIncrease,
    defaultModuleContractNames: ["OrderHandler"],
    moduleContractsEnvVar: "ORDER_FEATURE_MODULES",
  },
  EXECUTE_ORDER_FEATURE_DISABLED_LIMIT_DECREASE: {
    id: "EXECUTE_ORDER_FEATURE_DISABLED_LIMIT_DECREASE",
    label: "Disable execute LimitDecrease order",
    baseKey: keys.EXECUTE_ORDER_FEATURE_DISABLED,
    scope: "module_with_order_type",
    orderType: OrderType.LimitDecrease,
    defaultModuleContractNames: ["OrderHandler"],
    moduleContractsEnvVar: "ORDER_FEATURE_MODULES",
  },
  CREATE_SHIFT_FEATURE_DISABLED: {
    id: "CREATE_SHIFT_FEATURE_DISABLED",
    label: "Disable shift creation",
    baseKey: keys.CREATE_SHIFT_FEATURE_DISABLED,
    scope: "module",
    defaultModuleContractNames: ["ShiftHandler"],
    moduleContractsEnvVar: "SHIFT_FEATURE_MODULES",
  },
  CANCEL_SHIFT_FEATURE_DISABLED: {
    id: "CANCEL_SHIFT_FEATURE_DISABLED",
    label: "Disable shift cancellation",
    baseKey: keys.CANCEL_SHIFT_FEATURE_DISABLED,
    scope: "module",
    defaultModuleContractNames: ["ShiftHandler"],
    moduleContractsEnvVar: "SHIFT_FEATURE_MODULES",
  },
  EXECUTE_SHIFT_FEATURE_DISABLED: {
    id: "EXECUTE_SHIFT_FEATURE_DISABLED",
    label: "Disable shift execution",
    baseKey: keys.EXECUTE_SHIFT_FEATURE_DISABLED,
    scope: "module",
    defaultModuleContractNames: ["ShiftHandler"],
    moduleContractsEnvVar: "SHIFT_FEATURE_MODULES",
  },
  EXECUTE_ATOMIC_WITHDRAWAL_FEATURE_DISABLED: {
    id: "EXECUTE_ATOMIC_WITHDRAWAL_FEATURE_DISABLED",
    label: "Disable atomic withdrawal execution",
    baseKey: keys.EXECUTE_ATOMIC_WITHDRAWAL_FEATURE_DISABLED,
    scope: "module",
    defaultModuleContractNames: ["WithdrawalHandler"],
    moduleContractsEnvVar: "ATOMIC_WITHDRAWAL_FEATURE_MODULES",
  },
  JIT_FEATURE_DISABLED: {
    id: "JIT_FEATURE_DISABLED",
    label: "Disable JIT execution path",
    baseKey: keys.JIT_FEATURE_DISABLED,
    scope: "module",
    defaultModuleContractNames: ["JitOrderHandler"],
    moduleContractsEnvVar: "JIT_FEATURE_MODULES",
  },
  SUBACCOUNT_FEATURE_DISABLED: {
    id: "SUBACCOUNT_FEATURE_DISABLED",
    label: "Disable subaccount delegation flows",
    baseKey: SUBACCOUNT_FEATURE_DISABLED,
    scope: "module",
    defaultModuleContractNames: ["SubaccountRouter", "SubaccountGelatoRelayRouter", "MultichainSubaccountRouter"],
    moduleContractsEnvVar: "SUBACCOUNT_FEATURE_MODULES",
  },
  GASLESS_FEATURE_DISABLED: {
    id: "GASLESS_FEATURE_DISABLED",
    label: "Disable gasless relay flows",
    baseKey: keys.GASLESS_FEATURE_DISABLED,
    scope: "module",
    defaultModuleContractNames: [
      "GelatoRelayRouter",
      "SubaccountGelatoRelayRouter",
      "MultichainClaimsRouter",
      "MultichainTransferRouter",
      "MultichainOrderRouter",
      "MultichainGmRouter",
      "MultichainGlvRouter",
      "MultichainSubaccountRouter",
    ],
    moduleContractsEnvVar: "GASLESS_FEATURE_MODULES",
  },
};

export const ORDER_FEATURE_SPECS: OrderTypeFeatureSpec[] = [
  FEATURE_FLAG_SPECS.CREATE_ORDER_FEATURE_DISABLED_MARKET_SWAP,
  FEATURE_FLAG_SPECS.CREATE_ORDER_FEATURE_DISABLED_LIMIT_SWAP,
  FEATURE_FLAG_SPECS.CREATE_ORDER_FEATURE_DISABLED_STOP_LOSS_DECREASE,
  FEATURE_FLAG_SPECS.CREATE_ORDER_FEATURE_DISABLED_LIMIT_INCREASE,
  FEATURE_FLAG_SPECS.CREATE_ORDER_FEATURE_DISABLED_LIMIT_DECREASE,
  FEATURE_FLAG_SPECS.EXECUTE_ORDER_FEATURE_DISABLED_MARKET_SWAP,
  FEATURE_FLAG_SPECS.EXECUTE_ORDER_FEATURE_DISABLED_LIMIT_SWAP,
  FEATURE_FLAG_SPECS.EXECUTE_ORDER_FEATURE_DISABLED_STOP_LOSS_DECREASE,
  FEATURE_FLAG_SPECS.EXECUTE_ORDER_FEATURE_DISABLED_LIMIT_INCREASE,
  FEATURE_FLAG_SPECS.EXECUTE_ORDER_FEATURE_DISABLED_LIMIT_DECREASE,
];

export const SHIFT_FEATURE_SPECS: ManagedFeatureSpec[] = [
  FEATURE_FLAG_SPECS.CREATE_SHIFT_FEATURE_DISABLED,
  FEATURE_FLAG_SPECS.CANCEL_SHIFT_FEATURE_DISABLED,
  FEATURE_FLAG_SPECS.EXECUTE_SHIFT_FEATURE_DISABLED,
];

export const NON_SHIFT_FEATURE_SPECS: ManagedFeatureSpec[] = [
  FEATURE_FLAG_SPECS.EXECUTE_ATOMIC_WITHDRAWAL_FEATURE_DISABLED,
  FEATURE_FLAG_SPECS.JIT_FEATURE_DISABLED,
  FEATURE_FLAG_SPECS.SUBACCOUNT_FEATURE_DISABLED,
  FEATURE_FLAG_SPECS.GASLESS_FEATURE_DISABLED,
];

// Remaining redaction set (this ticket scope only).
export const REMAINING_REDACTION_FEATURE_SPECS: ManagedFeatureSpec[] = [...SHIFT_FEATURE_SPECS, ...NON_SHIFT_FEATURE_SPECS];

// Canonical superset across SCRUM225 + remaining redaction feature set.
export const ALL_MANAGED_FEATURE_SPECS: ManagedFeatureSpec[] = [...ORDER_FEATURE_SPECS, ...REMAINING_REDACTION_FEATURE_SPECS];

export function encodeFeatureModuleData(moduleAddress: string): string {
  return encodeData(["address"], [moduleAddress]);
}

export function encodeFeatureData(spec: ManagedFeatureSpec, moduleAddress: string): string {
  if (spec.scope === "module_with_order_type") {
    return encodeData(["address", "uint256"], [moduleAddress, spec.orderType]);
  }

  return encodeFeatureModuleData(moduleAddress);
}

export function getFeatureFlagStorageKey(baseKey: string, moduleAddress: string): string {
  return hashData(["bytes32", "address"], [baseKey, moduleAddress]);
}

export function getFeatureFlagStorageKeyForSpec(spec: ManagedFeatureSpec, moduleAddress: string): string {
  if (spec.scope === "module_with_order_type") {
    return hashData(["bytes32", "address", "uint256"], [spec.baseKey, moduleAddress, spec.orderType]);
  }

  return getFeatureFlagStorageKey(spec.baseKey, moduleAddress);
}

export function resolveModuleContractNames(spec: ManagedFeatureSpec, env = process.env): string[] {
  if (!spec.moduleContractsEnvVar) {
    return spec.defaultModuleContractNames;
  }

  const value = env[spec.moduleContractsEnvVar];
  if (!value) {
    return spec.defaultModuleContractNames;
  }

  const parsed = value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : spec.defaultModuleContractNames;
}


export async function resolveModuleAddress(hre: HardhatRuntimeEnvironment, contractName: string): Promise<string> {
  if (contractName === "OrderHandler" && process.env.ORDER_HANDLER) {
    return process.env.ORDER_HANDLER;
  }

  const contract = await getDeployedContract(hre, contractName);
  return contract.address;
}
