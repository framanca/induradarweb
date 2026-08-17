import 'package:flutter_test/flutter_test.dart';
import 'package:induradarweb/main.dart';
import 'package:induradarweb/pricing.dart';

void main() {
  test('LeadRequest preserves compatible name and geography fields', () {
    final request = LeadRequest(
      fullName: 'Ana Pérez Gómez',
      company: 'Industria Ejemplo',
      jobTitle: 'Dirección comercial',
      email: 'ana@example.com',
      phone: '',
      website: 'https://example.com',
      address: 'Calle Mayor 1, Castellón',
      offerDescription: 'Automatización industrial',
      offerCategories: const ['Tecnología, automatización y software'],
      problemsSolved: const ['Aumentar productividad o capacidad'],
      prioritySolutions: 'Robótica; Visión artificial',
      targetSectors: const ['Maquinaria y bienes de equipo'],
      targetCompanyTypes: const ['Fabricante de maquinaria / OEM'],
      geographyCountries: const ['España', 'Portugal'],
      spainCoverage: 'Seleccionar provincias',
      geographyProvinces: const ['Castellón', 'Valencia'],
      targetRevenueRange: '10-50 M€',
      targetEmployeeRange: '101-500 empleados',
      minimumOpportunityValue: '> 25.000 €',
      targetCompanyDescription: '',
      investmentSignals: const [],
      innovationSignals: const [],
      growthSignals: const [],
      publicFinanceSignals: const [],
      commercialNeeds: const [],
      opportunityTriggerDescription: 'Una nueva línea de producción.',
      recentCaseDescription: '',
      currentClients: const [],
      idealClients: const [],
      watchlistAccounts: const [],
      competitors: const [],
      excludedCompanies: const [],
      noBuyReason: '',
      serviceTypes: const [],
      serviceComments: '',
      privacyAccepted: true,
      marketingConsent: false,
      submittedAt: DateTime.utc(2026, 8, 17),
      pricingQuote: const PricingQuote(
        catalogVersion: '1.0.0',
        currency: 'EUR',
        pilotLabel: 'Piloto -50 %',
        researchUnits: 145,
        billableResearchUnits: 145,
        lineItems: [
          PricingLineItem(
            planCode: 'one_off',
            planLabel: 'Estudio puntual',
            billingPeriod: 'one_time',
            standardPriceEur: 179,
            pilotPriceEur: 89,
            startingAt: false,
            tierMinimumRu: 101,
            tierMaximumRu: 175,
            example: 'Provincia/CCAA, más señales o tipos de empresa',
          ),
        ],
      ),
    );

    final json = request.toJson();

    expect(json['full_name'], 'Ana Pérez Gómez');
    expect(json['first_name'], 'Ana');
    expect(json['last_name'], 'Pérez Gómez');
    expect(json['address'], 'Calle Mayor 1, Castellón');
    expect(json['city_province'], 'Calle Mayor 1, Castellón');
    expect(json['geography_countries'], ['España', 'Portugal']);
    expect(json['geography_spain_scope'], 'Seleccionar provincias');
    expect(json['geography_provinces'], ['Castellón', 'Valencia']);
    expect(json['geography_regions'], isEmpty);
    expect(json['geography_free_zone'], '');
    expect(json['research_scope_units'], 145);
    expect(json['research_scope_level'], 'Medio');
    expect(
      json['research_scope_model_version'],
      'InduRadar_Calculadora_Alcance_RU_v1',
    );

    expect(json, isNot(contains('submission_id')));
    expect(json['contact'], {
      'first_name': 'Ana',
      'last_name': 'Pérez Gómez',
      'company_name': 'Industria Ejemplo',
      'job_title': 'Dirección comercial',
      'email': 'ana@example.com',
      'phone': '',
      'website': 'https://example.com',
      'region_city': 'Calle Mayor 1, Castellón',
      'address': 'Calle Mayor 1, Castellón',
    });

    final sellerProfile = json['seller_profile'] as Map<String, Object?>;
    expect(sellerProfile['offer'], 'Automatización industrial');
    expect(sellerProfile['technologies'], ['Robótica', 'Visión artificial']);

    final nestedRequest = json['request'] as Map<String, Object?>;
    expect(
      nestedRequest['title'],
      'Solicitud de radar comercial - Industria Ejemplo',
    );
    expect(nestedRequest['sectors'], ['Maquinaria y bienes de equipo']);
    expect(nestedRequest['target_company_types'], [
      'Fabricante de maquinaria / OEM',
    ]);
    expect(nestedRequest['signal_types'], isEmpty);
    expect(nestedRequest['technologies'], ['Robótica', 'Visión artificial']);
    expect(nestedRequest['frequency'], 'one_off');
    expect(nestedRequest['description'], 'Una nueva línea de producción.');
    expect(nestedRequest['geographies'], [
      {
        'scope': 'province',
        'country': 'España',
        'region': 'Comunitat Valenciana',
        'province': 'Castellón',
        'city': null,
        'radius_km': null,
        'free_text': null,
      },
      {
        'scope': 'province',
        'country': 'España',
        'region': 'Comunitat Valenciana',
        'province': 'Valencia',
        'city': null,
        'radius_km': null,
        'free_text': null,
      },
      {
        'scope': 'country',
        'country': 'Portugal',
        'region': null,
        'province': null,
        'city': null,
        'radius_km': null,
        'free_text': null,
      },
    ]);

    expect(json['privacy'], {
      'privacy_notice_accepted': true,
      'commercial_contact_consent': false,
      'accepted_at': '2026-08-17T00:00:00.000Z',
    });
    expect(json['pricing'], {
      'catalog_version': '1.0.0',
      'currency': 'EUR',
      'price_type': 'pilot',
      'price_label': 'Piloto -50 %',
      'research_scope_units': 145,
      'billable_research_scope_units': 145,
      'line_items': [
        {
          'plan_code': 'one_off',
          'plan_label': 'Estudio puntual',
          'billing_period': 'one_time',
          'standard_price_eur': 179,
          'pilot_price_eur': 89,
          'starting_at': false,
          'tier_minimum_ru': 101,
          'tier_maximum_ru': 175,
          'example': 'Provincia/CCAA, más señales o tipos de empresa',
        },
      ],
    });
    expect(
      (json['request'] as Map<String, Object?>)['estimated_pricing'],
      json['pricing'],
    );
  });

  test('ResearchScopeCalculator reproduces the 128 RU workbook example', () {
    final estimate = ResearchScopeCalculator.calculate(
      targetSectors: const ['Sector 1'],
      targetCompanyTypes: const ['Tipo 1'],
      geographyCountries: const ['España'],
      spainCoverage: 'Seleccionar provincias',
      geographyProvinces: const ['Castellón'],
      investmentSignals: const ['I1', 'I2', 'I3', 'I4', 'I5'],
      innovationSignals: const ['N1', 'N2'],
      growthSignals: const ['G1'],
      publicFinanceSignals: const ['P1', 'P2'],
      commercialNeeds: const ['C1', 'C2', 'C3', 'C4'],
      currentClients: const ['A', 'B', 'C'],
      idealClients: const ['D', 'E', 'F'],
      watchlistAccounts: const ['W1', 'W2', 'W3', 'W4', 'W5'],
      competitors: const ['X1', 'X2'],
      excludedCompanies: const ['E1', 'E2', 'E3', 'E4', 'E5'],
    );

    expect(estimate.units, 128);
    expect(estimate.level, 'Medio');
  });

  test('ResearchScopeCalculator maps the supported geography scopes', () {
    expect(
      _scopeForGeography(const ['España'], 'Toda España', const []).units,
      120,
    );
    expect(
      _scopeForGeography(
        const ['España'],
        'Seleccionar provincias',
        const ['Castellón', 'Valencia'],
      ).units,
      75,
    );
    expect(
      _scopeForGeography(
        const ['España'],
        'Seleccionar provincias',
        const ['Castellón', 'Madrid'],
      ).units,
      95,
    );
    expect(_scopeForGeography(const ['Portugal'], null, const []).units, 100);
  });
}

ResearchScopeEstimate _scopeForGeography(
  List<String> countries,
  String? spainCoverage,
  List<String> provinces,
) {
  return ResearchScopeCalculator.calculate(
    targetSectors: const [],
    targetCompanyTypes: const [],
    geographyCountries: countries,
    spainCoverage: spainCoverage,
    geographyProvinces: provinces,
    investmentSignals: const [],
    innovationSignals: const [],
    growthSignals: const [],
    publicFinanceSignals: const [],
    commercialNeeds: const [],
    currentClients: const [],
    idealClients: const [],
    watchlistAccounts: const [],
    competitors: const [],
    excludedCompanies: const [],
  );
}
