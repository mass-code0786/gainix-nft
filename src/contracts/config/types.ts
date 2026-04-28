import type { Abi, Address } from "viem";

export interface ContractDefinition<TAbi extends Abi> {
  name: string;
  chainId: number;
  address: Address;
  abi: TAbi;
}
