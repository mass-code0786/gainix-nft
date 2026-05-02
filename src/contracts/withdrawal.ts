import { withdrawalAbi } from "@/contracts/abis/withdrawal.abi";
import { getGainixAddresses } from "@/contracts/config/addresses";
import type { ContractDefinition } from "@/contracts/config/types";
import { contractActiveChainId } from "@/contracts/config/chain";

const addresses = getGainixAddresses(contractActiveChainId);

export const withdrawalContract: ContractDefinition<typeof withdrawalAbi> = {
  name: "GainixWithdrawalVault",
  chainId: contractActiveChainId,
  address: addresses.withdrawal,
  abi: withdrawalAbi,
};

export { withdrawalAbi };
