export function marginalCredits(count, included, bands) {
  if (count <= included) return 0;
  return bands.reduce((total, band) => {
    if (count < band.from) return total;
    const last = band.to === null || count < band.to ? count : band.to;
    return total + (last - band.from + 1) * band.credits_per_unit;
  }, 0);
}

export function bandCredits(count, bands) {
  return bands.find((band) => count >= band.from && (band.to === null || count <= band.to))?.credits_per_unit ?? 0;
}

export function calculateCreditsQuote(catalog, { sectorCount, provinceCount, signalCount }) {
  const sectors = Math.max(0, sectorCount);
  const provinces = Math.max(0, provinceCount);
  const signals = Math.max(0, signalCount);
  const provinceCredits = marginalCredits(provinces, catalog.included.provinces, catalog.province_bands);
  const sectorCredits = marginalCredits(sectors, catalog.included.sectors, catalog.sector_bands);
  const signalCredits = bandCredits(signals, catalog.signal_bands);
  return {
    catalog_version: catalog.catalog_version,
    credits_model: catalog.credits_model,
    unit: catalog.unit,
    total_credits: catalog.base_credits + provinceCredits + sectorCredits + signalCredits,
    formula_inputs: {
      base_credits: catalog.base_credits,
      sector_count: sectors,
      province_count: provinces,
      signal_count: signals,
      included_sectors: catalog.included.sectors,
      included_provinces: catalog.included.provinces,
      included_signals: catalog.included.signals,
    },
    breakdown: {
      base_credits: catalog.base_credits,
      sector_credits: sectorCredits,
      province_credits: provinceCredits,
      signal_credits: signalCredits,
    },
  };
}
