import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:induradarweb/pricing.dart';

void main() {
  late PricingCatalog catalog;

  setUpAll(() {
    final source = File(PricingCatalog.assetPath).readAsStringSync();
    catalog = PricingCatalog.fromJsonString(source);
  });

  test('one-off pilot prices follow every RU boundary', () {
    const expectedPrices = <num, num>{
      60: 59,
      100: 59,
      101: 89,
      175: 89,
      176: 125,
      250: 125,
      251: 175,
      350: 175,
      351: 249,
      500: 249,
      501: 349,
    };

    for (final entry in expectedPrices.entries) {
      final item = catalog
          .quote(researchUnits: entry.key, serviceTypes: const {})
          .lineItems
          .single;
      expect(item.pilotPriceEur, entry.value, reason: '${entry.key} RU');
    }
  });

  test('monthly pilot prices follow every RU boundary', () {
    const expectedPrices = <num, num>{
      60: 75,
      100: 75,
      101: 125,
      175: 125,
      176: 199,
      275: 199,
      276: 299,
      375: 299,
      376: 399,
      500: 399,
      501: 499,
    };

    for (final entry in expectedPrices.entries) {
      final item = catalog
          .quote(
            researchUnits: entry.key,
            serviceTypes: const {'Informe mensual'},
          )
          .lineItems
          .single;
      expect(item.pilotPriceEur, entry.value, reason: '${entry.key} RU');
      expect(item.isMonthly, isTrue);
    }
  });

  test(
    'recurring services use a monthly fee and can include an initial study',
    () {
      final monthlyOnly = catalog.quote(
        researchUnits: 276,
        serviceTypes: const {'Resumen / informe semanal'},
      );
      expect(monthlyOnly.lineItems, hasLength(1));
      expect(monthlyOnly.lineItems.single.pilotPriceEur, 299);
      expect(monthlyOnly.lineItems.single.standardPriceEur, 599);
      expect(monthlyOnly.lineItems.single.billingPeriod, 'month');

      final combined = catalog.quote(
        researchUnits: 276,
        serviceTypes: const {'Estudio puntual', 'Informe mensual'},
      );
      expect(combined.lineItems, hasLength(2));
      expect(combined.lineItems.map((item) => item.billingPeriod), [
        'one_time',
        'month',
      ]);
    },
  );

  test('fractional RU values round up for pricing and open tiers say from', () {
    final fractional = catalog.quote(
      researchUnits: 100.5,
      serviceTypes: const {},
    );
    expect(fractional.billableResearchUnits, 101);
    expect(fractional.lineItems.single.pilotPriceEur, 89);

    final openTier = catalog.quote(
      researchUnits: 501,
      serviceTypes: const {'Alertas prioritarias ante cambios relevantes'},
    );
    expect(openTier.lineItems.single.pilotPriceEur, 499);
    expect(openTier.lineItems.single.startingAt, isTrue);
  });
}
