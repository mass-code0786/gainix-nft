import type { EditionSelection, GainixMetadata, PipelineConfig } from "./types.js";

const COMPILER_ID = "gainix-nft-pipeline@1.0.0";

function buildImageUri(baseImageUri: string, imageFilename: string) {
  const normalizedBase = baseImageUri.endsWith("/") ? baseImageUri : `${baseImageUri}/`;
  return `${normalizedBase}${imageFilename}`;
}

export function buildMetadata(config: PipelineConfig, selection: EditionSelection): GainixMetadata {
  return {
    name: `${config.collection.name} #${selection.editionPadded}`,
    description: config.collection.description,
    image: buildImageUri(config.collection.baseImageUri, selection.imageFilename),
    external_url: config.collection.externalUrl,
    edition: selection.edition,
    dna: selection.dna,
    compiler: COMPILER_ID,
    date: new Date().toISOString(),
    family: selection.family.name,
    attributes: [
      {
        trait_type: "Family",
        value: selection.family.name,
      },
      ...selection.traits.map((trait) => ({
        trait_type: trait.categoryName,
        value: trait.name,
        rarity_tier: trait.rarity,
        weight: trait.weight,
        asset: trait.asset,
      })),
    ],
    gainix: {
      family: {
        id: selection.family.id,
        name: selection.family.name,
      },
      layer_manifest: selection.traits.map((trait) => ({
        category: trait.categoryId,
        traitId: trait.id,
        traitName: trait.name,
        asset: trait.asset,
        rarity: trait.rarity,
      })),
    },
  };
}
