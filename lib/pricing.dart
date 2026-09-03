import 'dart:convert';

class PricingCatalog {
  const PricingCatalog({
    required this.version,
    required this.model,
    required this.currency,
    required this.pilotLabel,
    required this.pilotDiscountRate,
    required this.includedSectors,
    required this.includedProvinces,
    required this.includedCompanyTypes,
    required this.firstExtraUnits,
    required this.firstExtraUnitPriceEur,
    required this.subsequentExtraUnitPriceEur,
    required this.spainProvinceCount,
    required this.defaultPlanCode,
    required this.servicePlanMappings,
    required this.plans,
    required this.expansionRule,
  });

  static const assetPath = 'assets/config/induradar_pricing_v2.json';

  factory PricingCatalog.fromJsonString(String source) {
    final decoded = jsonDecode(source);
    if (decoded is! Map<String, dynamic>) {
      throw const FormatException('Pricing catalog must be a JSON object.');
    }
    return PricingCatalog.fromJson(decoded);
  }

  factory PricingCatalog.fromJson(Map<String, dynamic> json) {
    final scope = _requiredMap(json, 'scope');
    final firstExtraBand = _requiredMap(scope, 'first_extra_band');
    final countryScopes = _requiredMap(scope, 'country_scopes');
    final plansJson = _requiredList(json, 'plans');
    final plans = <String, PricingPlan>{};
    for (final value in plansJson) {
      if (value is! Map<String, dynamic>) {
        throw const FormatException('Every pricing plan must be an object.');
      }
      final plan = PricingPlan.fromJson(value);
      if (plans.containsKey(plan.code)) {
        throw FormatException('Duplicated pricing plan: ${plan.code}.');
      }
      plans[plan.code] = plan;
    }

    final mappingsJson = _requiredMap(json, 'service_plan_mappings');
    final mappings = mappingsJson.map(
      (serviceType, planCode) => MapEntry(serviceType, planCode.toString()),
    );
    final catalog = PricingCatalog(
      version: _requiredString(json, 'catalog_version'),
      model: _requiredString(json, 'pricing_model'),
      currency: _requiredString(json, 'currency'),
      pilotLabel: _requiredString(json, 'pilot_label'),
      pilotDiscountRate: _requiredNum(json, 'pilot_discount_rate'),
      includedSectors: _requiredInt(scope, 'included_sectors'),
      includedProvinces: _requiredInt(scope, 'included_provinces'),
      includedCompanyTypes: _requiredInt(scope, 'included_company_types'),
      firstExtraUnits: _requiredInt(firstExtraBand, 'units'),
      firstExtraUnitPriceEur: _requiredNum(firstExtraBand, 'unit_price_eur'),
      subsequentExtraUnitPriceEur: _requiredNum(
        scope,
        'subsequent_extra_unit_price_eur',
      ),
      spainProvinceCount: _requiredInt(countryScopes, 'spain_all_provinces'),
      defaultPlanCode: _requiredString(json, 'default_plan_code'),
      servicePlanMappings: mappings,
      plans: plans,
      expansionRule: _requiredString(
        _requiredMap(json, 'contract_rules'),
        'scope_expansion',
      ),
    );
    catalog._validate();
    return catalog;
  }

  final String version;
  final String model;
  final String currency;
  final String pilotLabel;
  final num pilotDiscountRate;
  final int includedSectors;
  final int includedProvinces;
  final int includedCompanyTypes;
  final int firstExtraUnits;
  final num firstExtraUnitPriceEur;
  final num subsequentExtraUnitPriceEur;
  final int spainProvinceCount;
  final String defaultPlanCode;
  final Map<String, String> servicePlanMappings;
  final Map<String, PricingPlan> plans;
  final String expansionRule;

  num get entryPilotPriceEur =>
      _money(plans[defaultPlanCode]!.basePriceEur * pilotDiscountRate);

  num scopeSupplement(int count, int includedCount) {
    final extraCount = count > includedCount ? count - includedCount : 0;
    final firstBandCount = extraCount > firstExtraUnits
        ? firstExtraUnits
        : extraCount;
    final subsequentCount = extraCount > firstExtraUnits
        ? extraCount - firstExtraUnits
        : 0;
    return _money(
      firstBandCount * firstExtraUnitPriceEur +
          subsequentCount * subsequentExtraUnitPriceEur,
    );
  }

  PricingQuote quote({
    required int sectorCount,
    required int provinceCount,
    required Set<String> serviceTypes,
  }) {
    final normalizedSectorCount = sectorCount < 0 ? 0 : sectorCount;
    final normalizedProvinceCount = provinceCount < 0 ? 0 : provinceCount;
    final sectorSupplement = scopeSupplement(
      normalizedSectorCount,
      includedSectors,
    );
    final provinceSupplement = scopeSupplement(
      normalizedProvinceCount,
      includedProvinces,
    );
    final totalScopeSupplement = sectorSupplement + provinceSupplement;
    final selectedPlanCodes = <String>{};
    for (final serviceType in serviceTypes) {
      final planCode = servicePlanMappings[serviceType];
      if (planCode != null) {
        selectedPlanCodes.add(planCode);
      }
    }
    if (selectedPlanCodes.isEmpty) {
      selectedPlanCodes.add(defaultPlanCode);
    }

    final lineItems = <PricingLineItem>[];
    for (final plan in plans.values) {
      if (!selectedPlanCodes.contains(plan.code)) {
        continue;
      }
      final appliedSupplement = _money(
        totalScopeSupplement * plan.supplementFactor,
      );
      final standardPrice = _money(plan.basePriceEur + appliedSupplement);
      lineItems.add(
        PricingLineItem(
          planCode: plan.code,
          planLabel: plan.label,
          billingPeriod: plan.billingPeriod,
          basePriceEur: plan.basePriceEur,
          scopeSupplementEur: appliedSupplement,
          standardPriceEur: standardPrice,
          pilotPriceEur: _money(standardPrice * pilotDiscountRate),
          requiresActivePriorStudy: plan.requiresActivePriorStudy,
        ),
      );
    }

    return PricingQuote(
      catalogVersion: version,
      pricingModel: model,
      currency: currency,
      pilotLabel: pilotLabel,
      pilotDiscountRate: pilotDiscountRate,
      sectorCount: normalizedSectorCount,
      provinceCount: normalizedProvinceCount,
      includedSectors: includedSectors,
      includedProvinces: includedProvinces,
      includedCompanyTypes: includedCompanyTypes,
      sectorSupplementEur: sectorSupplement,
      provinceSupplementEur: provinceSupplement,
      expansionRule: expansionRule,
      lineItems: lineItems,
    );
  }

  void _validate() {
    if (pilotDiscountRate <= 0 || pilotDiscountRate > 1) {
      throw const FormatException(
        'Pilot discount rate must be greater than 0 and at most 1.',
      );
    }
    if (includedSectors < 0 ||
        includedProvinces < 0 ||
        includedCompanyTypes < 0 ||
        firstExtraUnits <= 0 ||
        firstExtraUnitPriceEur < 0 ||
        subsequentExtraUnitPriceEur < 0 ||
        spainProvinceCount <= 0) {
      throw const FormatException('Pricing scope contains invalid values.');
    }
    if (!plans.containsKey(defaultPlanCode)) {
      throw FormatException(
        'Default pricing plan does not exist: $defaultPlanCode.',
      );
    }
    for (final entry in servicePlanMappings.entries) {
      if (!plans.containsKey(entry.value)) {
        throw FormatException(
          'Service ${entry.key} uses unknown pricing plan ${entry.value}.',
        );
      }
    }
  }
}

class PricingPlan {
  const PricingPlan({
    required this.code,
    required this.label,
    required this.billingPeriod,
    required this.basePriceEur,
    required this.supplementFactor,
    required this.requiresActivePriorStudy,
  });

  factory PricingPlan.fromJson(Map<String, dynamic> json) {
    final plan = PricingPlan(
      code: _requiredString(json, 'code'),
      label: _requiredString(json, 'label'),
      billingPeriod: _requiredString(json, 'billing_period'),
      basePriceEur: _requiredNum(json, 'base_price_eur'),
      supplementFactor: _requiredNum(json, 'supplement_factor'),
      requiresActivePriorStudy: json['requires_active_prior_study'] == true,
    );
    if (plan.basePriceEur <= 0 || plan.supplementFactor < 0) {
      throw FormatException('Pricing plan ${plan.code} is invalid.');
    }
    return plan;
  }

  final String code;
  final String label;
  final String billingPeriod;
  final num basePriceEur;
  final num supplementFactor;
  final bool requiresActivePriorStudy;
}

class PricingQuote {
  const PricingQuote({
    required this.catalogVersion,
    required this.pricingModel,
    required this.currency,
    required this.pilotLabel,
    required this.pilotDiscountRate,
    required this.sectorCount,
    required this.provinceCount,
    required this.includedSectors,
    required this.includedProvinces,
    required this.includedCompanyTypes,
    required this.sectorSupplementEur,
    required this.provinceSupplementEur,
    required this.expansionRule,
    required this.lineItems,
  });

  final String catalogVersion;
  final String pricingModel;
  final String currency;
  final String pilotLabel;
  final num pilotDiscountRate;
  final int sectorCount;
  final int provinceCount;
  final int includedSectors;
  final int includedProvinces;
  final int includedCompanyTypes;
  final num sectorSupplementEur;
  final num provinceSupplementEur;
  final String expansionRule;
  final List<PricingLineItem> lineItems;

  Map<String, Object?> toJson() {
    return {
      'catalog_version': catalogVersion,
      'pricing_model': pricingModel,
      'currency': currency,
      'price_type': 'pilot',
      'price_label': pilotLabel,
      'pilot_discount_rate': pilotDiscountRate,
      'scope': {
        'sector_count': sectorCount,
        'province_count': provinceCount,
        'included_sectors': includedSectors,
        'included_provinces': includedProvinces,
        'included_company_types': includedCompanyTypes,
        'sector_supplement_eur': sectorSupplementEur,
        'province_supplement_eur': provinceSupplementEur,
      },
      'contract_rules': {'scope_expansion': expansionRule},
      'line_items': lineItems.map((item) => item.toJson()).toList(),
    };
  }
}

class PricingLineItem {
  const PricingLineItem({
    required this.planCode,
    required this.planLabel,
    required this.billingPeriod,
    required this.basePriceEur,
    required this.scopeSupplementEur,
    required this.standardPriceEur,
    required this.pilotPriceEur,
    required this.requiresActivePriorStudy,
  });

  final String planCode;
  final String planLabel;
  final String billingPeriod;
  final num basePriceEur;
  final num scopeSupplementEur;
  final num standardPriceEur;
  final num pilotPriceEur;
  final bool requiresActivePriorStudy;

  bool get isMonthly => billingPeriod == 'month';

  Map<String, Object?> toJson() {
    return {
      'plan_code': planCode,
      'plan_label': planLabel,
      'billing_period': billingPeriod,
      'base_price_eur': basePriceEur,
      'scope_supplement_eur': scopeSupplementEur,
      'standard_price_eur': standardPriceEur,
      'pilot_price_eur': pilotPriceEur,
      'requires_active_prior_study': requiresActivePriorStudy,
    };
  }
}

num _money(num value) {
  final rounded = (value * 100).round() / 100;
  return rounded == rounded.roundToDouble() ? rounded.toInt() : rounded;
}

String _requiredString(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is! String || value.trim().isEmpty) {
    throw FormatException('Pricing field $key must be a non-empty string.');
  }
  return value;
}

num _requiredNum(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is! num) {
    throw FormatException('Pricing field $key must be numeric.');
  }
  return value;
}

int _requiredInt(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is! int) {
    throw FormatException('Pricing field $key must be an integer.');
  }
  return value;
}

Map<String, dynamic> _requiredMap(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is! Map<String, dynamic>) {
    throw FormatException('Pricing field $key must be an object.');
  }
  return value;
}

List<dynamic> _requiredList(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is! List<dynamic>) {
    throw FormatException('Pricing field $key must be an array.');
  }
  return value;
}
