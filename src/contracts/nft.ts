import { nftAbi } from "@/contracts/abis/nft.abi";
import { getGainixAddresses } from "@/contracts/config/addresses";
import type { ContractDefinition } from "@/contracts/config/types";
import { contractActiveChainId } from "@/contracts/config/chain";

const addresses = getGainixAddresses(contractActiveChainId);

export const nftContract: ContractDefinition<typeof nftAbi> & { metadataBaseUri: string } = {
  name: "GainixGenesisNFT",
  chainId: contractActiveChainId,
  address: addresses.nft,
  abi: nftAbi,
  metadataBaseUri: "ipfs://gainix-demo-nft-metadata/",
};

export { nftAbi };
