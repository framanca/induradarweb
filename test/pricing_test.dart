import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:induradarweb/credits.dart';

void main() {
  late CreditsCatalog catalog;

  setUpAll(() {
    final source = File(CreditsCatalog.assetPath).readAsStringSync();
    catalog = CreditsCatalog.fromJsonString(source);
  });

  test('catalog exposes the base report credits', () {
    expect(catalog.version, '1.0.0');
    expect(catalog.model, 'report_scope_credits_v1');
    expect(catalog.baseCredits, 50);
    expect(catalog.spainProvinceCount, 50);
  });

  test('province credits use marginal bands', () {
    const expected = <int, int>{
      1: 0,
      2: 15,
      3: 30,
      4: 42,
      5: 54,
      6: 64,
      10: 104,
      20: 174,
      30: 214,
    };

    for (final entry in expected.entries) {
      expect(
        catalog.provinceCredits(entry.key),
        entry.value,
        reason: '${entry.key} selected provinces',
      );
    }
  });

  test('sector and signal credits follow the configured bands', () {
    expect(catalog.sectorCredits(1), 0);
    expect(catalog.sectorCredits(3), 10);
    expect(catalog.sectorCredits(5), 20);
    expect(catalog.sectorCredits(6), 23);
    expect(catalog.sectorCredits(10), 35);
    expect(catalog.sectorCredits(15), 45);
    expect(catalog.signalCredits(5), 0);
    expect(catalog.signalCredits(6), 5);
    expect(catalog.signalCredits(11), 10);
  });

  test('quote reproduces every supplied example and serializes its inputs', () {
    const examples = <(int, int, int, int)>[
      (1, 1, 5, 50),
      (3, 1, 5, 60),
      (3, 2, 5, 75),
      (3, 2, 12, 85),
      (5, 2, 12, 95),
      (3, 3, 12, 100),
      (5, 3, 12, 110),
      (3, 4, 12, 112),
      (5, 5, 12, 134),
      (10, 10, 12, 199),
      (10, 20, 12, 269),
    ];
    for (final example in examples) {
      expect(
        catalog
            .quote(
              sectorCount: example.$1,
              provinceCount: example.$2,
              signalCount: example.$3,
            )
            .totalCredits,
        example.$4,
      );
    }

    final json = catalog
        .quote(sectorCount: 3, provinceCount: 3, signalCount: 12)
        .toJson();

    expect(json['credits_model'], 'report_scope_credits_v1');
    expect(json, isNot(contains('research_scope_units')));
    expect(json['total_credits'], 100);
    expect(json['formula_inputs'], {
      'base_credits': 50,
      'sector_count': 3,
      'province_count': 3,
      'signal_count': 12,
      'included_sectors': 1,
      'included_provinces': 1,
      'included_signals': 5,
    });
  });
}
