import { marketplaceAbi } from "@/contracts/abis/marketplace.abi";
import { getGainixAddresses } from "@/contracts/config/addresses";
import type { ContractDefinition } from "@/contracts/config/types";
import { contractActiveChainId } from "@/contracts/config/chain";

const addresses = getGainixAddresses(contractActiveChainId);

export const marketplaceContract: ContractDefinition<typeof marketplaceAbi> & { feeBps: number } = {
  name: "GainixMarketplace",
  chainId: contractActiveChainId,
  address: addresses.marketplace,
  abi: marketplaceAbi,
  feeBps: 200,
};

export { marketplaceAbi };
