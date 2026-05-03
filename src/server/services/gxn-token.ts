export const REGISTRATION_BONUS_USD = 2.5;
export const GXN_TOKEN_VALUE_USD = 0.05;

export function roundTokenAmount(value: number) {
  return Math.round((value + Number.EPSILON) * 100_000_000) / 100_000_000;
}

export function getCurrentGxnTokenPriceUsd() {
  return GXN_TOKEN_VALUE_USD;
}

export function calculateRegistrationBonusTokens(tokenPriceUsd = getCurrentGxnTokenPriceUsd()) {
  if (!Number.isFinite(tokenPriceUsd) || tokenPriceUsd <= 0) {
    return null;
  }

  return roundTokenAmount(REGISTRATION_BONUS_USD / tokenPriceUsd);
}
