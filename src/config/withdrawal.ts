const FALLBACK_MIN_WITHDRAWAL_AMOUNT = 10;

function parseConfiguredAmount(value: string | undefined) {
  if (!value) {
    return null;
  }

  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export const MIN_WITHDRAWAL_AMOUNT =
  parseConfiguredAmount(process.env.MIN_WITHDRAWAL_AMOUNT) ??
  parseConfiguredAmount(process.env.NEXT_PUBLIC_MIN_WITHDRAWAL_AMOUNT) ??
  FALLBACK_MIN_WITHDRAWAL_AMOUNT;
