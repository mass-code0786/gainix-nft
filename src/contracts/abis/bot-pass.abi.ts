import type { Abi } from "viem";

export const botPassAbi = [
  {
    type: "function",
    stateMutability: "payable",
    name: "subscribe",
    inputs: [{ name: "planId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "renewSubscription",
    inputs: [{ name: "planId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "subscriptionOf",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "planId", type: "uint256" },
      { name: "remainingCycles", type: "uint256" },
      { name: "active", type: "bool" },
    ],
  },
  {
    type: "event",
    anonymous: false,
    name: "SubscriptionUpdated",
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: false, name: "planId", type: "uint256" },
      { indexed: false, name: "remainingCycles", type: "uint256" },
    ],
  },
] as const satisfies Abi;
