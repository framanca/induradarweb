import 'dart:convert';

class CreditsCatalog {
  const CreditsCatalog({
    required this.version,
    required this.model,
    required this.unit,
    required this.baseCredits,
    required this.includedSectors,
    required this.includedProvinces,
    required this.includedSignals,
    required this.provinceBands,
    required this.sectorBands,
    required this.signalBands,
    required this.spainProvinceCount,
    required this.portugalProvinceEquivalent,
  });

  static const assetPath = 'assets/config/induradar_credits_v1.json';

  factory CreditsCatalog.fromJsonString(String source) {
    final decoded = jsonDecode(source);
    if (decoded is! Map<String, dynamic>) {
      throw const FormatException('Credits catalog must be a JSON object.');
    }
    return CreditsCatalog.fromJson(decoded);
  }

  factory CreditsCatalog.fromJson(Map<String, dynamic> json) {
    final included = _requiredMap(json, 'included');
    final countryScopes = _requiredMap(json, 'country_scopes');
    final catalog = CreditsCatalog(
      version: _requiredString(json, 'catalog_version'),
      model: _requiredString(json, 'credits_model'),
      unit: _requiredString(json, 'unit'),
      baseCredits: _requiredInt(json, 'base_credits'),
      includedSectors: _requiredInt(included, 'sectors'),
      includedProvinces: _requiredInt(included, 'provinces'),
      includedSignals: _requiredInt(included, 'signals'),
      provinceBands: _creditBands(json, 'province_bands'),
      sectorBands: _creditBands(json, 'sector_bands'),
      signalBands: _creditBands(json, 'signal_bands'),
      spainProvinceCount: _requiredInt(countryScopes, 'spain_all_provinces'),
      portugalProvinceEquivalent: _requiredInt(
        countryScopes,
        'portugal_province_equivalent',
      ),
    );
    catalog._validate();
    return catalog;
  }

  final String version;
  final String model;
  final String unit;
  final int baseCredits;
  final int includedSectors;
  final int includedProvinces;
  final int includedSignals;
  final List<CreditBand> provinceBands;
  final List<CreditBand> sectorBands;
  final List<CreditBand> signalBands;
  final int spainProvinceCount;
  final int portugalProvinceEquivalent;

  int provinceCredits(int provinces) => _marginalCredits(
    count: provinces,
    includedCount: includedProvinces,
    bands: provinceBands,
  );

  int sectorCredits(int sectors) => _marginalCredits(
    count: sectors,
    includedCount: includedSectors,
    bands: sectorBands,
  );

  int signalCredits(int signals) {
    final normalizedCount = signals < 0 ? 0 : signals;
    for (final band in signalBands) {
      if (band.includes(normalizedCount)) {
        return band.creditsPerUnit;
      }
    }
    throw const FormatException(
      'Signal bands do not cover the selected count.',
    );
  }

  CreditsQuote quote({
    required int sectorCount,
    required int provinceCount,
    required int signalCount,
  }) {
    final normalizedSectorCount = sectorCount < 0 ? 0 : sectorCount;
    final normalizedProvinceCount = provinceCount < 0 ? 0 : provinceCount;
    final normalizedSignalCount = signalCount < 0 ? 0 : signalCount;
    final sectors = sectorCredits(normalizedSectorCount);
    final provinces = provinceCredits(normalizedProvinceCount);
    final signals = signalCredits(normalizedSignalCount);

    return CreditsQuote(
      catalogVersion: version,
      creditsModel: model,
      unit: unit,
      baseCredits: baseCredits,
      sectorCount: normalizedSectorCount,
      provinceCount: normalizedProvinceCount,
      signalCount: normalizedSignalCount,
      includedSectors: includedSectors,
      includedProvinces: includedProvinces,
      includedSignals: includedSignals,
      sectorCredits: sectors,
      provinceCredits: provinces,
      signalCredits: signals,
      totalCredits: baseCredits + sectors + provinces + signals,
    );
  }

  int _marginalCredits({
    required int count,
    required int includedCount,
    required List<CreditBand> bands,
  }) {
    if (count <= includedCount) {
      return 0;
    }

    var credits = 0;
    for (final band in bands) {
      final unitsInBand = band.selectedUnits(count);
      credits += unitsInBand * band.creditsPerUnit;
    }
    return credits;
  }

  void _validate() {
    if (unit != 'credits' ||
        baseCredits < 0 ||
        includedSectors < 0 ||
        includedProvinces < 0 ||
        includedSignals < 0 ||
        spainProvinceCount <= 0 ||
        portugalProvinceEquivalent < 0) {
      throw const FormatException('Credits catalog contains invalid values.');
    }
    _validateMarginalBands(provinceBands, 'province');
    _validateMarginalBands(sectorBands, 'sector');
    if (signalBands.isEmpty || !signalBands.first.includes(0)) {
      throw const FormatException('Signal credit bands must include zero.');
    }
  }
}

class CreditBand {
  const CreditBand({
    required this.from,
    required this.to,
    required this.creditsPerUnit,
  });

  factory CreditBand.fromJson(Map<String, dynamic> json) => CreditBand(
    from: _requiredInt(json, 'from'),
    to: json['to'] as int?,
    creditsPerUnit: _requiredInt(json, 'credits_per_unit'),
  );

  final int from;
  final int? to;
  final int creditsPerUnit;

  bool includes(int count) => count >= from && (to == null || count <= to!);

  int selectedUnits(int count) {
    if (count < from) {
      return 0;
    }
    final last = to == null || count < to! ? count : to!;
    return last - from + 1;
  }
}

class CreditsQuote {
  const CreditsQuote({
    required this.catalogVersion,
    required this.creditsModel,
    required this.unit,
    required this.baseCredits,
    required this.sectorCount,
    required this.provinceCount,
    required this.signalCount,
    required this.includedSectors,
    required this.includedProvinces,
    required this.includedSignals,
    required this.sectorCredits,
    required this.provinceCredits,
    required this.signalCredits,
    required this.totalCredits,
  });

  final String catalogVersion;
  final String creditsModel;
  final String unit;
  final int baseCredits;
  final int sectorCount;
  final int provinceCount;
  final int signalCount;
  final int includedSectors;
  final int includedProvinces;
  final int includedSignals;
  final int sectorCredits;
  final int provinceCredits;
  final int signalCredits;
  final int totalCredits;

  Map<String, Object?> toJson() {
    return {
      'catalog_version': catalogVersion,
      'credits_model': creditsModel,
      'unit': unit,
      'total_credits': totalCredits,
      'formula_inputs': {
        'base_credits': baseCredits,
        'sector_count': sectorCount,
        'province_count': provinceCount,
        'signal_count': signalCount,
        'included_sectors': includedSectors,
        'included_provinces': includedProvinces,
        'included_signals': includedSignals,
      },
      'breakdown': {
        'base_credits': baseCredits,
        'sector_credits': sectorCredits,
        'province_credits': provinceCredits,
        'signal_credits': signalCredits,
      },
    };
  }
}

List<CreditBand> _creditBands(Map<String, dynamic> json, String key) {
  final values = json[key];
  if (values is! List<dynamic> || values.isEmpty) {
    throw FormatException('Credits field $key must be a non-empty array.');
  }
  return values
      .map((value) {
        if (value is! Map<String, dynamic>) {
          throw FormatException('Every $key value must be an object.');
        }
        return CreditBand.fromJson(value);
      })
      .toList(growable: false);
}

void _validateMarginalBands(List<CreditBand> bands, String label) {
  if (bands.isEmpty) {
    throw FormatException('$label credit bands cannot be empty.');
  }
  var expectedFrom = bands.first.from;
  for (final band in bands) {
    if (band.from != expectedFrom ||
        band.creditsPerUnit < 0 ||
        (band.to != null && band.to! < band.from)) {
      throw FormatException(
        '$label credit bands must be ordered and contiguous.',
      );
    }
    if (band.to == null) {
      if (!identical(band, bands.last)) {
        throw FormatException('Only the final $label band can be unbounded.');
      }
      return;
    }
    expectedFrom = band.to! + 1;
  }
  throw FormatException(
    '$label credit bands must include an unbounded final band.',
  );
}

String _requiredString(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is! String || value.trim().isEmpty) {
    throw FormatException('Credits field $key must be a non-empty string.');
  }
  return value;
}

int _requiredInt(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is! int) {
    throw FormatException('Credits field $key must be an integer.');
  }
  return value;
}

Map<String, dynamic> _requiredMap(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is! Map<String, dynamic>) {
    throw FormatException('Credits field $key must be an object.');
  }
  return value;
}
