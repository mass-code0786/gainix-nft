import type { Abi } from "viem";

export const withdrawalAbi = [
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "withdraw",
    inputs: [
      { name: "user", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "claimable",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "usdtClaimable",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "usdtToken",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "authorizeUSDTWithdrawal",
    inputs: [
      { name: "user", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "requestId", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "withdrawUSDT",
    inputs: [
      { name: "user", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "event",
    anonymous: false,
    name: "WithdrawalExecuted",
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "timestamp", type: "uint256" },
    ],
  },
  {
    type: "event",
    anonymous: false,
    name: "USDTWithdrawalAuthorized",
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: true, name: "requestId", type: "bytes32" },
    ],
  },
  {
    type: "event",
    anonymous: false,
    name: "USDTWithdrawalExecuted",
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "timestamp", type: "uint256" },
    ],
  },
] as const satisfies Abi;
