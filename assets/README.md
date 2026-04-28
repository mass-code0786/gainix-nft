# Gainix NFT Asset Tree

## Production Structure
```text
assets/
  monkey/
  dog/
  cat/
  lion/
  parrot/
  traits/
    backgrounds/
    eyes/
    mouth/
    headwear/
    eyewear/
    neck-items/
    outfits/
    effects/
```

## Naming Rules
- Use lowercase ASCII only.
- Use kebab-case inside each token.
- Use double underscores to separate structural parts.
- Do not use spaces.
- Do not rename approved assets once they are in rarity config.

## File Naming Convention
- Family body layers:
  `<family>__body__<variant>__<rarity>.png`
- Global trait layers:
  `<category>__<variant>__<rarity>.png`
- Example:
  `monkey__body__midnight-sable__common.png`
  `headwear__signal-crown__rare.png`
  `background__eclipse-throne__epic.png`

## Deterministic Generator Mapping
- File paths in `nft-pipeline/config/rarity.config.json` are always relative to `assets/`.
- Trait ids stay stable even if descriptive copy changes.
- "None" variants should still use valid transparent PNG spacer files.
- Output files should use zero-padded editions:
  `gainix-nft-0001.png`
  `gainix-nft-0001.json`
