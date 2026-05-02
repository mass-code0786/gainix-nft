import { botPassAbi } from "@/contracts/abis/bot-pass.abi";
import { getGainixAddresses } from "@/contracts/config/addresses";
import type { ContractDefinition } from "@/contracts/config/types";
import { contractActiveChainId } from "@/contracts/config/chain";

const addresses = getGainixAddresses(contractActiveChainId);

export const botPassContract: ContractDefinition<typeof botPassAbi> = {
  name: "GainixBotPass",
  chainId: contractActiveChainId,
  address: addresses.botPass,
  abi: botPassAbi,
};

export { botPassAbi };
