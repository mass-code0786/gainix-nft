import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { resolveAssetsPath } from "./config.js";
import type { EditionSelection, PipelineConfig } from "./types.js";

function loadSharp(): any {
  try {
    return require("sharp");
  } catch {
    throw new Error(
      "PNG composition requires the optional 'sharp' package. Install it with `npm install sharp` before exporting final images.",
    );
  }
}

async function assertLayerFilesExist(selection: EditionSelection) {
  for (const trait of selection.traits) {
    await access(resolveAssetsPath(trait.asset), constants.F_OK);
  }
}

export async function composeEditionImage(
  config: PipelineConfig,
  selection: EditionSelection,
  outputPath: string,
) {
  await assertLayerFilesExist(selection);

  const sharp = loadSharp();
  const base = sharp({
    create: {
      width: config.collection.width,
      height: config.collection.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });

  const layers = selection.traits.map((trait) => ({
    input: resolveAssetsPath(trait.asset),
  }));

  await base.composite(layers).png().toFile(outputPath);
}
