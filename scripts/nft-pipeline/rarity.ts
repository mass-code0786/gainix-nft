import { getTraitCategory } from "./config.js";
import { pickWeighted, type RandomSource } from "./random.js";
import type {
  EditionSelection,
  FamilyConfig,
  PipelineConfig,
  SelectedTrait,
  TraitVariantConfig,
} from "./types.js";

function padEdition(edition: number, maxEdition: number) {
  const width = String(maxEdition).length;
  return String(edition).padStart(width, "0");
}

function matchesFamily(variant: TraitVariantConfig, familyId: string) {
  return !variant.families || variant.families.includes(familyId);
}

function matchesDependencies(variant: TraitVariantConfig, selectedTraitIds: Set<string>) {
  const requiresOk = !variant.requires || variant.requires.every((traitId) => selectedTraitIds.has(traitId));
  const excludesOk = !variant.excludes || variant.excludes.every((traitId) => !selectedTraitIds.has(traitId));
  return requiresOk && excludesOk;
}

function selectFamily(config: PipelineConfig, random: RandomSource) {
  return pickWeighted(config.families, random);
}

function selectTraitForCategory(
  config: PipelineConfig,
  categoryId: SelectedTrait["categoryId"],
  family: FamilyConfig,
  selectedTraitIds: Set<string>,
  random: RandomSource,
): SelectedTrait {
  const category = getTraitCategory(config, categoryId);
  const candidates = category.variants.filter(
    (variant) => matchesFamily(variant, family.id) && matchesDependencies(variant, selectedTraitIds),
  );

  if (candidates.length === 0) {
    throw new Error(`No variants available for category ${categoryId} and family ${family.id}.`);
  }

  const selected = pickWeighted(candidates, random);

  return {
    categoryId,
    categoryName: category.name,
    id: selected.id,
    name: selected.name,
    rarity: selected.rarity,
    weight: selected.weight,
    asset: selected.asset,
  };
}

function buildDna(family: FamilyConfig, traits: SelectedTrait[]) {
  return [family.id, ...traits.map((trait) => `${trait.categoryId}:${trait.id}`)].join("|");
}

export function createEditionSelection(
  config: PipelineConfig,
  edition: number,
  random: RandomSource,
  existingDna: Set<string>,
  maxAttempts = 4000,
): EditionSelection {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const family = selectFamily(config, random);
    const selectedTraitIds = new Set<string>();
    const traits: SelectedTrait[] = [];

    for (const categoryId of config.collection.layerOrder) {
      const selectedTrait = selectTraitForCategory(config, categoryId, family, selectedTraitIds, random);
      traits.push(selectedTrait);
      selectedTraitIds.add(selectedTrait.id);
    }

    const dna = buildDna(family, traits);

    if (existingDna.has(dna)) {
      continue;
    }

    existingDna.add(dna);

    const editionPadded = padEdition(edition, config.collection.startEdition + config.collection.totalSupply - 1);

    return {
      edition,
      editionPadded,
      dna,
      family,
      traits,
      imageFilename: `${config.collection.slug}-${editionPadded}.${config.collection.imageExtension}`,
      metadataFilename: `${config.collection.slug}-${editionPadded}.json`,
    };
  }

  throw new Error(`Unable to generate a unique edition after ${maxAttempts} attempts.`);
}
