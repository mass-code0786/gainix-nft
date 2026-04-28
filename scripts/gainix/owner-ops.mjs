import collectionConfig from "../../config/gainix-nft-collection.json" with { type: "json" };
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  formatEther,
  getAddress,
  http,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const nftAbi = parseAbi([
  "function owner() view returns (address)",
  "function nextTokenId() view returns (uint256)",
  "function admins(address) view returns (bool)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function setBaseTokenUri(string newBaseTokenUri)",
  "function adminMint(address to, string uri) returns (uint256 tokenId)",
]);

const bscTestnet = defineChain({
  id: 97,
  name: "BNB Smart Chain Testnet",
  nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_BSC_TESTNET_RPC_URL ?? "https://data-seed-prebsc-1-s1.binance.org:8545"] },
  },
  blockExplorers: {
    default: { name: "BscScan", url: "https://testnet.bscscan.com" },
  },
});

const publicClient = createPublicClient({
  chain: bscTestnet,
  transport: http(bscTestnet.rpcUrls.default.http[0]),
});

const nftAddress = getAddress(collectionConfig.contracts.nft);
const metadataBaseUri = `ipfs://${collectionConfig.ipfs.metadataCid}/`;
const metadataUris = collectionConfig.assets.map((asset) => ({
  id: asset.id,
  metadataUri: `ipfs://${collectionConfig.ipfs.metadataCid}/${asset.metadataFilename}`,
}));

function usage() {
  console.log("Usage:");
  console.log("  node scripts/gainix/owner-ops.mjs status");
  console.log("  node scripts/gainix/owner-ops.mjs set-base-uri");
  console.log("  node scripts/gainix/owner-ops.mjs mint-batch --to <wallet> [--relative]");
}

function getWalletClient() {
  const privateKey = process.env.GAINIX_OWNER_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("Set GAINIX_OWNER_PRIVATE_KEY in your environment.");
  }

  const account = privateKeyToAccount(privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`);

  return createWalletClient({
    account,
    chain: bscTestnet,
    transport: http(bscTestnet.rpcUrls.default.http[0]),
  });
}

async function readStatus() {
  const [owner, nextTokenId] = await Promise.all([
    publicClient.readContract({ address: nftAddress, abi: nftAbi, functionName: "owner" }),
    publicClient.readContract({ address: nftAddress, abi: nftAbi, functionName: "nextTokenId" }),
  ]);

  console.log(`NFT contract: ${nftAddress}`);
  console.log(`Owner: ${owner}`);
  console.log(`Next token id: ${nextTokenId}`);

  if (nextTokenId > 0n) {
    try {
      const lastTokenId = nextTokenId - 1n;
      const lastTokenUri = await publicClient.readContract({
        address: nftAddress,
        abi: nftAbi,
        functionName: "tokenURI",
        args: [lastTokenId],
      });
      console.log(`Last token URI (#${lastTokenId}): ${lastTokenUri}`);
    } catch {
      console.log("Last token URI: unavailable");
    }
  }
}

async function setBaseUri() {
  const walletClient = getWalletClient();
  const [account] = await walletClient.getAddresses();
  const owner = await publicClient.readContract({ address: nftAddress, abi: nftAbi, functionName: "owner" });

  if (getAddress(owner) !== getAddress(account)) {
    throw new Error(`Connected private key (${account}) is not contract owner (${owner}).`);
  }

  const hash = await walletClient.writeContract({
    address: nftAddress,
    abi: nftAbi,
    functionName: "setBaseTokenUri",
    args: [metadataBaseUri],
    account,
    chain: bscTestnet,
  });

  console.log(`setBaseTokenUri tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Confirmed in block ${receipt.blockNumber}`);
}

function getArgValue(flag) {
  const index = process.argv.findIndex((arg) => arg === flag);
  if (index === -1 || index + 1 >= process.argv.length) {
    return undefined;
  }
  return process.argv[index + 1];
}

async function mintBatch() {
  const walletClient = getWalletClient();
  const [account] = await walletClient.getAddresses();
  const recipientRaw = getArgValue("--to");
  const useRelativeUris = process.argv.includes("--relative");

  if (!recipientRaw) {
    throw new Error("Missing --to recipient wallet.");
  }

  const recipient = getAddress(recipientRaw);
  const owner = await publicClient.readContract({ address: nftAddress, abi: nftAbi, functionName: "owner" });
  const isAdmin = await publicClient.readContract({
    address: nftAddress,
    abi: nftAbi,
    functionName: "admins",
    args: [account],
  });

  if (getAddress(owner) !== getAddress(account) && !isAdmin) {
    throw new Error(`Wallet ${account} is not owner/admin for adminMint.`);
  }

  console.log(`Mint target: ${recipient}`);
  console.log(`URI mode: ${useRelativeUris ? "relative metadata filename" : "full ipfs:// uri"}`);

  for (const item of metadataUris) {
    const uri = useRelativeUris
      ? collectionConfig.assets.find((asset) => asset.id === item.id)?.metadataFilename ?? item.metadataUri
      : item.metadataUri;
    const hash = await walletClient.writeContract({
      address: nftAddress,
      abi: nftAbi,
      functionName: "adminMint",
      args: [recipient, uri],
      account,
      chain: bscTestnet,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const gasCost = receipt.effectiveGasPrice * receipt.gasUsed;
    console.log(
      `Minted ${item.id} with URI ${uri} | tx ${hash} | block ${receipt.blockNumber} | gas ${formatEther(gasCost)} tBNB`,
    );
  }
}

async function main() {
  const command = process.argv[2];

  if (!command) {
    usage();
    process.exit(1);
  }

  switch (command) {
    case "status":
      await readStatus();
      break;
    case "set-base-uri":
      await setBaseUri();
      break;
    case "mint-batch":
      await mintBatch();
      break;
    default:
      usage();
      process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
