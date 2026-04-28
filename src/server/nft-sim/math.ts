export function roundAmount(value: number) {
  return Number(value.toFixed(8));
}

export function randomDecimalInRange(min: number, max: number) {
  const value = min + Math.random() * (max - min);

  return roundAmount(value);
}

export function applyPercentIncrease(baseAmount: number, percent: number) {
  return roundAmount(baseAmount * (1 + percent / 100));
}

export function randomIntegerInRange(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
