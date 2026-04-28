export const rarityTiers = ["common", "uncommon", "rare", "epic", "legendary"] as const;

export type RarityTier = (typeof rarityTiers)[number];

export const traitCategoryIds = [
  "background",
  "body",
  "eyes",
  "mouth",
  "headwear",
  "eyewear",
  "neckItem",
  "outfit",
  "specialEffect",
] as const;

export type TraitCategoryId = (typeof traitCategoryIds)[number];

export interface CollectionInfo {
  name: string;
  slug: string;
  description: string;
  externalUrl: string;
  baseImageUri: string;
  sellerFeeBasisPoints: number;
  width: number;
  height: number;
  totalSupply: number;
  startEdition: number;
  imageExtension: string;
  layerOrder: TraitCategoryId[];
}

export interface FamilyConfig {
  id: string;
  name: string;
  weight: number;
  silhouette: string;
  personality: string;
}

export interface TraitVariantConfig {
  id: string;
  name: string;
  rarity: RarityTier;
  weight: number;
  asset: string;
  families?: string[];
  excludes?: string[];
  requires?: string[];
}

export interface TraitCategoryConfig {
  id: TraitCategoryId;
  name: string;
  variants: TraitVariantConfig[];
}

export interface PipelineConfig {
  collection: CollectionInfo;
  families: FamilyConfig[];
  traits: TraitCategoryConfig[];
}

export interface SelectedTrait {
  categoryId: TraitCategoryId;
  categoryName: string;
  id: string;
  name: string;
  rarity: RarityTier;
  weight: number;
  asset: string;
}

export interface EditionSelection {
  edition: number;
  editionPadded: string;
  dna: string;
  family: FamilyConfig;
  traits: SelectedTrait[];
  imageFilename: string;
  metadataFilename: string;
}

export interface AttributeMetadata {
  trait_type: string;
  value: string;
  rarity_tier?: RarityTier;
  weight?: number;
  asset?: string;
}

export interface GainixMetadata {
  name: string;
  description: string;
  image: string;
  external_url: string;
  edition: number;
  dna: string;
  compiler: string;
  date: string;
  family: string;
  attributes: AttributeMetadata[];
  gainix: {
    family: {
      id: string;
      name: string;
    };
    layer_manifest: Array<{
      category: string;
      traitId: string;
      traitName: string;
      asset: string;
      rarity: RarityTier;
    }>;
  };
}

export interface OutputManifest {
  collection: string;
  slug: string;
  generatedAt: string;
  count: number;
  metadataOnly: boolean;
  editions: Array<{
    edition: number;
    family: string;
    dna: string;
    image: string;
    metadata: string;
  }>;
}
