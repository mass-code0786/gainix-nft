import { withdrawalAbi } from "@/contracts/abis/withdrawal.abi";
import { getGainixAddresses } from "@/contracts/config/addresses";
import type { ContractDefinition } from "@/contracts/config/types";
import { contractTestChain } from "@/contracts/config/chain";

const addresses = getGainixAddresses(contractTestChain.id);

export const withdrawalContract: ContractDefinition<typeof withdrawalAbi> = {
  name: "GainixWithdrawalVault",
  chainId: contractTestChain.id,
  address: addresses.withdrawal,
  abi: withdrawalAbi,
};

export { withdrawalAbi };
