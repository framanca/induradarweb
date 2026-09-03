import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:induradarweb/pricing.dart';

void main() {
  late PricingCatalog catalog;

  setUpAll(() {
    final source = File(PricingCatalog.assetPath).readAsStringSync();
    catalog = PricingCatalog.fromJsonString(source);
  });

  test('catalog exposes the transparent pilot entry price', () {
    expect(catalog.version, '2.0.0');
    expect(catalog.model, 'transparent_scope_v2');
    expect(catalog.entryPilotPriceEur, 49.5);
    expect(catalog.spainProvinceCount, 50);
  });

  test('scope supplement follows both price bands', () {
    const expected = <int, num>{
      0: 0,
      3: 0,
      4: 5,
      7: 20,
      8: 22.5,
      10: 27.5,
      12: 32.5,
    };

    for (final entry in expected.entries) {
      expect(
        catalog.scopeSupplement(entry.key, 3),
        entry.value,
        reason: '${entry.key} selected items',
      );
    }
  });

  test(
    'one-off, monthly and weekly plans reproduce every supplied example',
    () {
      const examples = <(int, int, num, num, num)>[
        (3, 3, 99, 30, 50),
        (5, 4, 114, 37.5, 57.5),
        (8, 8, 144, 52.5, 72.5),
        (10, 12, 159, 60, 80),
      ];

      for (final example in examples) {
        final quote = catalog.quote(
          sectorCount: example.$1,
          provinceCount: example.$2,
          serviceTypes: const {
            'Estudio puntual',
            'Revisión mensual',
            'Revisión semanal',
          },
        );
        final lines = {for (final line in quote.lineItems) line.planCode: line};

        expect(lines['one_off']!.standardPriceEur, example.$3);
        expect(lines['monthly_review']!.standardPriceEur, example.$4);
        expect(lines['weekly_review']!.standardPriceEur, example.$5);
        expect(lines['one_off']!.pilotPriceEur, example.$3 * 0.5);
        expect(lines['monthly_review']!.pilotPriceEur, example.$4 * 0.5);
        expect(lines['weekly_review']!.pilotPriceEur, example.$5 * 0.5);
      }
    },
  );

  test('review plans are recurring and require an active prior study', () {
    final quote = catalog.quote(
      sectorCount: 5,
      provinceCount: 4,
      serviceTypes: const {'Revisión semanal', 'Revisión mensual'},
    );

    expect(quote.lineItems, hasLength(2));
    for (final item in quote.lineItems) {
      expect(item.billingPeriod, 'month');
      expect(item.requiresActivePriorStudy, isTrue);
    }
  });

  test('alerts and watch services use the monthly review price', () {
    final quote = catalog.quote(
      sectorCount: 3,
      provinceCount: 3,
      serviceTypes: const {'Alertas prioritarias ante cambios relevantes'},
    );

    expect(quote.lineItems.single.planCode, 'monthly_review');
    expect(quote.lineItems.single.standardPriceEur, 30);
    expect(quote.lineItems.single.pilotPriceEur, 15);
    expect(quote.lineItems.single.isMonthly, isTrue);
  });

  test('empty service selection defaults to a one-off study', () {
    final quote = catalog.quote(
      sectorCount: 0,
      provinceCount: 0,
      serviceTypes: const {},
    );

    expect(quote.lineItems.single.planCode, 'one_off');
    expect(quote.lineItems.single.standardPriceEur, 99);
    expect(quote.lineItems.single.pilotPriceEur, 49.5);
  });

  test(
    'serialized quote keeps formula inputs and excludes RU pricing fields',
    () {
      final json = catalog
          .quote(
            sectorCount: 8,
            provinceCount: 8,
            serviceTypes: const {'Estudio puntual'},
          )
          .toJson();

      expect(json['pricing_model'], 'transparent_scope_v2');
      expect(json, isNot(contains('research_scope_units')));
      expect(json, isNot(contains('billable_research_scope_units')));
      expect(json['scope'], {
        'sector_count': 8,
        'province_count': 8,
        'included_sectors': 3,
        'included_provinces': 3,
        'included_company_types': 2,
        'sector_supplement_eur': 22.5,
        'province_supplement_eur': 22.5,
      });
    },
  );
}
