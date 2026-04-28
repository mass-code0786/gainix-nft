import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import collectionConfig from "../../config/gainix-nft-collection.json" with { type: "json" };

const OUTPUT_DIR = path.resolve(process.cwd(), "output", "gainix-metadata");

function encodeIpfsPathSegment(segment) {
  return encodeURIComponent(segment);
}

function buildImageUri(imageCid, imageFilename) {
  const encodedPath = imageFilename
    .split("/")
    .map((segment) => encodeIpfsPathSegment(segment))
    .join("/");
  return `ipfs://${imageCid}/${encodedPath}`;
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const metadataRecords = collectionConfig.assets.map((asset) => {
    const image = buildImageUri(collectionConfig.ipfs.imageCid, asset.imageFilename);
    const metadata = {
      name: asset.name,
      description: `${asset.name} from the ${collectionConfig.name} collection on BNB testnet.`,
      image,
      external_url: "https://gainix.io",
      attributes: [
        { trait_type: "Category", value: asset.attributes.Category },
        { trait_type: "Tier", value: asset.attributes.Tier },
        { trait_type: "Collection", value: collectionConfig.name },
      ],
    };

    return {
      asset,
      metadata,
    };
  });

  for (const { asset, metadata } of metadataRecords) {
    const outputPath = path.join(OUTPUT_DIR, asset.metadataFilename);
    await writeFile(outputPath, JSON.stringify(metadata, null, 2), "utf8");
  }

  const mintPlan = metadataRecords.map(({ asset }) => ({
    id: asset.id,
    metadataFilename: asset.metadataFilename,
    metadataUri: `ipfs://${collectionConfig.ipfs.metadataCid}/${asset.metadataFilename}`,
  }));

  await writeFile(path.join(OUTPUT_DIR, "mint-plan.json"), JSON.stringify(mintPlan, null, 2), "utf8");

  console.log(`Wrote ${metadataRecords.length} metadata files to ${OUTPUT_DIR}`);
  console.log(`Mint plan: ${path.join(OUTPUT_DIR, "mint-plan.json")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
