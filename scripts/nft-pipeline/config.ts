import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  rarityTiers,
  traitCategoryIds,
  type PipelineConfig,
  type TraitCategoryId,
  type TraitCategoryConfig,
  type TraitVariantConfig,
} from "./types.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function ensureUnique(values: string[], message: string) {
  assert(new Set(values).size === values.length, message);
}

function validateVariant(category: TraitCategoryConfig, variant: TraitVariantConfig, familyIds: Set<string>) {
  assert(rarityTiers.includes(variant.rarity), `Trait ${variant.id} has invalid rarity.`);
  assert(variant.weight > 0, `Trait ${variant.id} must have a positive weight.`);
  assert(variant.asset.length > 0, `Trait ${variant.id} is missing an asset path.`);

  if (variant.families) {
    for (const familyId of variant.families) {
      assert(familyIds.has(familyId), `Trait ${variant.id} references unknown family ${familyId}.`);
    }
  }

  if (variant.requires) {
    ensureUnique(variant.requires, `Trait ${variant.id} has duplicate requires rules.`);
  }

  if (variant.excludes) {
    ensureUnique(variant.excludes, `Trait ${variant.id} has duplicate excludes rules.`);
  }

  assert(variant.id.length > 0, `Trait in category ${category.id} is missing an id.`);
}

export async function loadPipelineConfig(configPath: string): Promise<PipelineConfig> {
  const rawConfig = await readFile(configPath, "utf8");
  const parsed = JSON.parse(rawConfig) as PipelineConfig;
  validatePipelineConfig(parsed);
  return parsed;
}

export function validatePipelineConfig(config: PipelineConfig) {
  assert(config.collection?.name, "Collection name is required.");
  assert(config.collection?.slug, "Collection slug is required.");
  assert(config.collection?.width > 0, "Collection width must be positive.");
  assert(config.collection?.height > 0, "Collection height must be positive.");
  assert(config.collection?.startEdition > 0, "Collection startEdition must be positive.");
  assert(config.collection?.totalSupply > 0, "Collection totalSupply must be positive.");

  ensureUnique(config.families.map((family) => family.id), "Family ids must be unique.");
  ensureUnique(config.traits.map((trait) => trait.id), "Trait category ids must be unique.");

  const familyIds = new Set(config.families.map((family) => family.id));
  const traitIds = new Set(config.traits.map((trait) => trait.id));

  for (const categoryId of config.collection.layerOrder) {
    assert(traitIds.has(categoryId), `Layer order references missing trait category ${categoryId}.`);
  }

  for (const traitCategory of config.traits) {
    assert(traitCategoryIds.includes(traitCategory.id), `Unknown trait category id ${traitCategory.id}.`);
    assert(traitCategory.variants.length > 0, `Trait category ${traitCategory.id} must have variants.`);
    ensureUnique(
      traitCategory.variants.map((variant) => variant.id),
      `Trait category ${traitCategory.id} contains duplicate variant ids.`,
    );

    for (const variant of traitCategory.variants) {
      validateVariant(traitCategory, variant, familyIds);
    }
  }
}

export async function ensureOutputDirectories(rootOutputPath: string) {
  const imagesDir = path.join(rootOutputPath, "images");
  const metadataDir = path.join(rootOutputPath, "metadata");

  await mkdir(imagesDir, { recursive: true });
  await mkdir(metadataDir, { recursive: true });

  return { imagesDir, metadataDir };
}

export function resolveAssetsPath(assetRelativePath: string) {
  return path.resolve(process.cwd(), "assets", assetRelativePath);
}

export function getTraitCategory(config: PipelineConfig, categoryId: TraitCategoryId) {
  const category = config.traits.find((trait) => trait.id === categoryId);
  assert(category, `Missing trait category ${categoryId}.`);
  return category;
}
