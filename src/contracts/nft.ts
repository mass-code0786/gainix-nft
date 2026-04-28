import { nftAbi } from "@/contracts/abis/nft.abi";
import { getGainixAddresses } from "@/contracts/config/addresses";
import type { ContractDefinition } from "@/contracts/config/types";
import { contractTestChain } from "@/contracts/config/chain";

const addresses = getGainixAddresses(contractTestChain.id);

export const nftContract: ContractDefinition<typeof nftAbi> & { metadataBaseUri: string } = {
  name: "GainixGenesisNFT",
  chainId: contractTestChain.id,
  address: addresses.nft,
  abi: nftAbi,
  metadataBaseUri: "ipfs://gainix-demo-nft-metadata/",
};

export { nftAbi };
