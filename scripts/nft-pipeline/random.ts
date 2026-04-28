export type RandomSource = () => number;

function hashSeed(input: string) {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function createSeededRandom(seed: string): RandomSource {
  let state = hashSeed(seed) || 1;

  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickWeighted<T extends { weight: number }>(items: T[], random: RandomSource): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);

  if (totalWeight <= 0) {
    throw new Error("Weighted selection requires at least one positive weight.");
  }

  let cursor = random() * totalWeight;

  for (const item of items) {
    cursor -= item.weight;

    if (cursor <= 0) {
      return item;
    }
  }

  return items[items.length - 1] as T;
}
