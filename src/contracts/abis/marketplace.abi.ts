import type { Abi } from "viem";

export const marketplaceAbi = [
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "listItem",
    inputs: [
      { name: "nftContract", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "price", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "cancelListing",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "payable",
    name: "buyItem",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "getListing",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "listingId", type: "uint256" },
          { name: "nftContract", type: "address" },
          { name: "tokenId", type: "uint256" },
          { name: "seller", type: "address" },
          { name: "price", type: "uint256" },
          { name: "isActive", type: "bool" },
          { name: "createdAt", type: "uint64" },
          { name: "updatedAt", type: "uint64" },
        ],
      },
    ],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "activeListingIdByToken",
    inputs: [
      { name: "nftContract", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "nextListingId",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    anonymous: false,
    name: "ListingCreated",
    inputs: [
      { indexed: true, name: "listingId", type: "uint256" },
      { indexed: true, name: "seller", type: "address" },
      { indexed: false, name: "price", type: "uint256" },
      { indexed: true, name: "nftContract", type: "address" },
      { indexed: false, name: "tokenId", type: "uint256" },
      { indexed: false, name: "timestamp", type: "uint256" },
    ],
  },
  {
    type: "event",
    anonymous: false,
    name: "ListingCancelled",
    inputs: [
      { indexed: true, name: "listingId", type: "uint256" },
      { indexed: true, name: "seller", type: "address" },
      { indexed: false, name: "timestamp", type: "uint256" },
    ],
  },
  {
    type: "event",
    anonymous: false,
    name: "ListingFilled",
    inputs: [
      { indexed: true, name: "listingId", type: "uint256" },
      { indexed: true, name: "buyer", type: "address" },
      { indexed: false, name: "price", type: "uint256" },
      { indexed: true, name: "seller", type: "address" },
      { indexed: false, name: "feePaid", type: "uint256" },
      { indexed: false, name: "timestamp", type: "uint256" },
    ],
  },
] as const satisfies Abi;
