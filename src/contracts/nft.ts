import { nftAbi } from "@/contracts/abis/nft.abi";
import { getGainixAddresses } from "@/contracts/config/addresses";
import type { ContractDefinition } from "@/contracts/config/types";
import { contractActiveChainId } from "@/contracts/config/chain";

const addresses = getGainixAddresses(contractActiveChainId);

export const nftContract: Omit<ContractDefinition<typeof nftAbi>, "address"> & {
  address: (typeof addresses)["nft"];
  metadataBaseUri: string;
} = {
  name: "GainixGenesisNFT",
  chainId: contractActiveChainId,
  address: addresses.nft,
  abi: nftAbi,
  metadataBaseUri: "ipfs://gainix-demo-nft-metadata/",
};

export { nftAbi };
