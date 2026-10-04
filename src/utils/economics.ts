import { PriceData } from "../types";

export const GUNTHA_TO_SQFT = 1089;
export const ACRE_TO_SQFT = 43560;
export const GUNTHA_PER_ACRE = 40;

export function economics(price: PriceData) {
  const sqftCandidates = [
    price.areaSqft || null,
    price.areaGuntha ? price.areaGuntha * GUNTHA_TO_SQFT : null,
    price.areaAcre ? price.areaAcre * ACRE_TO_SQFT : null
  ].filter((v): v is number => Boolean(v && v > 0));
  const areaSqft = price.areaSqft || (price.areaGuntha ? price.areaGuntha * GUNTHA_TO_SQFT : null) || (price.areaAcre ? price.areaAcre * ACRE_TO_SQFT : null);
  const areaGuntha = price.areaGuntha || (areaSqft ? areaSqft / GUNTHA_TO_SQFT : null);
  const areaAcre = price.areaAcre || (areaSqft ? areaSqft / ACRE_TO_SQFT : null);
  const effectivePrice = price.negotiatedPrice || price.quotedPrice || price.askingPrice || null;
  const totalAcquisition = effectivePrice ? effectivePrice + (price.additionalCosts || 0) : null;
  const discountAmount = price.askingPrice && effectivePrice ? price.askingPrice - effectivePrice : null;
  const discountPct = discountAmount !== null && price.askingPrice ? (discountAmount / price.askingPrice) * 100 : null;
  let mismatchPct = 0;
  if (sqftCandidates.length > 1) {
    const max = Math.max(...sqftCandidates), min = Math.min(...sqftCandidates);
    mismatchPct = max ? ((max - min) / max) * 100 : 0;
  }
  return {
    areaSqft, areaGuntha, areaAcre, effectivePrice, totalAcquisition, discountAmount, discountPct,
    perSqft: effectivePrice && areaSqft ? effectivePrice / areaSqft : null,
    perGuntha: effectivePrice && areaGuntha ? effectivePrice / areaGuntha : null,
    perAcre: effectivePrice && areaAcre ? effectivePrice / areaAcre : null,
    areaMismatch: mismatchPct > 3,
    mismatchPct
  };
}
