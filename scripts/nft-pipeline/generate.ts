import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadPipelineConfig, ensureOutputDirectories } from "./config.js";
import { composeEditionImage } from "./composer.js";
import { buildMetadata } from "./metadata.js";
import { createSeededRandom } from "./random.js";
import { createEditionSelection } from "./rarity.js";
import type { OutputManifest } from "./types.js";

interface CliOptions {
  configPath: string;
  outputPath?: string;
  count?: number;
  seed: string;
  metadataOnly: boolean;
}

function parseCliArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    configPath: path.resolve(process.cwd(), "nft-pipeline", "config", "rarity.config.json"),
    seed: "gainix-nft-production",
    metadataOnly: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const nextValue = argv[index + 1];

    if (argument === "--config" && nextValue) {
      options.configPath = path.resolve(process.cwd(), nextValue);
      index += 1;
    } else if (argument === "--output" && nextValue) {
      options.outputPath = path.resolve(process.cwd(), nextValue);
      index += 1;
    } else if (argument === "--count" && nextValue) {
      options.count = Number(nextValue);
      index += 1;
    } else if (argument === "--seed" && nextValue) {
      options.seed = nextValue;
      index += 1;
    } else if (argument === "--metadata-only") {
      options.metadataOnly = true;
    }
  }

  return options;
}

function buildDefaultOutputPath() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.resolve(process.cwd(), "nft-pipeline", "output", `run-${timestamp}`);
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  const config = await loadPipelineConfig(options.configPath);
  const count = options.count ?? config.collection.totalSupply;
  const outputRoot = options.outputPath ?? buildDefaultOutputPath();

  if (count <= 0) {
    throw new Error("Count must be a positive integer.");
  }

  await mkdir(outputRoot, { recursive: true });
  const { imagesDir, metadataDir } = await ensureOutputDirectories(outputRoot);
  const existingDna = new Set<string>();
  const random = createSeededRandom(options.seed);

  const manifest: OutputManifest = {
    collection: config.collection.name,
    slug: config.collection.slug,
    generatedAt: new Date().toISOString(),
    count,
    metadataOnly: options.metadataOnly,
    editions: [],
  };

  for (let offset = 0; offset < count; offset += 1) {
    const edition = config.collection.startEdition + offset;
    const selection = createEditionSelection(config, edition, random, existingDna);
    const metadata = buildMetadata(config, selection);
    const metadataPath = path.join(metadataDir, selection.metadataFilename);
    const imagePath = path.join(imagesDir, selection.imageFilename);

    await writeFile(metadataPath, JSON.stringify(metadata, null, 2), "utf8");

    if (!options.metadataOnly) {
      await composeEditionImage(config, selection, imagePath);
    }

    manifest.editions.push({
      edition: selection.edition,
      family: selection.family.name,
      dna: selection.dna,
      image: path.relative(outputRoot, imagePath),
      metadata: path.relative(outputRoot, metadataPath),
    });
  }

  await writeFile(path.join(outputRoot, "collection-manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  console.log(`Generated ${count} Gainix NFT editions into ${outputRoot}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
