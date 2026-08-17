import 'dart:convert';

class PricingCatalog {
  const PricingCatalog({
    required this.version,
    required this.currency,
    required this.pilotLabel,
    required this.defaultPlanCode,
    required this.recurringPlanCode,
    required this.oneOffServiceType,
    required this.recurringServiceTypes,
    required this.plans,
  });

  static const assetPath = 'assets/config/induradar_pricing_v1.json';

  factory PricingCatalog.fromJsonString(String source) {
    final decoded = jsonDecode(source);
    if (decoded is! Map<String, dynamic>) {
      throw const FormatException('Pricing catalog must be a JSON object.');
    }
    return PricingCatalog.fromJson(decoded);
  }

  factory PricingCatalog.fromJson(Map<String, dynamic> json) {
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

    final catalog = PricingCatalog(
      version: _requiredString(json, 'catalog_version'),
      currency: _requiredString(json, 'currency'),
      pilotLabel: _requiredString(json, 'pilot_label'),
      defaultPlanCode: _requiredString(json, 'default_plan_code'),
      recurringPlanCode: _requiredString(json, 'recurring_plan_code'),
      oneOffServiceType: _requiredString(json, 'one_off_service_type'),
      recurringServiceTypes: _requiredList(
        json,
        'recurring_service_types',
      ).map((value) => value.toString()).toSet(),
      plans: plans,
    );
    catalog._validate();
    return catalog;
  }

  final String version;
  final String currency;
  final String pilotLabel;
  final String defaultPlanCode;
  final String recurringPlanCode;
  final String oneOffServiceType;
  final Set<String> recurringServiceTypes;
  final Map<String, PricingPlan> plans;

  num get entryPilotPriceEur =>
      plans[defaultPlanCode]!.tiers.first.pilotPriceEur;

  PricingQuote quote({
    required num researchUnits,
    required Set<String> serviceTypes,
  }) {
    final billableResearchUnits = researchUnits.ceil();
    final hasRecurring = serviceTypes.any(recurringServiceTypes.contains);
    final includeOneOff =
        !hasRecurring || serviceTypes.contains(oneOffServiceType);
    final lineItems = <PricingLineItem>[];

    if (includeOneOff) {
      lineItems.add(_lineItem(defaultPlanCode, billableResearchUnits));
    }
    if (hasRecurring) {
      lineItems.add(_lineItem(recurringPlanCode, billableResearchUnits));
    }

    return PricingQuote(
      catalogVersion: version,
      currency: currency,
      pilotLabel: pilotLabel,
      researchUnits: researchUnits,
      billableResearchUnits: billableResearchUnits,
      lineItems: lineItems,
    );
  }

  PricingLineItem _lineItem(String planCode, num researchUnits) {
    final plan = plans[planCode];
    if (plan == null) {
      throw StateError('Pricing plan not found: $planCode.');
    }
    final tier = plan.tierFor(researchUnits);
    return PricingLineItem(
      planCode: plan.code,
      planLabel: plan.label,
      billingPeriod: plan.billingPeriod,
      standardPriceEur: tier.standardPriceEur,
      pilotPriceEur: tier.pilotPriceEur,
      startingAt: tier.startingAt,
      tierMinimumRu: tier.minimumRu,
      tierMaximumRu: tier.maximumRu,
      example: tier.example,
    );
  }

  void _validate() {
    if (!plans.containsKey(defaultPlanCode)) {
      throw FormatException(
        'Default pricing plan does not exist: $defaultPlanCode.',
      );
    }
    if (!plans.containsKey(recurringPlanCode)) {
      throw FormatException(
        'Recurring pricing plan does not exist: $recurringPlanCode.',
      );
    }
  }
}

class PricingPlan {
  const PricingPlan({
    required this.code,
    required this.label,
    required this.billingPeriod,
    required this.tiers,
  });

  factory PricingPlan.fromJson(Map<String, dynamic> json) {
    final tiers = _requiredList(json, 'tiers')
        .map((value) {
          if (value is! Map<String, dynamic>) {
            throw const FormatException(
              'Every pricing tier must be an object.',
            );
          }
          return PricingTier.fromJson(value);
        })
        .toList(growable: false);
    if (tiers.isEmpty) {
      throw FormatException(
        'Pricing plan ${json['code']} must contain at least one tier.',
      );
    }
    final plan = PricingPlan(
      code: _requiredString(json, 'code'),
      label: _requiredString(json, 'label'),
      billingPeriod: _requiredString(json, 'billing_period'),
      tiers: tiers,
    );
    plan._validateTiers();
    return plan;
  }

  final String code;
  final String label;
  final String billingPeriod;
  final List<PricingTier> tiers;

  PricingTier tierFor(num researchUnits) {
    for (final tier in tiers) {
      if (researchUnits >= tier.minimumRu &&
          (tier.maximumRu == null || researchUnits <= tier.maximumRu!)) {
        return tier;
      }
    }
    throw StateError('No pricing tier covers $researchUnits RU in $code.');
  }

  void _validateTiers() {
    num? previousMaximum;
    for (var index = 0; index < tiers.length; index++) {
      final tier = tiers[index];
      if (tier.minimumRu < 0 ||
          tier.standardPriceEur <= 0 ||
          tier.pilotPriceEur <= 0 ||
          (tier.maximumRu != null && tier.maximumRu! < tier.minimumRu)) {
        throw FormatException('Pricing plan $code contains an invalid tier.');
      }
      if (index > 0 && tier.minimumRu != previousMaximum! + 1) {
        throw FormatException('Pricing plan $code contains a tier gap.');
      }
      if (tier.maximumRu == null && index != tiers.length - 1) {
        throw FormatException(
          'Only the final tier in pricing plan $code can be open-ended.',
        );
      }
      previousMaximum = tier.maximumRu;
    }
    if (tiers.last.maximumRu != null) {
      throw FormatException('Pricing plan $code must end with an open tier.');
    }
  }
}

class PricingTier {
  const PricingTier({
    required this.minimumRu,
    required this.maximumRu,
    required this.example,
    required this.standardPriceEur,
    required this.pilotPriceEur,
    required this.startingAt,
  });

  factory PricingTier.fromJson(Map<String, dynamic> json) {
    return PricingTier(
      minimumRu: _requiredNum(json, 'minimum_ru'),
      maximumRu: json['maximum_ru'] == null
          ? null
          : _requiredNum(json, 'maximum_ru'),
      example: _requiredString(json, 'example'),
      standardPriceEur: _requiredNum(json, 'standard_price_eur'),
      pilotPriceEur: _requiredNum(json, 'pilot_price_eur'),
      startingAt: json['starting_at'] == true,
    );
  }

  final num minimumRu;
  final num? maximumRu;
  final String example;
  final num standardPriceEur;
  final num pilotPriceEur;
  final bool startingAt;
}

class PricingQuote {
  const PricingQuote({
    required this.catalogVersion,
    required this.currency,
    required this.pilotLabel,
    required this.researchUnits,
    required this.billableResearchUnits,
    required this.lineItems,
  });

  final String catalogVersion;
  final String currency;
  final String pilotLabel;
  final num researchUnits;
  final int billableResearchUnits;
  final List<PricingLineItem> lineItems;

  Map<String, Object?> toJson() {
    return {
      'catalog_version': catalogVersion,
      'currency': currency,
      'price_type': 'pilot',
      'price_label': pilotLabel,
      'research_scope_units': researchUnits,
      'billable_research_scope_units': billableResearchUnits,
      'line_items': lineItems.map((item) => item.toJson()).toList(),
    };
  }
}

class PricingLineItem {
  const PricingLineItem({
    required this.planCode,
    required this.planLabel,
    required this.billingPeriod,
    required this.standardPriceEur,
    required this.pilotPriceEur,
    required this.startingAt,
    required this.tierMinimumRu,
    required this.tierMaximumRu,
    required this.example,
  });

  final String planCode;
  final String planLabel;
  final String billingPeriod;
  final num standardPriceEur;
  final num pilotPriceEur;
  final bool startingAt;
  final num tierMinimumRu;
  final num? tierMaximumRu;
  final String example;

  bool get isMonthly => billingPeriod == 'month';

  Map<String, Object?> toJson() {
    return {
      'plan_code': planCode,
      'plan_label': planLabel,
      'billing_period': billingPeriod,
      'standard_price_eur': standardPriceEur,
      'pilot_price_eur': pilotPriceEur,
      'starting_at': startingAt,
      'tier_minimum_ru': tierMinimumRu,
      'tier_maximum_ru': tierMaximumRu,
      'example': example,
    };
  }
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

List<dynamic> _requiredList(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is! List<dynamic>) {
    throw FormatException('Pricing field $key must be an array.');
  }
  return value;
}
