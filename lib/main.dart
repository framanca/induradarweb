import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

const _leadEndpoint = String.fromEnvironment('LEAD_ENDPOINT');
const _leadEndpointAuthToken = String.fromEnvironment(
  'LEAD_ENDPOINT_AUTH_TOKEN',
);

const _logoAsset = 'assets/InduradarLogo.png';
const _ink = Color(0xFF102335);
const _blue = Color(0xFF075A8F);
const _cyan = Color(0xFF18BFD7);
const _steel = Color(0xFF66717C);
const _line = Color(0xFFD8E4EA);
const _surface = Color(0xFFF4F8FA);
const _success = Color(0xFF1D7A57);

void main() {
  runApp(const InduRadarApp());
}

class InduRadarApp extends StatelessWidget {
  const InduRadarApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'InduRadar',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: _blue,
          primary: _blue,
          secondary: _cyan,
          surface: Colors.white,
        ),
        scaffoldBackgroundColor: _surface,
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: _line),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: _line),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: _blue, width: 1.4),
          ),
          errorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: Color(0xFFC7362E)),
          ),
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: _blue,
            foregroundColor: Colors.white,
            minimumSize: const Size.fromHeight(52),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
            textStyle: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
      home: const LandingPage(),
    );
  }
}

class LandingPage extends StatefulWidget {
  const LandingPage({super.key, LeadSubmissionService? submissionService})
    : _submissionService = submissionService;

  final LeadSubmissionService? _submissionService;

  @override
  State<LandingPage> createState() => _LandingPageState();
}

class _LandingPageState extends State<LandingPage> {
  final _formKey = GlobalKey<FormState>();

  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _companyController = TextEditingController();
  final _jobTitleController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _websiteController = TextEditingController();
  final _cityProvinceController = TextEditingController();
  final _offerDescriptionController = TextEditingController();
  final _otherOfferCategoryController = TextEditingController();
  final _otherProblemController = TextEditingController();
  final _prioritySolutionsController = TextEditingController();
  final _otherSectorController = TextEditingController();
  final _otherTargetCompanyTypeController = TextEditingController();
  final _geographyCountriesController = TextEditingController();
  final _geographyRegionsController = TextEditingController();
  final _geographyProvincesController = TextEditingController();
  final _geographyFreeZoneController = TextEditingController();
  final _otherMinimumValueController = TextEditingController();
  final _targetCompanyDescriptionController = TextEditingController();
  final _otherNeedController = TextEditingController();
  final _opportunityTriggerController = TextEditingController();
  final _recentCaseController = TextEditingController();
  final _currentClientsController = TextEditingController();
  final _idealClientsController = TextEditingController();
  final _watchlistAccountsController = TextEditingController();
  final _competitorsController = TextEditingController();
  final _excludedCompaniesController = TextEditingController();
  final _noBuyReasonController = TextEditingController();
  final _serviceCommentsController = TextEditingController();

  late final LeadSubmissionService _submissionService =
      widget._submissionService ?? const LeadSubmissionService();

  final Set<String> _offerCategories = <String>{};
  final Set<String> _problemsSolved = <String>{};
  final Set<String> _targetSectors = <String>{};
  final Set<String> _targetCompanyTypes = <String>{};
  final Set<String> _investmentSignals = <String>{};
  final Set<String> _innovationSignals = <String>{};
  final Set<String> _growthSignals = <String>{};
  final Set<String> _publicFinanceSignals = <String>{};
  final Set<String> _commercialNeeds = <String>{};
  final Set<String> _serviceTypes = <String>{};

  String? _targetRevenueRange;
  String? _targetEmployeeRange;
  String? _minimumOpportunityValue;
  bool _privacyAccepted = false;
  bool _marketingConsent = false;
  bool _isSubmitting = false;
  String? _privacyError;
  String? _successMessage;

  @override
  void dispose() {
    for (final controller in [
      _firstNameController,
      _lastNameController,
      _companyController,
      _jobTitleController,
      _emailController,
      _phoneController,
      _websiteController,
      _cityProvinceController,
      _offerDescriptionController,
      _otherOfferCategoryController,
      _otherProblemController,
      _prioritySolutionsController,
      _otherSectorController,
      _otherTargetCompanyTypeController,
      _geographyCountriesController,
      _geographyRegionsController,
      _geographyProvincesController,
      _geographyFreeZoneController,
      _otherMinimumValueController,
      _targetCompanyDescriptionController,
      _otherNeedController,
      _opportunityTriggerController,
      _recentCaseController,
      _currentClientsController,
      _idealClientsController,
      _watchlistAccountsController,
      _competitorsController,
      _excludedCompaniesController,
      _noBuyReasonController,
      _serviceCommentsController,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _privacyError = _privacyAccepted
          ? null
          : 'Necesitamos tu consentimiento para responderte.';
      _successMessage = null;
    });

    if (!(_formKey.currentState?.validate() ?? false) ||
        _privacyError != null) {
      return;
    }

    setState(() {
      _isSubmitting = true;
    });

    final request = LeadRequest(
      firstName: _firstNameController.text.trim(),
      lastName: _lastNameController.text.trim(),
      company: _companyController.text.trim(),
      jobTitle: _jobTitleController.text.trim(),
      email: _emailController.text.trim(),
      phone: _phoneController.text.trim(),
      website: _websiteController.text.trim(),
      cityProvince: _cityProvinceController.text.trim(),
      offerDescription: _offerDescriptionController.text.trim(),
      offerCategories: _selectedValuesWithOther(
        _offerCategories,
        _otherOfferCategoryController.text,
        otherOption: _otherOfferCategoryOption,
      ),
      problemsSolved: _selectedValuesWithOther(
        _problemsSolved,
        _otherProblemController.text,
        otherOption: _otherProblemOption,
      ),
      prioritySolutions: _prioritySolutionsController.text.trim(),
      targetSectors: _selectedValuesWithOther(
        _targetSectors,
        _otherSectorController.text,
        otherOption: _otherSectorOption,
      ),
      targetCompanyTypes: _selectedValuesWithOther(
        _targetCompanyTypes,
        _otherTargetCompanyTypeController.text,
        otherOption: _otherTargetCompanyTypeOption,
      ),
      geographyCountries: _splitFreeTextValues(
        _geographyCountriesController.text,
      ),
      geographyRegions: _splitFreeTextValues(_geographyRegionsController.text),
      geographyProvinces: _splitFreeTextValues(
        _geographyProvincesController.text,
      ),
      geographyFreeZone: _geographyFreeZoneController.text.trim(),
      targetRevenueRange: _targetRevenueRange,
      targetEmployeeRange: _targetEmployeeRange,
      minimumOpportunityValue:
          _minimumOpportunityValue == _otherMinimumValueOption
          ? _otherMinimumValueController.text.trim()
          : _minimumOpportunityValue,
      targetCompanyDescription: _targetCompanyDescriptionController.text.trim(),
      investmentSignals: _investmentSignals.toList(growable: false),
      innovationSignals: _innovationSignals.toList(growable: false),
      growthSignals: _growthSignals.toList(growable: false),
      publicFinanceSignals: _publicFinanceSignals.toList(growable: false),
      commercialNeeds: _selectedValuesWithOther(
        _commercialNeeds,
        _otherNeedController.text,
        otherOption: _otherNeedOption,
      ),
      opportunityTriggerDescription: _opportunityTriggerController.text.trim(),
      recentCaseDescription: _recentCaseController.text.trim(),
      currentClients: _splitLineValues(_currentClientsController.text),
      idealClients: _splitLineValues(_idealClientsController.text),
      watchlistAccounts: _splitLineValues(_watchlistAccountsController.text),
      competitors: _splitLineValues(_competitorsController.text),
      excludedCompanies: _splitLineValues(_excludedCompaniesController.text),
      noBuyReason: _noBuyReasonController.text.trim(),
      serviceTypes: _serviceTypes.toList(growable: false),
      serviceComments: _serviceCommentsController.text.trim(),
      privacyAccepted: _privacyAccepted,
      marketingConsent: _marketingConsent,
      submittedAt: DateTime.now().toUtc(),
    );

    try {
      await _submissionService.submit(request);
      if (!mounted) {
        return;
      }
      setState(() {
        _successMessage =
            'Solicitud enviada. Revisaremos el encaje y responderemos por email.';
        _isSubmitting = false;
      });
    } on LeadSubmissionException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _isSubmitting = false;
      });
      _showError(error.message);
    } on TimeoutException {
      if (!mounted) {
        return;
      }
      setState(() {
        _isSubmitting = false;
      });
      _showError('El envío ha tardado demasiado. Inténtalo de nuevo.');
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _isSubmitting = false;
      });
      _showError('No hemos podido enviar la solicitud. Inténtalo de nuevo.');
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final isWide = constraints.maxWidth >= 980;

            return SingleChildScrollView(
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: constraints.maxHeight),
                child: Center(
                  child: Padding(
                    padding: EdgeInsets.symmetric(
                      horizontal: isWide ? 40 : 20,
                      vertical: isWide ? 36 : 20,
                    ),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 1200),
                      child: isWide
                          ? Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Expanded(flex: 7, child: _LandingIntro()),
                                const SizedBox(width: 40),
                                Expanded(flex: 8, child: _buildFormPanel()),
                              ],
                            )
                          : Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                const _LandingIntro(),
                                const SizedBox(height: 28),
                                _buildFormPanel(),
                              ],
                            ),
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildFormPanel() {
    return _LeadFormPanel(
      formKey: _formKey,
      firstNameController: _firstNameController,
      lastNameController: _lastNameController,
      companyController: _companyController,
      jobTitleController: _jobTitleController,
      emailController: _emailController,
      phoneController: _phoneController,
      websiteController: _websiteController,
      cityProvinceController: _cityProvinceController,
      offerDescriptionController: _offerDescriptionController,
      otherOfferCategoryController: _otherOfferCategoryController,
      otherProblemController: _otherProblemController,
      prioritySolutionsController: _prioritySolutionsController,
      otherSectorController: _otherSectorController,
      otherTargetCompanyTypeController: _otherTargetCompanyTypeController,
      geographyCountriesController: _geographyCountriesController,
      geographyRegionsController: _geographyRegionsController,
      geographyProvincesController: _geographyProvincesController,
      geographyFreeZoneController: _geographyFreeZoneController,
      otherMinimumValueController: _otherMinimumValueController,
      targetCompanyDescriptionController: _targetCompanyDescriptionController,
      otherNeedController: _otherNeedController,
      opportunityTriggerController: _opportunityTriggerController,
      recentCaseController: _recentCaseController,
      currentClientsController: _currentClientsController,
      idealClientsController: _idealClientsController,
      watchlistAccountsController: _watchlistAccountsController,
      competitorsController: _competitorsController,
      excludedCompaniesController: _excludedCompaniesController,
      noBuyReasonController: _noBuyReasonController,
      serviceCommentsController: _serviceCommentsController,
      offerCategories: _offerCategories,
      problemsSolved: _problemsSolved,
      targetSectors: _targetSectors,
      targetCompanyTypes: _targetCompanyTypes,
      investmentSignals: _investmentSignals,
      innovationSignals: _innovationSignals,
      growthSignals: _growthSignals,
      publicFinanceSignals: _publicFinanceSignals,
      commercialNeeds: _commercialNeeds,
      serviceTypes: _serviceTypes,
      targetRevenueRange: _targetRevenueRange,
      targetEmployeeRange: _targetEmployeeRange,
      minimumOpportunityValue: _minimumOpportunityValue,
      privacyAccepted: _privacyAccepted,
      marketingConsent: _marketingConsent,
      privacyError: _privacyError,
      successMessage: _successMessage,
      isSubmitting: _isSubmitting,
      onToggleOption: _toggleOption,
      onRevenueChanged: (value) => setState(() => _targetRevenueRange = value),
      onEmployeeRangeChanged: (value) {
        setState(() => _targetEmployeeRange = value);
      },
      onMinimumValueChanged: (value) {
        setState(() => _minimumOpportunityValue = value);
      },
      onPrivacyChanged: _setPrivacyAccepted,
      onMarketingChanged: (value) {
        setState(() => _marketingConsent = value ?? false);
      },
      onSubmit: _submit,
    );
  }

  void _toggleOption(Set<String> selectedValues, String label, bool selected) {
    setState(() {
      if (selected) {
        selectedValues.add(label);
      } else {
        selectedValues.remove(label);
      }
    });
  }

  void _setPrivacyAccepted(bool? value) {
    setState(() {
      _privacyAccepted = value ?? false;
      _privacyError = _privacyAccepted
          ? null
          : 'Necesitamos tu consentimiento para responderte.';
    });
  }

  List<String> _selectedValuesWithOther(
    Set<String> selectedValues,
    String otherValue, {
    required String otherOption,
  }) {
    final values = selectedValues
        .where((value) => value != otherOption)
        .toList(growable: true);
    if (selectedValues.contains(otherOption)) {
      values.addAll(_splitFreeTextValues(otherValue));
    }
    return values;
  }

  List<String> _splitFreeTextValues(String value) {
    return value
        .split(RegExp(r'[,;]'))
        .map((item) => item.trim())
        .where((item) => item.isNotEmpty)
        .toList(growable: false);
  }

  List<String> _splitLineValues(String value) {
    return value
        .split(RegExp(r'[\n;]'))
        .map((item) => item.trim())
        .where((item) => item.isNotEmpty)
        .toList(growable: false);
  }
}

class _LandingIntro extends StatelessWidget {
  const _LandingIntro();

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Image.asset(_logoAsset, width: 246, fit: BoxFit.contain),
        const SizedBox(height: 28),
        Text(
          'InduRadar',
          style: textTheme.displaySmall?.copyWith(
            color: _ink,
            fontWeight: FontWeight.w800,
            letterSpacing: 0,
          ),
        ),
        const SizedBox(height: 12),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 620),
          child: Text(
            'Radar comercial para detectar cambios industriales que pueden convertirse en oportunidades de venta.',
            style: textTheme.headlineSmall?.copyWith(
              color: _ink,
              height: 1.25,
              fontWeight: FontWeight.w700,
              letterSpacing: 0,
            ),
          ),
        ),
        const SizedBox(height: 18),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 620),
          child: Text(
            'Este formulario define qué ofrece tu empresa, qué compañías buscas y qué señales deben activar el radar. Solo algunos campos son obligatorios; el resto ayuda a afinar la investigación.',
            style: textTheme.bodyLarge?.copyWith(color: _steel, height: 1.55),
          ),
        ),
        const SizedBox(height: 28),
        const Wrap(
          spacing: 14,
          runSpacing: 14,
          children: [
            _BenefitItem(
              icon: Icons.radar_outlined,
              title: 'Señales trazables',
              text: 'Inversiones, proyectos, cambios corporativos y ayudas.',
            ),
            _BenefitItem(
              icon: Icons.fact_check_outlined,
              title: 'Encaje comercial',
              text:
                  'Oferta, problemas resueltos, empresa objetivo y geografía.',
            ),
            _BenefitItem(
              icon: Icons.rule_outlined,
              title: 'Seguimiento',
              text: 'Informes puntuales, vigilancia sectorial o alertas.',
            ),
          ],
        ),
      ],
    );
  }
}

class _BenefitItem extends StatelessWidget {
  const _BenefitItem({
    required this.icon,
    required this.title,
    required this.text,
  });

  final IconData icon;
  final String title;
  final String text;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 188,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: const Color(0xFFE6F8FA),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: _blue, size: 20),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: _ink,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  text,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: _steel, height: 1.35),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LeadFormPanel extends StatelessWidget {
  const _LeadFormPanel({
    required this.formKey,
    required this.firstNameController,
    required this.lastNameController,
    required this.companyController,
    required this.jobTitleController,
    required this.emailController,
    required this.phoneController,
    required this.websiteController,
    required this.cityProvinceController,
    required this.offerDescriptionController,
    required this.otherOfferCategoryController,
    required this.otherProblemController,
    required this.prioritySolutionsController,
    required this.otherSectorController,
    required this.otherTargetCompanyTypeController,
    required this.geographyCountriesController,
    required this.geographyRegionsController,
    required this.geographyProvincesController,
    required this.geographyFreeZoneController,
    required this.otherMinimumValueController,
    required this.targetCompanyDescriptionController,
    required this.otherNeedController,
    required this.opportunityTriggerController,
    required this.recentCaseController,
    required this.currentClientsController,
    required this.idealClientsController,
    required this.watchlistAccountsController,
    required this.competitorsController,
    required this.excludedCompaniesController,
    required this.noBuyReasonController,
    required this.serviceCommentsController,
    required this.offerCategories,
    required this.problemsSolved,
    required this.targetSectors,
    required this.targetCompanyTypes,
    required this.investmentSignals,
    required this.innovationSignals,
    required this.growthSignals,
    required this.publicFinanceSignals,
    required this.commercialNeeds,
    required this.serviceTypes,
    required this.targetRevenueRange,
    required this.targetEmployeeRange,
    required this.minimumOpportunityValue,
    required this.privacyAccepted,
    required this.marketingConsent,
    required this.privacyError,
    required this.successMessage,
    required this.isSubmitting,
    required this.onToggleOption,
    required this.onRevenueChanged,
    required this.onEmployeeRangeChanged,
    required this.onMinimumValueChanged,
    required this.onPrivacyChanged,
    required this.onMarketingChanged,
    required this.onSubmit,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController firstNameController;
  final TextEditingController lastNameController;
  final TextEditingController companyController;
  final TextEditingController jobTitleController;
  final TextEditingController emailController;
  final TextEditingController phoneController;
  final TextEditingController websiteController;
  final TextEditingController cityProvinceController;
  final TextEditingController offerDescriptionController;
  final TextEditingController otherOfferCategoryController;
  final TextEditingController otherProblemController;
  final TextEditingController prioritySolutionsController;
  final TextEditingController otherSectorController;
  final TextEditingController otherTargetCompanyTypeController;
  final TextEditingController geographyCountriesController;
  final TextEditingController geographyRegionsController;
  final TextEditingController geographyProvincesController;
  final TextEditingController geographyFreeZoneController;
  final TextEditingController otherMinimumValueController;
  final TextEditingController targetCompanyDescriptionController;
  final TextEditingController otherNeedController;
  final TextEditingController opportunityTriggerController;
  final TextEditingController recentCaseController;
  final TextEditingController currentClientsController;
  final TextEditingController idealClientsController;
  final TextEditingController watchlistAccountsController;
  final TextEditingController competitorsController;
  final TextEditingController excludedCompaniesController;
  final TextEditingController noBuyReasonController;
  final TextEditingController serviceCommentsController;
  final Set<String> offerCategories;
  final Set<String> problemsSolved;
  final Set<String> targetSectors;
  final Set<String> targetCompanyTypes;
  final Set<String> investmentSignals;
  final Set<String> innovationSignals;
  final Set<String> growthSignals;
  final Set<String> publicFinanceSignals;
  final Set<String> commercialNeeds;
  final Set<String> serviceTypes;
  final String? targetRevenueRange;
  final String? targetEmployeeRange;
  final String? minimumOpportunityValue;
  final bool privacyAccepted;
  final bool marketingConsent;
  final String? privacyError;
  final String? successMessage;
  final bool isSubmitting;
  final void Function(Set<String> values, String label, bool selected)
  onToggleOption;
  final ValueChanged<String?> onRevenueChanged;
  final ValueChanged<String?> onEmployeeRangeChanged;
  final ValueChanged<String?> onMinimumValueChanged;
  final ValueChanged<bool?> onPrivacyChanged;
  final ValueChanged<bool?> onMarketingChanged;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: _line),
        borderRadius: BorderRadius.circular(8),
        boxShadow: const [
          BoxShadow(
            color: Color(0x140B2A3B),
            blurRadius: 30,
            offset: Offset(0, 18),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Define tu radar comercial',
                style: textTheme.headlineSmall?.copyWith(
                  color: _ink,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Los campos marcados con * son obligatorios.',
                style: textTheme.bodyMedium?.copyWith(
                  color: _steel,
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 22),
              if (successMessage != null) ...[
                _SuccessBanner(message: successMessage!),
                const SizedBox(height: 18),
              ],
              _FormSection(
                title: '1 · Tu empresa y tu oferta',
                initiallyExpanded: true,
                children: [
                  _ResponsiveFields(
                    children: [
                      TextFormField(
                        controller: firstNameController,
                        autofillHints: const [AutofillHints.givenName],
                        decoration: const InputDecoration(
                          labelText: 'Nombre *',
                          prefixIcon: Icon(Icons.person_outline),
                        ),
                        textInputAction: TextInputAction.next,
                        validator: _required,
                      ),
                      TextFormField(
                        controller: lastNameController,
                        autofillHints: const [AutofillHints.familyName],
                        decoration: const InputDecoration(
                          labelText: 'Apellidos',
                          prefixIcon: Icon(Icons.badge_outlined),
                        ),
                        textInputAction: TextInputAction.next,
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  _ResponsiveFields(
                    children: [
                      TextFormField(
                        controller: companyController,
                        autofillHints: const [AutofillHints.organizationName],
                        decoration: const InputDecoration(
                          labelText: 'Empresa *',
                          prefixIcon: Icon(Icons.apartment_outlined),
                        ),
                        textInputAction: TextInputAction.next,
                        validator: _required,
                      ),
                      TextFormField(
                        controller: jobTitleController,
                        decoration: const InputDecoration(
                          labelText: 'Cargo / función',
                          prefixIcon: Icon(Icons.work_outline),
                        ),
                        textInputAction: TextInputAction.next,
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  _ResponsiveFields(
                    children: [
                      TextFormField(
                        controller: emailController,
                        autofillHints: const [AutofillHints.email],
                        keyboardType: TextInputType.emailAddress,
                        decoration: const InputDecoration(
                          labelText: 'Email profesional *',
                          prefixIcon: Icon(Icons.alternate_email_outlined),
                        ),
                        textInputAction: TextInputAction.next,
                        validator: _emailValidator,
                      ),
                      TextFormField(
                        controller: phoneController,
                        keyboardType: TextInputType.phone,
                        decoration: const InputDecoration(
                          labelText: 'Teléfono',
                          prefixIcon: Icon(Icons.phone_outlined),
                        ),
                        textInputAction: TextInputAction.next,
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  _ResponsiveFields(
                    children: [
                      TextFormField(
                        controller: websiteController,
                        keyboardType: TextInputType.url,
                        decoration: const InputDecoration(
                          labelText: 'Web de la empresa',
                          prefixIcon: Icon(Icons.language_outlined),
                        ),
                        textInputAction: TextInputAction.next,
                      ),
                      TextFormField(
                        controller: cityProvinceController,
                        decoration: const InputDecoration(
                          labelText: 'Ciudad / provincia',
                          prefixIcon: Icon(Icons.location_city_outlined),
                        ),
                        textInputAction: TextInputAction.next,
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: offerDescriptionController,
                    minLines: 3,
                    maxLines: 6,
                    decoration: const InputDecoration(
                      labelText: '¿Qué ofrece tu empresa? *',
                      hintText:
                          'Productos o servicios que quieres vender o promocionar.',
                      alignLabelWithHint: true,
                      prefixIcon: Icon(Icons.inventory_2_outlined),
                    ),
                    validator: _required,
                  ),
                  const SizedBox(height: 18),
                  _MultiSelectChipGroup(
                    title: 'Categoría principal de tu oferta',
                    options: _offerCategoryOptions,
                    selectedValues: offerCategories,
                    isEnabled: !isSubmitting,
                    onChanged: (label, selected) {
                      onToggleOption(offerCategories, label, selected);
                    },
                  ),
                  if (offerCategories.contains(_otherOfferCategoryOption)) ...[
                    const SizedBox(height: 10),
                    _OtherField(
                      controller: otherOfferCategoryController,
                      label: 'Otra categoría',
                      isRequired: true,
                    ),
                  ],
                  const SizedBox(height: 18),
                  _MultiSelectChipGroup(
                    title: '¿Qué problemas ayudas a resolver?',
                    options: _problemOptions,
                    selectedValues: problemsSolved,
                    isEnabled: !isSubmitting,
                    onChanged: (label, selected) {
                      onToggleOption(problemsSolved, label, selected);
                    },
                  ),
                  if (problemsSolved.contains(_otherProblemOption)) ...[
                    const SizedBox(height: 10),
                    _OtherField(
                      controller: otherProblemController,
                      label: 'Otro problema',
                      isRequired: true,
                    ),
                  ],
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: prioritySolutionsController,
                    minLines: 2,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      labelText:
                          'Productos, soluciones o servicios concretos que quieres priorizar',
                      hintText:
                          'Familias concretas, especialidades, marcas, tecnologías, aplicaciones o servicios.',
                      alignLabelWithHint: true,
                      prefixIcon: Icon(Icons.tune_outlined),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _FormSection(
                title: '2 · Tu empresa objetivo',
                children: [
                  _MultiSelectChipGroup(
                    title: 'Sectores objetivo',
                    options: _targetSectorOptions,
                    selectedValues: targetSectors,
                    isEnabled: !isSubmitting,
                    onChanged: (label, selected) {
                      onToggleOption(targetSectors, label, selected);
                    },
                  ),
                  if (targetSectors.contains(_otherSectorOption)) ...[
                    const SizedBox(height: 10),
                    _OtherField(
                      controller: otherSectorController,
                      label: 'Otros sectores',
                      isRequired: true,
                    ),
                  ],
                  const SizedBox(height: 18),
                  _MultiSelectChipGroup(
                    title: 'Tipo de empresa objetivo',
                    options: _targetCompanyTypeOptions,
                    selectedValues: targetCompanyTypes,
                    isEnabled: !isSubmitting,
                    onChanged: (label, selected) {
                      onToggleOption(targetCompanyTypes, label, selected);
                    },
                  ),
                  if (targetCompanyTypes.contains(
                    _otherTargetCompanyTypeOption,
                  )) ...[
                    const SizedBox(height: 10),
                    _OtherField(
                      controller: otherTargetCompanyTypeController,
                      label: 'Otro tipo de empresa objetivo',
                      isRequired: true,
                    ),
                  ],
                  const SizedBox(height: 18),
                  Text(
                    'Geografía',
                    style: textTheme.titleSmall?.copyWith(
                      color: _ink,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextFormField(
                    controller: geographyCountriesController,
                    decoration: const InputDecoration(
                      labelText: 'País / países *',
                      prefixIcon: Icon(Icons.public_outlined),
                    ),
                    textInputAction: TextInputAction.next,
                    validator: _required,
                  ),
                  const SizedBox(height: 14),
                  _ResponsiveFields(
                    children: [
                      TextFormField(
                        controller: geographyRegionsController,
                        decoration: const InputDecoration(
                          labelText: 'Comunidad autónoma / región',
                          prefixIcon: Icon(Icons.map_outlined),
                        ),
                        textInputAction: TextInputAction.next,
                      ),
                      TextFormField(
                        controller: geographyProvincesController,
                        decoration: const InputDecoration(
                          labelText: 'Provincia / provincias',
                          prefixIcon: Icon(Icons.place_outlined),
                        ),
                        textInputAction: TextInputAction.next,
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: geographyFreeZoneController,
                    decoration: const InputDecoration(
                      labelText: 'Ciudad, radio o zona libre',
                      hintText:
                          'Ej.: provincia de Valencia; radio de 100 km alrededor de Zaragoza; España y Portugal.',
                      prefixIcon: Icon(Icons.travel_explore_outlined),
                    ),
                  ),
                  const SizedBox(height: 18),
                  _SingleSelectChipGroup(
                    title: 'Facturación anual aproximada',
                    options: _revenueRangeOptions,
                    selectedValue: targetRevenueRange,
                    isEnabled: !isSubmitting,
                    onChanged: onRevenueChanged,
                  ),
                  const SizedBox(height: 18),
                  _SingleSelectChipGroup(
                    title: 'Empleo / tamaño de la operación industrial',
                    options: _employeeRangeOptions,
                    selectedValue: targetEmployeeRange,
                    isEnabled: !isSubmitting,
                    onChanged: onEmployeeRangeChanged,
                  ),
                  const SizedBox(height: 18),
                  _SingleSelectChipGroup(
                    title:
                        '¿A partir de qué valor aproximado merece la pena investigar una oportunidad?',
                    helperText:
                        'No implica que InduRadar conozca el importe real del proyecto; sirve para priorizar.',
                    options: _minimumOpportunityValueOptions,
                    selectedValue: minimumOpportunityValue,
                    isEnabled: !isSubmitting,
                    onChanged: onMinimumValueChanged,
                  ),
                  if (minimumOpportunityValue == _otherMinimumValueOption) ...[
                    const SizedBox(height: 10),
                    _OtherField(
                      controller: otherMinimumValueController,
                      label: 'Otro valor aproximado',
                      isRequired: true,
                    ),
                  ],
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: targetCompanyDescriptionController,
                    minLines: 3,
                    maxLines: 6,
                    decoration: const InputDecoration(
                      labelText: 'Define tu empresa objetivo ideal',
                      hintText:
                          'Producción propia, decisión local, varias plantas, exportación, tecnologías concretas, certificaciones, tamaño mínimo...',
                      alignLabelWithHint: true,
                      prefixIcon: Icon(Icons.business_center_outlined),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _FormSection(
                title: '3 · Señales que deben activar una alerta',
                children: [
                  _MultiSelectChipGroup(
                    title: 'A. Inversión y capacidad',
                    options: _investmentSignalOptions,
                    selectedValues: investmentSignals,
                    isEnabled: !isSubmitting,
                    onChanged: (label, selected) {
                      onToggleOption(investmentSignals, label, selected);
                    },
                  ),
                  const SizedBox(height: 18),
                  _MultiSelectChipGroup(
                    title: 'B. Innovación y producto',
                    options: _innovationSignalOptions,
                    selectedValues: innovationSignals,
                    isEnabled: !isSubmitting,
                    onChanged: (label, selected) {
                      onToggleOption(innovationSignals, label, selected);
                    },
                  ),
                  const SizedBox(height: 18),
                  _MultiSelectChipGroup(
                    title: 'C. Organización y crecimiento',
                    options: _growthSignalOptions,
                    selectedValues: growthSignals,
                    isEnabled: !isSubmitting,
                    onChanged: (label, selected) {
                      onToggleOption(growthSignals, label, selected);
                    },
                  ),
                  const SizedBox(height: 18),
                  _MultiSelectChipGroup(
                    title: 'D. Compra pública y apoyo financiero',
                    options: _publicFinanceSignalOptions,
                    selectedValues: publicFinanceSignals,
                    isEnabled: !isSubmitting,
                    onChanged: (label, selected) {
                      onToggleOption(publicFinanceSignals, label, selected);
                    },
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _FormSection(
                title: '4 · Necesidades y referencias',
                children: [
                  _MultiSelectChipGroup(
                    title:
                        '¿Qué necesidades o situaciones comerciales te interesa detectar?',
                    helperText:
                        'Pueden ser explícitas o inferirse razonadamente; no se tratarán como compras confirmadas sin evidencia.',
                    options: _commercialNeedOptions,
                    selectedValues: commercialNeeds,
                    isEnabled: !isSubmitting,
                    onChanged: (label, selected) {
                      onToggleOption(commercialNeeds, label, selected);
                    },
                  ),
                  if (commercialNeeds.contains(_otherNeedOption)) ...[
                    const SizedBox(height: 10),
                    _OtherField(
                      controller: otherNeedController,
                      label: 'Otra necesidad',
                      isRequired: true,
                    ),
                  ],
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: opportunityTriggerController,
                    minLines: 4,
                    maxLines: 7,
                    decoration: const InputDecoration(
                      labelText:
                          'Describe una oportunidad comercial que justificaría una acción de tu equipo de ventas *',
                      hintText:
                          'Qué tendría que ocurrir para que merezca una llamada, visita, reunión o investigación adicional.',
                      alignLabelWithHint: true,
                      prefixIcon: Icon(Icons.notes_outlined),
                    ),
                    validator: _required,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: recentCaseController,
                    minLines: 3,
                    maxLines: 6,
                    decoration: const InputDecoration(
                      labelText: 'Ayúdanos con un caso real o reciente',
                      hintText:
                          'Qué estaba ocurriendo en ese cliente antes de que surgiera la oportunidad.',
                      alignLabelWithHint: true,
                      prefixIcon: Icon(Icons.history_outlined),
                    ),
                  ),
                  const SizedBox(height: 18),
                  Text(
                    'Empresas de referencia',
                    style: textTheme.titleSmall?.copyWith(
                      color: _ink,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 10),
                  _ResponsiveFields(
                    children: [
                      _MultilineReferenceField(
                        controller: currentClientsController,
                        label: 'Clientes actuales',
                        hint: 'Hasta 5, uno por línea.',
                      ),
                      _MultilineReferenceField(
                        controller: idealClientsController,
                        label:
                            'Clientes ideales / empresas parecidas a las que quieres encontrar',
                        hint: 'Hasta 5, uno por línea.',
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  _ResponsiveFields(
                    children: [
                      _MultilineReferenceField(
                        controller: watchlistAccountsController,
                        label: 'Cuentas estratégicas a vigilar',
                        hint: 'Hasta 5 inicialmente, una por línea.',
                      ),
                      _MultilineReferenceField(
                        controller: competitorsController,
                        label: 'Competidores',
                        hint: 'Indica si quieres excluirlos o monitorizarlos.',
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: excludedCompaniesController,
                    minLines: 2,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      labelText:
                          'Empresas que no quieres recibir como oportunidades',
                      hintText:
                          'Clientes protegidos, cuentas ya trabajadas, empresas excluidas...',
                      alignLabelWithHint: true,
                      prefixIcon: Icon(Icons.block_outlined),
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: noBuyReasonController,
                    minLines: 3,
                    maxLines: 6,
                    decoration: const InputDecoration(
                      labelText:
                          '¿Por qué una empresa aparentemente ideal NO os compraría?',
                      hintText:
                          'Decisión centralizada en otro país, consumo insuficiente, tecnología incompatible, ticket demasiado pequeño...',
                      alignLabelWithHint: true,
                      prefixIcon: Icon(Icons.report_problem_outlined),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _FormSection(
                title: '5 · Tipo de investigación y seguimiento',
                children: [
                  _MultiSelectChipGroup(
                    title:
                        'Selecciona el tipo de servicio que mejor encaja con tu necesidad',
                    options: _serviceTypeOptions,
                    selectedValues: serviceTypes,
                    isEnabled: !isSubmitting,
                    onChanged: (label, selected) {
                      onToggleOption(serviceTypes, label, selected);
                    },
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: serviceCommentsController,
                    minLines: 2,
                    maxLines: 5,
                    decoration: const InputDecoration(
                      labelText:
                          'Comentarios sobre frecuencia, fechas o alcance',
                      alignLabelWithHint: true,
                      prefixIcon: Icon(Icons.event_note_outlined),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              _PrivacyConsent(
                privacyAccepted: privacyAccepted,
                marketingConsent: marketingConsent,
                errorText: privacyError,
                onPrivacyChanged: isSubmitting ? null : onPrivacyChanged,
                onMarketingChanged: isSubmitting ? null : onMarketingChanged,
              ),
              const SizedBox(height: 22),
              FilledButton.icon(
                onPressed: isSubmitting ? null : onSubmit,
                icon: isSubmitting
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.send_outlined),
                label: Text(isSubmitting ? 'Enviando...' : 'Enviar solicitud'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static String? _required(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Campo obligatorio.';
    }
    return null;
  }

  static String? _emailValidator(String? value) {
    final trimmed = value?.trim() ?? '';
    if (trimmed.isEmpty) {
      return 'Campo obligatorio.';
    }
    final emailPattern = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
    if (!emailPattern.hasMatch(trimmed)) {
      return 'Introduce un email válido.';
    }
    return null;
  }
}

class _FormSection extends StatelessWidget {
  const _FormSection({
    required this.title,
    required this.children,
    this.initiallyExpanded = false,
  });

  final String title;
  final List<Widget> children;
  final bool initiallyExpanded;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border.all(color: _line),
        borderRadius: BorderRadius.circular(8),
      ),
      child: ExpansionTile(
        initiallyExpanded: initiallyExpanded,
        maintainState: true,
        tilePadding: const EdgeInsets.symmetric(horizontal: 14),
        childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        collapsedShape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
        ),
        title: Text(
          title,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
            color: _ink,
            fontWeight: FontWeight.w800,
          ),
        ),
        children: children,
      ),
    );
  }
}

class _MultiSelectChipGroup extends StatelessWidget {
  const _MultiSelectChipGroup({
    required this.title,
    required this.options,
    required this.selectedValues,
    required this.isEnabled,
    required this.onChanged,
    this.helperText,
  });

  final String title;
  final String? helperText;
  final List<String> options;
  final Set<String> selectedValues;
  final bool isEnabled;
  final void Function(String label, bool selected) onChanged;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: textTheme.titleSmall?.copyWith(
            color: _ink,
            fontWeight: FontWeight.w800,
          ),
        ),
        if (helperText != null) ...[
          const SizedBox(height: 4),
          Text(
            helperText!,
            style: textTheme.bodySmall?.copyWith(color: _steel, height: 1.35),
          ),
        ],
        const SizedBox(height: 10),
        LayoutBuilder(
          builder: (context, constraints) {
            final labelMaxWidth =
                (constraints.maxWidth < 520 ? constraints.maxWidth - 36 : 380.0)
                    .clamp(180.0, 380.0)
                    .toDouble();

            return Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final option in options)
                  FilterChip(
                    label: ConstrainedBox(
                      constraints: BoxConstraints(maxWidth: labelMaxWidth),
                      child: Text(option),
                    ),
                    selected: selectedValues.contains(option),
                    onSelected: isEnabled
                        ? (selected) => onChanged(option, selected)
                        : null,
                    selectedColor: const Color(0xFFDDF7FB),
                    checkmarkColor: _blue,
                    side: const BorderSide(color: _line),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
              ],
            );
          },
        ),
      ],
    );
  }
}

class _SingleSelectChipGroup extends StatelessWidget {
  const _SingleSelectChipGroup({
    required this.title,
    required this.options,
    required this.selectedValue,
    required this.isEnabled,
    required this.onChanged,
    this.helperText,
  });

  final String title;
  final String? helperText;
  final List<String> options;
  final String? selectedValue;
  final bool isEnabled;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: textTheme.titleSmall?.copyWith(
            color: _ink,
            fontWeight: FontWeight.w800,
          ),
        ),
        if (helperText != null) ...[
          const SizedBox(height: 4),
          Text(
            helperText!,
            style: textTheme.bodySmall?.copyWith(color: _steel, height: 1.35),
          ),
        ],
        const SizedBox(height: 10),
        LayoutBuilder(
          builder: (context, constraints) {
            final labelMaxWidth =
                (constraints.maxWidth < 520 ? constraints.maxWidth - 36 : 380.0)
                    .clamp(180.0, 380.0)
                    .toDouble();

            return Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final option in options)
                  ChoiceChip(
                    label: ConstrainedBox(
                      constraints: BoxConstraints(maxWidth: labelMaxWidth),
                      child: Text(option),
                    ),
                    selected: selectedValue == option,
                    onSelected: isEnabled
                        ? (selected) => onChanged(selected ? option : null)
                        : null,
                    selectedColor: const Color(0xFFDDF7FB),
                    checkmarkColor: _blue,
                    side: const BorderSide(color: _line),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
              ],
            );
          },
        ),
      ],
    );
  }
}

class _OtherField extends StatelessWidget {
  const _OtherField({
    required this.controller,
    required this.label,
    this.isRequired = false,
  });

  final TextEditingController controller;
  final String label;
  final bool isRequired;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      decoration: InputDecoration(
        labelText: label,
        hintText: 'Puedes separar varios valores con comas',
        prefixIcon: const Icon(Icons.edit_outlined),
      ),
      textInputAction: TextInputAction.next,
      validator: isRequired
          ? (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Campo obligatorio.';
              }
              return null;
            }
          : null,
    );
  }
}

class _MultilineReferenceField extends StatelessWidget {
  const _MultilineReferenceField({
    required this.controller,
    required this.label,
    required this.hint,
  });

  final TextEditingController controller;
  final String label;
  final String hint;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      minLines: 3,
      maxLines: 5,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        alignLabelWithHint: true,
        prefixIcon: const Icon(Icons.domain_outlined),
      ),
    );
  }
}

class _ResponsiveFields extends StatelessWidget {
  const _ResponsiveFields({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < 620) {
          return Column(
            children: [
              for (var index = 0; index < children.length; index++) ...[
                if (index > 0) const SizedBox(height: 14),
                children[index],
              ],
            ],
          );
        }

        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (var index = 0; index < children.length; index++) ...[
              if (index > 0) const SizedBox(width: 14),
              Expanded(child: children[index]),
            ],
          ],
        );
      },
    );
  }
}

class _PrivacyConsent extends StatelessWidget {
  const _PrivacyConsent({
    required this.privacyAccepted,
    required this.marketingConsent,
    required this.errorText,
    required this.onPrivacyChanged,
    required this.onMarketingChanged,
  });

  final bool privacyAccepted;
  final bool marketingConsent;
  final String? errorText;
  final ValueChanged<bool?>? onPrivacyChanged;
  final ValueChanged<bool?>? onMarketingChanged;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        CheckboxListTile(
          value: privacyAccepted,
          onChanged: onPrivacyChanged,
          controlAffinity: ListTileControlAffinity.leading,
          dense: true,
          contentPadding: EdgeInsets.zero,
          title: Text(
            'He leído y acepto la política de privacidad. *',
            style: textTheme.bodySmall?.copyWith(color: _steel, height: 1.45),
          ),
        ),
        if (errorText != null)
          Padding(
            padding: const EdgeInsets.only(left: 52, bottom: 4),
            child: Text(
              errorText!,
              style: textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.error,
              ),
            ),
          ),
        CheckboxListTile(
          value: marketingConsent,
          onChanged: onMarketingChanged,
          controlAffinity: ListTileControlAffinity.leading,
          dense: true,
          contentPadding: EdgeInsets.zero,
          title: Text(
            'Acepto recibir comunicaciones relacionadas con InduRadar.',
            style: textTheme.bodySmall?.copyWith(color: _steel, height: 1.45),
          ),
        ),
      ],
    );
  }
}

class _SuccessBanner extends StatelessWidget {
  const _SuccessBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFFEAF7F1),
        border: Border.all(color: const Color(0xFFB8DDCC)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.check_circle_outline, color: _success, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                message,
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(color: _ink, height: 1.4),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class LeadSubmissionService {
  const LeadSubmissionService({
    String endpoint = _leadEndpoint,
    String authToken = _leadEndpointAuthToken,
    http.Client? client,
  }) : _endpoint = endpoint,
       _authToken = authToken,
       _client = client;

  final String _endpoint;
  final String _authToken;
  final http.Client? _client;

  Future<void> submit(LeadRequest request) async {
    final endpoint = _endpoint.trim();
    if (endpoint.isEmpty) {
      throw const LeadSubmissionException(
        'Falta configurar el endpoint de recepción del formulario.',
      );
    }

    final uri = Uri.tryParse(endpoint);
    if (uri == null || !uri.hasScheme || uri.host.isEmpty) {
      throw const LeadSubmissionException(
        'El endpoint configurado para el formulario no es válido.',
      );
    }

    final headers = <String, String>{
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    final authToken = _authToken.trim();
    if (authToken.isNotEmpty) {
      headers['Authorization'] = 'Bearer $authToken';
    }

    final body = jsonEncode(request.toJson());
    final response =
        await (_client == null
                ? http.post(uri, headers: headers, body: body)
                : _client.post(uri, headers: headers, body: body))
            .timeout(const Duration(seconds: 20));

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw LeadSubmissionException(
        'El servidor ha rechazado la solicitud (${response.statusCode}).',
      );
    }
  }
}

class LeadSubmissionException implements Exception {
  const LeadSubmissionException(this.message);

  final String message;

  @override
  String toString() => message;
}

class LeadRequest {
  const LeadRequest({
    required this.firstName,
    required this.lastName,
    required this.company,
    required this.jobTitle,
    required this.email,
    required this.phone,
    required this.website,
    required this.cityProvince,
    required this.offerDescription,
    required this.offerCategories,
    required this.problemsSolved,
    required this.prioritySolutions,
    required this.targetSectors,
    required this.targetCompanyTypes,
    required this.geographyCountries,
    required this.geographyRegions,
    required this.geographyProvinces,
    required this.geographyFreeZone,
    required this.targetRevenueRange,
    required this.targetEmployeeRange,
    required this.minimumOpportunityValue,
    required this.targetCompanyDescription,
    required this.investmentSignals,
    required this.innovationSignals,
    required this.growthSignals,
    required this.publicFinanceSignals,
    required this.commercialNeeds,
    required this.opportunityTriggerDescription,
    required this.recentCaseDescription,
    required this.currentClients,
    required this.idealClients,
    required this.watchlistAccounts,
    required this.competitors,
    required this.excludedCompanies,
    required this.noBuyReason,
    required this.serviceTypes,
    required this.serviceComments,
    required this.privacyAccepted,
    required this.marketingConsent,
    required this.submittedAt,
  });

  final String firstName;
  final String lastName;
  final String company;
  final String jobTitle;
  final String email;
  final String phone;
  final String website;
  final String cityProvince;
  final String offerDescription;
  final List<String> offerCategories;
  final List<String> problemsSolved;
  final String prioritySolutions;
  final List<String> targetSectors;
  final List<String> targetCompanyTypes;
  final List<String> geographyCountries;
  final List<String> geographyRegions;
  final List<String> geographyProvinces;
  final String geographyFreeZone;
  final String? targetRevenueRange;
  final String? targetEmployeeRange;
  final String? minimumOpportunityValue;
  final String targetCompanyDescription;
  final List<String> investmentSignals;
  final List<String> innovationSignals;
  final List<String> growthSignals;
  final List<String> publicFinanceSignals;
  final List<String> commercialNeeds;
  final String opportunityTriggerDescription;
  final String recentCaseDescription;
  final List<String> currentClients;
  final List<String> idealClients;
  final List<String> watchlistAccounts;
  final List<String> competitors;
  final List<String> excludedCompanies;
  final String noBuyReason;
  final List<String> serviceTypes;
  final String serviceComments;
  final bool privacyAccepted;
  final bool marketingConsent;
  final DateTime submittedAt;

  Map<String, Object?> toJson() {
    final fullName = [
      firstName,
      lastName,
    ].where((part) => part.isNotEmpty).join(' ');
    final signalTypes = [
      ...investmentSignals,
      ...innovationSignals,
      ...growthSignals,
      ...publicFinanceSignals,
    ];

    return {
      'source': 'induradar_landing',
      'form_version': 'cliente_v3',
      'channel': 'web_form',
      'submitted_at': submittedAt.toIso8601String(),
      'first_name': firstName,
      'last_name': lastName,
      'full_name': fullName,
      'company': company,
      'job_title': jobTitle,
      'email': email,
      'phone': phone,
      'website': website,
      'city_province': cityProvince,
      'offer_description': offerDescription,
      'offer': offerDescription,
      'offer_categories': offerCategories,
      'problems_solved': problemsSolved,
      'priority_solutions': prioritySolutions,
      'target_sectors': targetSectors,
      'target_company_types': targetCompanyTypes,
      'geography_countries': geographyCountries,
      'geography_regions': geographyRegions,
      'geography_provinces': geographyProvinces,
      'geography_free_zone': geographyFreeZone,
      'target_revenue_range': targetRevenueRange,
      'target_employee_range': targetEmployeeRange,
      'minimum_opportunity_value': minimumOpportunityValue,
      'target_company_description': targetCompanyDescription,
      'investment_capacity_signals': investmentSignals,
      'innovation_product_signals': innovationSignals,
      'organization_growth_signals': growthSignals,
      'public_finance_signals': publicFinanceSignals,
      'signal_types': signalTypes,
      'commercial_needs': commercialNeeds,
      'probable_needs': commercialNeeds,
      'opportunity_trigger_description': opportunityTriggerDescription,
      'recent_case_description': recentCaseDescription,
      'current_clients': currentClients,
      'ideal_clients': idealClients,
      'watchlist_accounts': watchlistAccounts,
      'competitors': competitors,
      'excluded_companies': excludedCompanies,
      'no_buy_reason': noBuyReason,
      'service_types': serviceTypes,
      'service_comments': serviceComments,
      'privacy_accepted': privacyAccepted,
      'marketing_consent': marketingConsent,
    };
  }
}

const _otherOfferCategoryOption = 'Otra';
const _otherProblemOption = 'Otro';
const _otherSectorOption = 'Otros';
const _otherTargetCompanyTypeOption = 'Otro';
const _otherMinimumValueOption = 'Otro';
const _otherNeedOption = 'Otra';

const _offerCategoryOptions = [
  'Maquinaria y equipos industriales',
  'Componentes, repuestos y suministros',
  'Productos químicos, materiales y consumibles',
  'Packaging, envases y embalajes',
  'Tecnología, automatización y software',
  'Energía, utilities y sostenibilidad',
  'Ingeniería, mantenimiento y servicios industriales',
  'Logística, intralogística e instalaciones',
  'Calidad, laboratorio, certificación y seguridad',
  'Servicios profesionales / consultoría',
  _otherOfferCategoryOption,
];

const _problemOptions = [
  'Reducir costes',
  'Aumentar productividad o capacidad',
  'Mejorar calidad',
  'Reducir consumos de energía, agua o materias primas',
  'Resolver problemas técnicos o de proceso',
  'Cumplir normativa o requisitos de clientes',
  'Mejorar seguridad o fiabilidad',
  'Reducir mermas, residuos o emisiones',
  'Sustituir productos, materiales o proveedores',
  'Mejorar trazabilidad, control o digitalización',
  'Mejorar prestaciones, acabado o vida útil',
  _otherProblemOption,
];

const _targetSectorOptions = [
  'Alimentación y bebidas',
  'Química y petroquímica',
  'Farmacéutica, biotecnología y cosmética',
  'Cerámica, vidrio y materiales de construcción',
  'Automoción y movilidad',
  'Metal, mecanizado y transformación metálica',
  'Maquinaria y bienes de equipo',
  'Plástico, caucho y materiales compuestos',
  'Papel, cartón, impresión y packaging',
  'Textil, calzado y cuero',
  'Madera y mueble',
  'Electrónica y material eléctrico',
  'Energía y utilities',
  'Agua, medioambiente y residuos',
  'Logística, almacenamiento y distribución',
  'Minería, cemento y minerales',
  'Aeroespacial, ferroviario y naval',
  'Construcción e infraestructuras',
  _otherSectorOption,
];

const _targetCompanyTypeOptions = [
  'Fabricante industrial o planta productiva',
  'Fabricante de maquinaria / OEM',
  'Ingeniería, integrador o EPC',
  'Fabricante de componentes',
  'Proveedor tecnológico',
  'Distribuidor o suministrador industrial',
  'Mantenimiento o servicios industriales',
  'Operador logístico',
  'Constructora / infraestructuras',
  'Consultora',
  'Inversor, fondo o grupo empresarial',
  'Administración u organismo público',
  'Centro tecnológico o de investigación',
  _otherTargetCompanyTypeOption,
];

const _revenueRangeOptions = [
  'Indiferente',
  '< 2 M€',
  '2-10 M€',
  '10-50 M€',
  '50-250 M€',
  '> 250 M€',
];

const _employeeRangeOptions = [
  'Indiferente',
  '< 20 empleados',
  '20-100 empleados',
  '101-500 empleados',
  '> 500 empleados',
];

const _minimumOpportunityValueOptions = [
  'Cualquier importe',
  '> 5.000 €',
  '> 10.000 €',
  '> 25.000 €',
  '> 50.000 €',
  '> 100.000 €',
  _otherMinimumValueOption,
];

const _investmentSignalOptions = [
  'Nueva fábrica, planta, nave o centro',
  'Ampliación de instalaciones',
  'Nueva línea de producción',
  'Aumento de capacidad',
  'Compra o renovación de maquinaria/equipos',
  'Modernización de instalaciones',
  'Nueva instalación logística o almacén',
  'Inversión industrial anunciada',
  'Financiación obtenida para inversión',
  'Permiso, licencia o evaluación ambiental',
];

const _innovationSignalOptions = [
  'Nuevo producto o gama',
  'Nuevo diseño, formato o aplicación',
  'Nuevo proceso productivo',
  'Patente o desarrollo tecnológico relevante',
  'Proyecto I+D+i',
  'Proyecto piloto o demostrador',
  'Presentación o lanzamiento en feria',
  'Contratación de perfiles de I+D / ingeniería',
];

const _growthSignalOptions = [
  'Nuevo directivo o responsable',
  'Crecimiento significativo de plantilla',
  'Nueva filial, sede o presencia territorial',
  'Expansión geográfica / internacional',
  'Fusión',
  'Adquisición',
  'Cambio de propiedad',
  'Nueva alianza o acuerdo estratégico',
  'Nuevo contrato o cliente relevante',
];

const _publicFinanceSignalOptions = [
  'Subvención o ayuda concedida',
  'Licitación o concurso',
  'Adjudicación',
  'Contrato público',
  'Incentivo fiscal o financiación pública relevante',
];

const _commercialNeedOptions = [
  'Problemas de calidad, rechazo o mermas',
  'Problemas de capacidad o productividad',
  'Paradas, averías o problemas de fiabilidad',
  'Obsolescencia de maquinaria, productos o procesos',
  'Cambio o búsqueda de proveedor',
  'Problemas o falta de suministro',
  'Cambio de materias primas, materiales o formulaciones',
  'Necesidad de reducir costes',
  'Necesidad de reducir consumo energético',
  'Necesidad de reducir agua, residuos o emisiones',
  'Nuevas exigencias normativas',
  'Nuevas exigencias de clientes o certificaciones',
  'Necesidad de mejorar seguridad',
  'Necesidad de digitalización o trazabilidad',
  'Necesidad de aumentar capacidad',
  _otherNeedOption,
];

const _serviceTypeOptions = [
  'Estudio puntual',
  'Resumen / informe semanal',
  'Informe mensual',
  'Informe trimestral',
  'Vigilancia continua de cuentas concretas',
  'Vigilancia de un sector',
  'Vigilancia de una zona geográfica',
  'Monitorización de proyectos concretos',
  'Alertas prioritarias ante cambios relevantes',
];
