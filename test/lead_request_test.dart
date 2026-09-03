import 'package:flutter_test/flutter_test.dart';
import 'package:induradarweb/main.dart';
import 'package:induradarweb/pricing.dart';

void main() {
  test('LeadRequest emits contract 1.3.2 and preserves form extensions', () {
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
      targetCompanyDescription: 'Decisión local',
      investmentSignals: const ['Nueva línea de producción'],
      innovationSignals: const [],
      growthSignals: const [],
      publicFinanceSignals: const [],
      commercialNeeds: const ['Digitalización e Industria 4.0'],
      opportunityTriggerDescription: 'Una nueva línea de producción.',
      recentCaseDescription: 'Caso de ampliación reciente.',
      currentClients: const ['Cliente actual'],
      idealClients: const ['Cliente competidor'],
      watchlistAccounts: const ['Cuenta estratégica'],
      competitors: const ['Competidor'],
      excludedCompanies: const ['Empresa excluida'],
      noBuyReason: 'Tecnología incompatible',
      serviceTypes: const ['Estudio puntual'],
      serviceComments: 'Entrega prioritaria.',
      privacyAccepted: true,
      marketingConsent: false,
      submittedAt: DateTime.utc(2026, 9, 3),
      pricingQuote: const PricingQuote(
        catalogVersion: '2.0.0',
        pricingModel: 'transparent_scope_v2',
        currency: 'EUR',
        pilotLabel: 'Piloto -50 %',
        pilotDiscountRate: 0.5,
        sectorCount: 1,
        provinceCount: 2,
        includedSectors: 3,
        includedProvinces: 3,
        includedCompanyTypes: 2,
        sectorSupplementEur: 0,
        provinceSupplementEur: 0,
        expansionRule: 'Regla de ampliación',
        lineItems: [
          PricingLineItem(
            planCode: 'one_off',
            planLabel: 'Estudio puntual',
            billingPeriod: 'one_time',
            basePriceEur: 99,
            scopeSupplementEur: 0,
            standardPriceEur: 99,
            pilotPriceEur: 49.5,
            requiresActivePriorStudy: false,
          ),
        ],
      ),
    );

    final json = request.toJson();

    expect(json['form_version'], '3.13.1');
    expect(json['contract_version'], '1.3.2');
    expect(json['execution_contract_version'], '1.12.3');
    expect(json, isNot(contains('submission_id')));
    expect(
      json['intake_metadata'],
      containsPair('submission_id_owner', 'supabase_edge_function_submit_lead'),
    );

    expect(json['full_name'], 'Ana Pérez Gómez');
    expect(json['first_name'], 'Ana');
    expect(json['last_name'], 'Pérez Gómez');
    expect(json['address'], 'Calle Mayor 1, Castellón');
    expect(json['geography_countries'], ['España', 'Portugal']);
    expect(json['geography_spain_scope'], 'Seleccionar provincias');
    expect(json['geography_provinces'], ['Castellón', 'Valencia']);
    expect(
      json['research_scope_model_version'],
      'InduRadar_Calculadora_Alcance_RU_v1',
    );

    expect(json['contact'], {
      'first_name': 'Ana',
      'last_name': 'Pérez Gómez',
      'company_name': 'Industria Ejemplo',
      'job_title': 'Dirección comercial',
      'email': 'ana@example.com',
      'phone': null,
      'country': null,
      'region_city': 'Calle Mayor 1, Castellón',
      'website': 'https://example.com',
      'linkedin': null,
    });
    expect(json['organization_profile'], {
      'company_type': null,
      'employee_range': 'unknown',
      'team_name': null,
    });

    final sellerProfile = json['seller_profile'] as Map<String, Object?>;
    expect(
      sellerProfile['generic_supplier_label'],
      'Automatización industrial',
    );
    expect(sellerProfile['offer'], 'Automatización industrial');
    expect(sellerProfile['technologies'], [
      'robotics_cobots',
      'machine_vision_inspection',
    ]);
    expect(sellerProfile['must_have'], ['Decisión local']);
    expect(sellerProfile['negative_signals'], ['Tecnología incompatible']);

    final nestedRequest = json['request'] as Map<String, Object?>;
    expect(
      nestedRequest['title'],
      'Solicitud de radar comercial - Industria Ejemplo',
    );
    expect(nestedRequest['sectors'], ['machinery_capital_goods']);
    expect(nestedRequest['target_company_types'], ['machine_builder_oem']);
    expect(nestedRequest['opportunity_areas'], ['digitalization_industry_4']);
    expect(nestedRequest['signal_types'], ['new_production_line']);
    expect(nestedRequest['technologies'], [
      'robotics_cobots',
      'machine_vision_inspection',
    ]);
    expect(nestedRequest['frequency'], 'one_off');
    expect(nestedRequest['delivery_format'], isEmpty);
    expect(nestedRequest['neutral_output'], isTrue);
    expect(nestedRequest['internal_output_authorized'], isFalse);
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

    final extensions = json['request_extensions'] as Map<String, Object?>;
    expect(extensions['target_revenue_range'], '10-50 M€');
    expect(extensions['target_employee_range'], '101-500 empleados');
    expect(extensions['current_clients'], ['Cliente actual']);
    expect(extensions['service_comments'], 'Entrega prioritaria.');
    expect(extensions['estimated_pricing'], json['pricing']);

    expect(json['privacy'], {
      'privacy_notice_accepted': true,
      'commercial_contact_consent': false,
      'accepted_at': '2026-09-03T00:00:00.000Z',
    });
    final pricing = json['pricing'] as Map<String, Object?>;
    expect(pricing['pricing_model'], 'transparent_scope_v2');
    expect(pricing, isNot(contains('research_scope_units')));
    expect(
      (pricing['line_items'] as List).single,
      containsPair('pilot_price_eur', 49.5),
    );
  });

  test('unknown custom taxonomy values use canonical fallback codes', () {
    final request = _minimalRequest(
      targetSectors: const ['Sector muy específico'],
      targetCompanyTypes: const ['Organización especial'],
      investmentSignals: const ['Señal personalizada'],
      prioritySolutions: 'Solución propietaria',
    );

    final json = request.toJson();
    final nestedRequest = json['request'] as Map<String, Object?>;
    expect(nestedRequest['sectors'], ['other_sector']);
    expect(nestedRequest['target_company_types'], ['other_company_type']);
    expect(nestedRequest['signal_types'], ['other_signal']);
    expect(nestedRequest['technologies'], ['other_technology']);

    final extensions = json['request_extensions'] as Map<String, Object?>;
    final labels = extensions['taxonomy_labels'] as Map<String, Object?>;
    expect(labels['sectors'], ['Sector muy específico']);
    expect(labels['signal_types'], ['Señal personalizada']);
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

LeadRequest _minimalRequest({
  List<String> targetSectors = const ['Maquinaria y bienes de equipo'],
  List<String> targetCompanyTypes = const ['Fabricante de maquinaria / OEM'],
  List<String> investmentSignals = const [],
  String prioritySolutions = '',
}) {
  return LeadRequest(
    fullName: 'Ana Pérez',
    company: 'Empresa',
    jobTitle: '',
    email: 'ana@example.com',
    phone: '',
    website: '',
    address: '',
    offerDescription: 'Automatización',
    offerCategories: const [],
    problemsSolved: const [],
    prioritySolutions: prioritySolutions,
    targetSectors: targetSectors,
    targetCompanyTypes: targetCompanyTypes,
    geographyCountries: const ['España'],
    spainCoverage: 'Toda España',
    geographyProvinces: const [],
    targetRevenueRange: null,
    targetEmployeeRange: null,
    minimumOpportunityValue: null,
    targetCompanyDescription: '',
    investmentSignals: investmentSignals,
    innovationSignals: const [],
    growthSignals: const [],
    publicFinanceSignals: const [],
    commercialNeeds: const [],
    opportunityTriggerDescription: 'Descripción de la oportunidad.',
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
    submittedAt: DateTime.utc(2026, 9, 3),
  );
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
