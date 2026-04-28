import { botPassAbi } from "@/contracts/abis/bot-pass.abi";
import { getGainixAddresses } from "@/contracts/config/addresses";
import type { ContractDefinition } from "@/contracts/config/types";
import { contractTestChain } from "@/contracts/config/chain";

const addresses = getGainixAddresses(contractTestChain.id);

export const botPassContract: ContractDefinition<typeof botPassAbi> = {
  name: "GainixBotPass",
  chainId: contractTestChain.id,
  address: addresses.botPass,
  abi: botPassAbi,
};

export { botPassAbi };
