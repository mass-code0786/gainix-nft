# Gainix NFT Collection Pipeline

This workspace defines a reusable collection system for `Gainix NFT`, not a one-off art drop.

## Scope
- Premium dark-luxury art direction for five families: Monkey, Dog, Cat, Lion, Parrot
- Deterministic folder structure and naming rules for layered PNG production
- Machine-readable rarity and metadata configuration
- TypeScript generator scaffold for weighted trait selection, duplicate prevention, image composition, and metadata export
- Prompt pack for Codex image generation and iterative asset refinement

## Deliverables
- [style-guide.md](/C:/Gainix/Gainix NFT/nft-pipeline/style-guide.md)
- [families.md](/C:/Gainix/Gainix NFT/nft-pipeline/families.md)
- [trait-matrix.md](/C:/Gainix/Gainix NFT/nft-pipeline/trait-matrix.md)
- [prompts.md](/C:/Gainix/Gainix NFT/nft-pipeline/prompts.md)
- [rarity.config.json](/C:/Gainix/Gainix NFT/nft-pipeline/config/rarity.config.json)
- [metadata.schema.json](/C:/Gainix/Gainix NFT/nft-pipeline/config/metadata.schema.json)
- [assets/README.md](/C:/Gainix/Gainix NFT/assets/README.md)
- [generate.ts](/C:/Gainix/Gainix NFT/scripts/nft-pipeline/generate.ts)

## Workflow
1. Lock the visual language from the style guide before generating any family art.
2. Create master character sheets for each family using the family prompts.
3. Produce transparent PNG layers using the trait prompts and naming rules.
4. Drop approved PNGs into the `assets/` tree.
5. Adjust weights and supply rules in `nft-pipeline/config/rarity.config.json`.
6. Compile the TypeScript pipeline with:

```bash
npx tsc -p tsconfig.nft-pipeline.json
```

7. Generate metadata only while assets are still in review:

```bash
node .nft-pipeline-dist/scripts/nft-pipeline/generate.js --metadata-only --count 12
```

8. Generate the final collection after installing `sharp` for PNG composition:

```bash
node .nft-pipeline-dist/scripts/nft-pipeline/generate.js --count 2500
```

## Output
The pipeline writes collection exports to `nft-pipeline/output/<run-name>/` with:
- `images/`
- `metadata/`
- `collection-manifest.json`

## Notes
- Full image export expects `sharp` at runtime. The scaffold throws a clear install message if it is missing.
- The prompt pack is written to preserve one consistent luxury rendering language across all five families.
