import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';

import 'demo_report_downloader.dart';
import 'pricing.dart';

const _leadEndpoint = String.fromEnvironment('LEAD_ENDPOINT');
const _privacyPolicyUrl = String.fromEnvironment(
  'PRIVACY_POLICY_URL',
  defaultValue: 'https://induradar.com/privacidad',
);

const _logoAsset = 'assets/InduRadarLogoVertical.png';
const _demoReportAsset =
    'assets/assets/InduRadar_Informe_Demo_Anonimizado_Flexografia.pdf';
const _demoReportFileName =
    'InduRadar_Informe_Demo_Anonimizado_Flexografia.pdf';
const _webFormVersion = '3.13.1';
const _dataContractVersion = '1.3.2';
const _executionContractVersion = '1.12.3';
const _stackConfiguration = <String, Object>{
  'config_name': 'InduRadar Q0-STACK and runtime defaults',
  'config_version': '3.13.1',
  'effective_date': '2026-09-02',
  'expected_versions': <String, String>{
    'workflow_version': '3.13.1',
    'contract_version': '1.3.2',
    'execution_contract_version': '1.12.3',
    'heuristics_version': '1.11.3',
    'tool_registry_version': '1.10.3',
    'golden_test_version': '1.12.3',
    'data_dictionary_version': '1.10.3',
    'document_manifest_version': '1.11.3',
    'report_template_version': '1.10.3',
    'example_request_version': '1.3.2',
    'source_catalog_version': '2.6.1',
  },
  'runtime_defaults': <String, Object>{
    'baseline_mode': 'canonical_fresh',
    'canonical_output': 'report_json_lossless',
    'client_default_output': 'light_report',
    'artifact_default': <String>[],
    'artifacts_explicit_only': <String>['docx', 'xlsx', 'pdf'],
    'docx_render_mode': 'complete_inventory_with_controlled_synthesis',
    'docx_render_manifest_required': true,
    'renderer_may_omit_inventory_items': false,
    'client_completeness_review_allowed': false,
  },
};
const _ink = Color(0xFF102335);
const _blue = Color(0xFF075A8F);
const _cyan = Color(0xFF18BFD7);
const _steel = Color(0xFF66717C);
const _line = Color(0xFFD8E4EA);
const _surface = Color(0xFFF4F8FA);
const _success = Color(0xFF1D7A57);

enum LeadSubmissionState { idle, submitting, success, error }

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
          floatingLabelBehavior: FloatingLabelBehavior.always,
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
  const LandingPage({
    super.key,
    LeadSubmissionService? submissionService,
    PricingCatalog? pricingCatalog,
  }) : _submissionService = submissionService,
       _initialPricingCatalog = pricingCatalog;

  final LeadSubmissionService? _submissionService;
  final PricingCatalog? _initialPricingCatalog;

  @override
  State<LandingPage> createState() => _LandingPageState();
}

class _LandingPageState extends State<LandingPage> {
  final _formKey = GlobalKey<FormState>();
  final _formAnchorKey = GlobalKey();
  final _scrollController = ScrollController();

  final _fullNameController = TextEditingController();
  final _companyController = TextEditingController();
  final _jobTitleController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _websiteController = TextEditingController();
  final _addressController = TextEditingController();
  final _offerDescriptionController = TextEditingController();
  final _otherOfferCategoryController = TextEditingController();
  final _otherProblemController = TextEditingController();
  final _prioritySolutionsController = TextEditingController();
  final _otherSectorController = TextEditingController();
  final _otherTargetCompanyTypeController = TextEditingController();
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
  final Set<String> _geographyCountries = <String>{};
  final Set<String> _spanishProvinces = <String>{};
  final Set<String> _investmentSignals = <String>{..._investmentSignalOptions};
  final Set<String> _innovationSignals = <String>{..._innovationSignalOptions};
  final Set<String> _growthSignals = <String>{..._growthSignalOptions};
  final Set<String> _publicFinanceSignals = <String>{
    ..._publicFinanceSignalOptions,
  };
  final Set<String> _commercialNeeds = _commercialNeedOptions
      .where((option) => option != _otherNeedOption)
      .toSet();
  final Set<String> _serviceTypes = <String>{};
  final List<GlobalKey> _sectionHeaderKeys = List<GlobalKey>.generate(
    5,
    (_) => GlobalKey(),
  );

  String? _targetRevenueRange;
  String? _targetEmployeeRange;
  String? _minimumOpportunityValue;
  String? _spainCoverage;
  int _expandedSectionIndex = -1;
  bool _privacyAccepted = false;
  bool _marketingConsent = false;
  bool _isResettingForm = false;
  LeadSubmissionState _submissionState = LeadSubmissionState.idle;
  PricingCatalog? _pricingCatalog;
  bool _pricingLoadFailed = false;
  String? _privacyError;
  String? _successMessage;
  String? _submissionError;
  int _sectionScrollRequest = 0;
  bool _showSelectionErrors = false;

  bool get _isSubmitting => _submissionState == LeadSubmissionState.submitting;

  bool get _submissionSucceeded =>
      _submissionState == LeadSubmissionState.success;

  @override
  void initState() {
    super.initState();
    _pricingCatalog = widget._initialPricingCatalog;
    if (_pricingCatalog == null) {
      unawaited(_loadPricingCatalog());
    }
    for (final controller in [
      _offerDescriptionController,
      _fullNameController,
      _companyController,
      _emailController,
      _otherOfferCategoryController,
      _otherProblemController,
      _otherSectorController,
      _otherTargetCompanyTypeController,
      _otherMinimumValueController,
      _otherNeedController,
      _opportunityTriggerController,
      _currentClientsController,
      _idealClientsController,
      _watchlistAccountsController,
      _competitorsController,
      _excludedCompaniesController,
    ]) {
      controller.addListener(_refreshFormProgress);
    }
  }

  @override
  void dispose() {
    for (final controller in [
      _fullNameController,
      _companyController,
      _jobTitleController,
      _emailController,
      _phoneController,
      _websiteController,
      _addressController,
      _offerDescriptionController,
      _otherOfferCategoryController,
      _otherProblemController,
      _prioritySolutionsController,
      _otherSectorController,
      _otherTargetCompanyTypeController,
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
    _scrollController.dispose();
    super.dispose();
  }

  void _refreshFormProgress() {
    if (mounted && !_isResettingForm) {
      setState(() {});
    }
  }

  Future<void> _loadPricingCatalog() async {
    try {
      final source = await rootBundle.loadString(PricingCatalog.assetPath);
      final catalog = PricingCatalog.fromJsonString(source);
      if (!mounted) {
        return;
      }
      setState(() {
        _pricingCatalog = catalog;
        _pricingLoadFailed = false;
      });
    } catch (error) {
      _logLeadDebug('Pricing catalog error: ${error.runtimeType}');
      if (!mounted) {
        return;
      }
      setState(() {
        _pricingCatalog = null;
        _pricingLoadFailed = true;
      });
    }
  }

  PricingQuote? _currentPricingQuote() {
    final catalog = _pricingCatalog;
    if (catalog == null) {
      return null;
    }
    return catalog.quote(
      sectorCount: _selectedValuesWithOther(
        _targetSectors,
        _otherSectorController.text,
        otherOption: _otherSectorOption,
      ).toSet().length,
      provinceCount: _pricingProvinceCount(catalog),
      serviceTypes: _serviceTypes,
    );
  }

  int _pricingProvinceCount(PricingCatalog catalog) {
    if (!_geographyCountries.contains(_spainCountry)) {
      return 0;
    }
    if (_spainCoverage == _spainAll) {
      return catalog.spainProvinceCount;
    }
    if (_spainCoverage == _spainByProvince) {
      return _spanishProvinces.length;
    }
    return 0;
  }

  Future<void> _submit() async {
    if (_isSubmitting || _submissionSucceeded) {
      return;
    }

    setState(() {
      _showSelectionErrors = true;
      _privacyError = _privacyAccepted
          ? null
          : 'Necesitamos tu consentimiento para responderte.';
      _successMessage = null;
      _submissionError = null;
      _submissionState = LeadSubmissionState.idle;
    });

    final isFormValid = _formKey.currentState?.validate() ?? false;
    final hasRequiredSelections =
        _offerCategories.isNotEmpty &&
        _targetSectors.isNotEmpty &&
        _targetCompanyTypes.isNotEmpty;
    if (!isFormValid || !hasRequiredSelections || _privacyError != null) {
      setState(() {
        _expandedSectionIndex = _firstInvalidSectionIndex();
      });
    }
    if (!isFormValid || !hasRequiredSelections || _privacyError != null) {
      return;
    }

    final pricingQuote = _currentPricingQuote();
    if (pricingQuote == null) {
      setState(() {
        _submissionState = LeadSubmissionState.error;
        _submissionError =
            'No hemos podido calcular el coste de la solicitud. Recarga la página e inténtalo de nuevo.';
      });
      return;
    }

    setState(() {
      _submissionState = LeadSubmissionState.submitting;
    });

    final request = LeadRequest(
      fullName: _fullNameController.text.trim(),
      company: _companyController.text.trim(),
      jobTitle: _jobTitleController.text.trim(),
      email: _emailController.text.trim(),
      phone: _phoneController.text.trim(),
      website: _websiteController.text.trim(),
      address: _addressController.text.trim(),
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
      geographyCountries: _geographyCountries.toList(growable: false),
      spainCoverage: _spainCoverage,
      geographyProvinces: _spainCoverage == _spainByProvince
          ? _spanishProvinces.toList(growable: false)
          : const <String>[],
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
      pricingQuote: pricingQuote,
    );

    try {
      await _submissionService.submit(request);
      if (!mounted) {
        return;
      }
      _markSubmissionSuccessful();
    } on LeadSubmissionException catch (error) {
      if (!mounted) {
        return;
      }
      _logLeadDebug(error.technicalDetail ?? error.message);
      setState(() {
        _submissionState = LeadSubmissionState.error;
        _submissionError = error.message;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      _logLeadDebug('Unhandled lead submission error: ${error.runtimeType}');
      setState(() {
        _submissionState = LeadSubmissionState.error;
        _submissionError =
            'No hemos podido enviar la solicitud. Inténtalo de nuevo en unos minutos.';
      });
    }
  }

  void _markSubmissionSuccessful() {
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() {
      _submissionError = null;
      _successMessage =
          'Solicitud recibida correctamente. Hemos recibido tu solicitud y comenzaremos a revisarla.';
      _submissionState = LeadSubmissionState.success;
    });
  }

  void _startNewRequest() {
    _isResettingForm = true;
    _formKey.currentState?.reset();
    for (final controller in [
      _fullNameController,
      _companyController,
      _jobTitleController,
      _emailController,
      _phoneController,
      _websiteController,
      _addressController,
      _offerDescriptionController,
      _otherOfferCategoryController,
      _otherProblemController,
      _prioritySolutionsController,
      _otherSectorController,
      _otherTargetCompanyTypeController,
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
      controller.clear();
    }

    setState(() {
      for (final values in [
        _offerCategories,
        _problemsSolved,
        _targetSectors,
        _targetCompanyTypes,
        _geographyCountries,
        _spanishProvinces,
        _investmentSignals,
        _innovationSignals,
        _growthSignals,
        _publicFinanceSignals,
        _commercialNeeds,
        _serviceTypes,
      ]) {
        values.clear();
      }
      _investmentSignals.addAll(_investmentSignalOptions);
      _innovationSignals.addAll(_innovationSignalOptions);
      _growthSignals.addAll(_growthSignalOptions);
      _publicFinanceSignals.addAll(_publicFinanceSignalOptions);
      _commercialNeeds.addAll(
        _commercialNeedOptions.where((option) => option != _otherNeedOption),
      );
      _targetRevenueRange = null;
      _targetEmployeeRange = null;
      _minimumOpportunityValue = null;
      _spainCoverage = null;
      _expandedSectionIndex = -1;
      _privacyAccepted = false;
      _marketingConsent = false;
      _privacyError = null;
      _submissionError = null;
      _successMessage = null;
      _submissionState = LeadSubmissionState.idle;
      _showSelectionErrors = false;
    });
    _isResettingForm = false;
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
  }

  int _firstInvalidSectionIndex() {
    final email = _emailController.text.trim();
    if (_offerDescriptionController.text.trim().isEmpty ||
        _fullNameController.text.trim().isEmpty ||
        _companyController.text.trim().isEmpty ||
        !RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email) ||
        _offerCategories.isEmpty ||
        (_offerCategories.contains(_otherOfferCategoryOption) &&
            _otherOfferCategoryController.text.trim().isEmpty) ||
        (_problemsSolved.contains(_otherProblemOption) &&
            _otherProblemController.text.trim().isEmpty)) {
      return 0;
    }

    if (_targetSectors.isEmpty ||
        _targetCompanyTypes.isEmpty ||
        _geographyCountries.isEmpty ||
        (_geographyCountries.contains(_spainCountry) &&
            _spainCoverage == null) ||
        (_spainCoverage == _spainByProvince && _spanishProvinces.isEmpty) ||
        (_targetSectors.contains(_otherSectorOption) &&
            _otherSectorController.text.trim().isEmpty) ||
        (_targetCompanyTypes.contains(_otherTargetCompanyTypeOption) &&
            _otherTargetCompanyTypeController.text.trim().isEmpty) ||
        (_minimumOpportunityValue == _otherMinimumValueOption &&
            _otherMinimumValueController.text.trim().isEmpty)) {
      return 1;
    }

    if ((_commercialNeeds.contains(_otherNeedOption) &&
            _otherNeedController.text.trim().isEmpty) ||
        _opportunityTriggerController.text.trim().isEmpty) {
      return 3;
    }

    if (!_privacyAccepted) {
      return 4;
    }

    return 0;
  }

  bool _isSectionComplete(int index) {
    final email = _emailController.text.trim();

    switch (index) {
      case 0:
        return _offerDescriptionController.text.trim().isNotEmpty &&
            _fullNameController.text.trim().isNotEmpty &&
            _companyController.text.trim().isNotEmpty &&
            RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email) &&
            _offerCategories.isNotEmpty &&
            (!_offerCategories.contains(_otherOfferCategoryOption) ||
                _otherOfferCategoryController.text.trim().isNotEmpty) &&
            (!_problemsSolved.contains(_otherProblemOption) ||
                _otherProblemController.text.trim().isNotEmpty);
      case 1:
        return _targetSectors.isNotEmpty &&
            _targetCompanyTypes.isNotEmpty &&
            _geographyCountries.isNotEmpty &&
            (!_geographyCountries.contains(_spainCountry) ||
                _spainCoverage != null) &&
            (_spainCoverage != _spainByProvince ||
                _spanishProvinces.isNotEmpty) &&
            (!_targetSectors.contains(_otherSectorOption) ||
                _otherSectorController.text.trim().isNotEmpty) &&
            (!_targetCompanyTypes.contains(_otherTargetCompanyTypeOption) ||
                _otherTargetCompanyTypeController.text.trim().isNotEmpty) &&
            (_minimumOpportunityValue != _otherMinimumValueOption ||
                _otherMinimumValueController.text.trim().isNotEmpty);
      case 2:
        return _investmentSignals.isNotEmpty ||
            _innovationSignals.isNotEmpty ||
            _growthSignals.isNotEmpty ||
            _publicFinanceSignals.isNotEmpty;
      case 3:
        return _opportunityTriggerController.text.trim().isNotEmpty &&
            (!_commercialNeeds.contains(_otherNeedOption) ||
                _otherNeedController.text.trim().isNotEmpty);
      case 4:
        return _privacyAccepted;
      default:
        return false;
    }
  }

  Future<void> _scrollToForm() async {
    final formContext = _formAnchorKey.currentContext;
    if (formContext == null) {
      return;
    }
    await Scrollable.ensureVisible(
      formContext,
      duration: const Duration(milliseconds: 450),
      curve: Curves.easeOutCubic,
      alignment: 0.04,
    );
  }

  Future<void> _openPrivacyPolicy() async {
    final launched = await launchUrl(
      Uri.parse(_privacyPolicyUrl),
      mode: LaunchMode.externalApplication,
    );
    if (!launched && mounted) {
      _showError('No se ha podido abrir la Política de privacidad.');
    }
  }

  void _downloadDemoReport() {
    final started = downloadDemoReport(_demoReportAsset, _demoReportFileName);
    if (!started && mounted) {
      _showError(
        'La descarga del informe demo solo está disponible en la web.',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          controller: _scrollController,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _LandingBand(
                color: _surface,
                topPadding: 24,
                bottomPadding: 72,
                child: SizedBox(
                  width: double.infinity,
                  child: LayoutBuilder(
                    builder: (context, constraints) {
                      final isWide = constraints.maxWidth >= 940;
                      final form = KeyedSubtree(
                        key: _formAnchorKey,
                        child: _buildFormPanel(),
                      );

                      if (!isWide) {
                        return Column(
                          key: const ValueKey('landing-hero-narrow'),
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const _BrandHeader(),
                            const SizedBox(height: 46),
                            _LandingIntro(
                              onDemoReportPressed: _downloadDemoReport,
                            ),
                            const SizedBox(height: 36),
                            form,
                          ],
                        );
                      }

                      return Row(
                        key: const ValueKey('landing-hero-wide'),
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            flex: 7,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                const _BrandHeader(),
                                const SizedBox(height: 46),
                                _LandingIntro(
                                  onDemoReportPressed: _downloadDemoReport,
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 48),
                          Expanded(flex: 9, child: form),
                        ],
                      );
                    },
                  ),
                ),
              ),
              const _OpportunityExampleSection(),
              const _HowItWorksSection(),
              const _TrustSection(),
              _FinalCallToAction(onPressed: _scrollToForm),
              const _LandingFooter(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFormPanel() {
    return _LeadFormPanel(
      formKey: _formKey,
      fullNameController: _fullNameController,
      companyController: _companyController,
      jobTitleController: _jobTitleController,
      emailController: _emailController,
      phoneController: _phoneController,
      websiteController: _websiteController,
      addressController: _addressController,
      offerDescriptionController: _offerDescriptionController,
      otherOfferCategoryController: _otherOfferCategoryController,
      otherProblemController: _otherProblemController,
      prioritySolutionsController: _prioritySolutionsController,
      otherSectorController: _otherSectorController,
      otherTargetCompanyTypeController: _otherTargetCompanyTypeController,
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
      geographyCountries: _geographyCountries,
      spanishProvinces: _spanishProvinces,
      investmentSignals: _investmentSignals,
      innovationSignals: _innovationSignals,
      growthSignals: _growthSignals,
      publicFinanceSignals: _publicFinanceSignals,
      commercialNeeds: _commercialNeeds,
      serviceTypes: _serviceTypes,
      targetRevenueRange: _targetRevenueRange,
      targetEmployeeRange: _targetEmployeeRange,
      minimumOpportunityValue: _minimumOpportunityValue,
      spainCoverage: _spainCoverage,
      expandedSectionIndex: _expandedSectionIndex,
      sectionHeaderKeys: _sectionHeaderKeys,
      showSelectionErrors: _showSelectionErrors,
      completedSections: List<bool>.generate(5, _isSectionComplete),
      privacyAccepted: _privacyAccepted,
      marketingConsent: _marketingConsent,
      privacyError: _privacyError,
      successMessage: _successMessage,
      submissionError: _submissionError,
      isSubmitting: _isSubmitting,
      submissionSucceeded: _submissionSucceeded,
      pricingQuote: _currentPricingQuote(),
      pricingLoadFailed: _pricingLoadFailed,
      entryPilotPriceEur: _pricingCatalog?.entryPilotPriceEur,
      onToggleOption: _toggleOption,
      onRevenueChanged: (value) => setState(() => _targetRevenueRange = value),
      onEmployeeRangeChanged: (value) {
        setState(() => _targetEmployeeRange = value);
      },
      onMinimumValueChanged: (value) {
        setState(() => _minimumOpportunityValue = value);
      },
      onGeographyCountriesChanged: _setGeographyCountries,
      onSpainCoverageChanged: (value) {
        setState(() {
          _spainCoverage = value;
          if (value != _spainByProvince) {
            _spanishProvinces.clear();
          }
        });
      },
      onSpanishProvincesChanged: (values) {
        setState(() {
          _spanishProvinces
            ..clear()
            ..addAll(values);
        });
      },
      onSetAllSignals: _setAllSignals,
      onSetAllCommercialNeeds: _setAllCommercialNeeds,
      onSectionChanged: _openFormSection,
      onPrivacyChanged: _setPrivacyAccepted,
      onMarketingChanged: (value) {
        setState(() => _marketingConsent = value ?? false);
      },
      onPrivacyPolicyTap: _openPrivacyPolicy,
      onSubmit: _submit,
      onStartNewRequest: _startNewRequest,
    );
  }

  void _openFormSection(int index) {
    final scrollRequest = ++_sectionScrollRequest;
    final isClosing = _expandedSectionIndex == index;
    setState(() {
      _expandedSectionIndex = isClosing ? -1 : index;
    });
    if (isClosing) {
      FocusManager.instance.primaryFocus?.unfocus();
      return;
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && scrollRequest == _sectionScrollRequest) {
        unawaited(_scrollToSectionHeader(index, scrollRequest));
      }
    });
  }

  Future<void> _scrollToSectionHeader(int index, int scrollRequest) async {
    await Future<void>.delayed(const Duration(milliseconds: 240));
    if (!mounted || scrollRequest != _sectionScrollRequest) {
      return;
    }

    final sectionContext = _sectionHeaderKeys[index].currentContext;
    if (sectionContext == null || !sectionContext.mounted) {
      return;
    }

    final renderObject = sectionContext.findRenderObject();
    if (renderObject is! RenderBox || !_scrollController.hasClients) {
      return;
    }

    final viewportTop = MediaQuery.paddingOf(context).top + 16;
    final offsetDelta =
        renderObject.localToGlobal(Offset.zero).dy - viewportTop;
    final targetOffset = (_scrollController.offset + offsetDelta).clamp(
      0.0,
      _scrollController.position.maxScrollExtent,
    );

    await _scrollController.animateTo(
      targetOffset,
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
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

  void _setGeographyCountries(Set<String> values) {
    setState(() {
      final hadSpain = _geographyCountries.contains(_spainCountry);
      _geographyCountries
        ..clear()
        ..addAll(values);
      if (_geographyCountries.contains(_spainCountry) && !hadSpain) {
        _spainCoverage = _spainAll;
        _spanishProvinces.clear();
      } else if (!_geographyCountries.contains(_spainCountry)) {
        _spainCoverage = null;
        _spanishProvinces.clear();
      }
    });
  }

  void _setAllSignals(bool selected) {
    setState(() {
      for (final selection in [
        (_investmentSignals, _investmentSignalOptions),
        (_innovationSignals, _innovationSignalOptions),
        (_growthSignals, _growthSignalOptions),
        (_publicFinanceSignals, _publicFinanceSignalOptions),
      ]) {
        selection.$1.clear();
        if (selected) {
          selection.$1.addAll(selection.$2);
        }
      }
    });
  }

  void _setAllCommercialNeeds(bool selected) {
    setState(() {
      _commercialNeeds.clear();
      if (selected) {
        _commercialNeeds.addAll(
          _commercialNeedOptions.where((option) => option != _otherNeedOption),
        );
      }
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

class _LandingBand extends StatelessWidget {
  const _LandingBand({
    required this.child,
    required this.color,
    this.topPadding = 72,
    this.bottomPadding = 72,
  });

  final Widget child;
  final Color color;
  final double topPadding;
  final double bottomPadding;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: color,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final horizontalPadding = constraints.maxWidth >= 980 ? 40.0 : 20.0;
          return Padding(
            padding: EdgeInsets.fromLTRB(
              horizontalPadding,
              topPadding,
              horizontalPadding,
              bottomPadding,
            ),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 1200),
                child: child,
              ),
            ),
          );
        },
      ),
    );
  }
}

class _BrandHeader extends StatelessWidget {
  const _BrandHeader();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      key: const ValueKey('brand-header'),
      header: true,
      label: 'InduRadar, Industrial Opportunity Intelligence',
      child: SizedBox(
        width: double.infinity,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Image.asset(
              _logoAsset,
              key: const ValueKey('brand-logo'),
              width: 205,
              fit: BoxFit.contain,
              excludeFromSemantics: true,
            ),
            const SizedBox(height: 7),
            Text(
              'Industrial Opportunity Intelligence',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                color: _steel,
                fontWeight: FontWeight.w700,
                letterSpacing: 0,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LandingIntro extends StatelessWidget {
  const _LandingIntro({required this.onDemoReportPressed});

  final VoidCallback onDemoReportPressed;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          'Convierte cambios industriales en oportunidades comerciales',
          style: textTheme.displaySmall?.copyWith(
            color: _ink,
            fontSize: 44,
            height: 1.08,
            fontWeight: FontWeight.w800,
            letterSpacing: 0,
          ),
        ),
        const SizedBox(height: 22),
        Text(
          'Identificamos inversiones, ampliaciones, nuevas líneas, maquinaria, ayudas y otros cambios empresariales, y analizamos qué oportunidades comerciales pueden derivarse de ellos.',
          style: textTheme.titleMedium?.copyWith(
            color: _ink,
            height: 1.5,
            fontWeight: FontWeight.w600,
            letterSpacing: 0,
          ),
        ),
        const SizedBox(height: 14),
        Text(
          'Define qué vendes, qué empresas buscas y qué señales te interesan. InduRadar prioriza los resultados y conserva la evidencia que los respalda.',
          style: textTheme.bodyLarge?.copyWith(color: _steel, height: 1.55),
        ),
        const SizedBox(height: 24),
        _DemoReportCallout(onPressed: onDemoReportPressed),
        const SizedBox(height: 30),
        const _BenefitItem(
          icon: Icons.fact_check_outlined,
          title: 'Señales verificadas',
          text:
              'Inversiones, nuevas plantas, ampliaciones, maquinaria, ayudas y cambios empresariales.',
        ),
        const SizedBox(height: 18),
        const _BenefitItem(
          icon: Icons.filter_alt_outlined,
          title: 'Oportunidades priorizadas',
          text:
              'Qué proyecto existe, qué necesidad podría generar y para qué tipo de proveedor resulta relevante.',
        ),
        const SizedBox(height: 18),
        const _BenefitItem(
          icon: Icons.arrow_outward_outlined,
          title: 'Siguiente acción',
          text:
              'Fuentes, nivel de confianza y recomendación sobre qué validar o a quién abordar.',
        ),
        const SizedBox(height: 28),
        const Divider(color: _line),
        const SizedBox(height: 12),
        Text(
          'Fuentes corporativas · Administraciones · Registros · Ayudas · Medios sectoriales',
          style: textTheme.bodySmall?.copyWith(color: _steel, height: 1.45),
        ),
        const SizedBox(height: 7),
        Row(
          children: [
            const Icon(Icons.verified_user_outlined, size: 17, color: _blue),
            const SizedBox(width: 7),
            Flexible(
              child: Text(
                'Evidencia trazable · Revisión humana',
                style: textTheme.bodySmall?.copyWith(
                  color: _ink,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _DemoReportCallout extends StatelessWidget {
  const _DemoReportCallout({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Semantics(
      button: true,
      label: 'Descargar informe demo anonimizado de InduRadar en PDF',
      child: Container(
        key: const ValueKey('demo-report-callout'),
        width: double.infinity,
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: const Color(0xFFB8DDE7)),
          borderRadius: BorderRadius.circular(8),
          boxShadow: const [
            BoxShadow(
              color: Color(0x0D102335),
              blurRadius: 18,
              offset: Offset(0, 8),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 8,
              runSpacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 9,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE2F6F8),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    'INFORME DEMO · PDF',
                    style: textTheme.labelSmall?.copyWith(
                      color: _blue,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.2,
                    ),
                  ),
                ),
                Text(
                  'Ejemplo real anonimizado',
                  style: textTheme.labelMedium?.copyWith(
                    color: _steel,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              'Mira qué recibirías antes de configurar tu radar',
              style: textTheme.titleLarge?.copyWith(
                color: _ink,
                fontWeight: FontWeight.w800,
                height: 1.2,
                letterSpacing: 0,
              ),
            ),
            const SizedBox(height: 7),
            Text(
              'Descarga un informe de ejemplo con oportunidades, señales, evidencias, priorización y siguientes acciones. Basado en un informe real. Los nombres, fechas y fuentes se han anonimizado o modificado con fines demostrativos.',
              style: textTheme.bodyMedium?.copyWith(
                color: _steel,
                height: 1.45,
              ),
            ),
            const SizedBox(height: 15),
            OutlinedButton.icon(
              key: const ValueKey('download-demo-report-cta'),
              onPressed: onPressed,
              icon: const Icon(Icons.download_outlined),
              label: const Text('Descargar informe demo'),
              style: OutlinedButton.styleFrom(
                foregroundColor: _blue,
                side: const BorderSide(color: _blue, width: 1.4),
                padding: const EdgeInsets.symmetric(
                  horizontal: 18,
                  vertical: 14,
                ),
                textStyle: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Sin registro · PDF de muestra',
              style: textTheme.bodySmall?.copyWith(
                color: _steel,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
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
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 40,
          height: 40,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: const Color(0xFFE2F6F8),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, color: _blue, size: 21),
        ),
        const SizedBox(width: 13),
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
                ).textTheme.bodyMedium?.copyWith(color: _steel, height: 1.4),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _OpportunityExampleSection extends StatelessWidget {
  const _OpportunityExampleSection();

  @override
  Widget build(BuildContext context) {
    return const _LandingBand(
      color: Colors.white,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionHeading(
            title: 'Así convierte InduRadar varias señales en una oportunidad',
            text:
                'Una sola noticia rara vez basta. InduRadar cruza señales de fuentes oficiales, corporativas y sectoriales para identificar proyectos reales y traducirlos en una acción comercial concreta.',
          ),
          SizedBox(height: 30),
          _OpportunityExampleCard(),
        ],
      ),
    );
  }
}

class _OpportunityExampleCard extends StatelessWidget {
  const _OpportunityExampleCard();

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return DecoratedBox(
      key: const ValueKey('opportunity-example-card'),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: _line),
        borderRadius: BorderRadius.circular(8),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0F102335),
            blurRadius: 24,
            offset: Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 16),
            decoration: const BoxDecoration(
              color: Color(0xFFF0F8FA),
              borderRadius: BorderRadius.vertical(top: Radius.circular(7)),
            ),
            child: Wrap(
              spacing: 12,
              runSpacing: 8,
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 9,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFDDF4F7),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    'Ejemplo ilustrativo',
                    style: textTheme.labelMedium?.copyWith(
                      color: _blue,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                Text(
                  'Fabricante industrial · Comunitat Valenciana',
                  style: textTheme.bodyMedium?.copyWith(
                    color: _ink,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'PROYECTO IDENTIFICADO',
                  style: textTheme.labelMedium?.copyWith(
                    color: _blue,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0,
                  ),
                ),
                const SizedBox(height: 7),
                Text(
                  'Nueva línea automatizada y ampliación de capacidad',
                  style: textTheme.headlineSmall?.copyWith(
                    color: _ink,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0,
                  ),
                ),
                const SizedBox(height: 22),
                const Divider(color: _line),
                const SizedBox(height: 20),
                LayoutBuilder(
                  builder: (context, constraints) {
                    if (constraints.maxWidth < 820) {
                      return const Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _ExampleSignalsColumn(),
                          SizedBox(height: 24),
                          Divider(color: _line),
                          SizedBox(height: 24),
                          _ExampleOpportunityColumn(),
                        ],
                      );
                    }

                    return const IntrinsicHeight(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Expanded(flex: 11, child: _ExampleSignalsColumn()),
                          SizedBox(width: 26),
                          VerticalDivider(width: 1, color: _line),
                          SizedBox(width: 26),
                          Expanded(
                            flex: 10,
                            child: _ExampleOpportunityColumn(),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
            decoration: const BoxDecoration(
              color: Color(0xFFF8FBFC),
              border: Border(top: BorderSide(color: _line)),
              borderRadius: BorderRadius.vertical(bottom: Radius.circular(7)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.shield_outlined, size: 20, color: _blue),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'InduRadar distingue entre hecho confirmado, inferencia razonada y estimación de fase para evitar falsas oportunidades.',
                    style: textTheme.bodySmall?.copyWith(
                      color: _steel,
                      height: 1.4,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ExampleSignalsColumn extends StatelessWidget {
  const _ExampleSignalsColumn();

  @override
  Widget build(BuildContext context) {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _ExampleColumnTitle(
          icon: Icons.hub_outlined,
          title: 'Señales analizadas',
        ),
        SizedBox(height: 10),
        _ExampleSignalItem(
          icon: Icons.account_balance_outlined,
          title: 'Ayuda pública',
          description:
              'Concesión de subvención para modernización productiva y puesta en marcha de una nueva línea.',
          source: 'Fuente oficial',
        ),
        Divider(height: 1, color: _line),
        _ExampleSignalItem(
          icon: Icons.description_outlined,
          title: 'Permiso / licencia',
          description:
              'Tramitación de ampliación de nave e instalaciones auxiliares vinculadas al proyecto.',
          source: 'Boletín oficial',
        ),
        Divider(height: 1, color: _line),
        _ExampleSignalItem(
          icon: Icons.work_outline,
          title: 'Contratación',
          description:
              'Oferta para responsable de automatización y técnicos de mantenimiento industrial.',
          source: 'Empleo',
        ),
        Divider(height: 1, color: _line),
        _ExampleSignalItem(
          icon: Icons.campaign_outlined,
          title: 'Comunicación corporativa',
          description:
              'La empresa anuncia crecimiento de capacidad y nuevos pedidos en su planta principal.',
          source: 'Fuente corporativa / prensa sectorial',
        ),
        SizedBox(height: 14),
        _InduRadarReading(),
      ],
    );
  }
}

class _ExampleOpportunityColumn extends StatelessWidget {
  const _ExampleOpportunityColumn();

  @override
  Widget build(BuildContext context) {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _ExampleColumnTitle(
          icon: Icons.track_changes_outlined,
          title: 'Oportunidad comercial',
        ),
        SizedBox(height: 12),
        _ExampleOpportunityDetail(
          icon: Icons.precision_manufacturing_outlined,
          label: 'Necesidad probable',
          value:
              'Automatización, control de línea, sensórica, seguridad de máquinas e integración de datos.',
        ),
        Divider(height: 24, color: _line),
        _ExampleOpportunityDetail(
          icon: Icons.verified_user_outlined,
          label: 'Confianza',
          value: 'Alta',
          accent: _success,
        ),
        Divider(height: 24, color: _line),
        _ExampleOpportunityDetail(
          icon: Icons.bar_chart_outlined,
          label: 'Fuentes analizadas',
          value: '4',
        ),
        Divider(height: 24, color: _line),
        _ExampleOpportunityDetail(
          icon: Icons.calendar_month_outlined,
          label: 'Ventana probable',
          value: '3–9 meses',
        ),
        Divider(height: 24, color: _line),
        _ExampleOpportunityDetail(
          icon: Icons.arrow_outward_outlined,
          label: 'Siguiente acción',
          value:
              'Confirmar alcance y fase del proyecto, identificar al interlocutor de Operaciones / Ingeniería y priorizar contacto técnico-comercial.',
        ),
      ],
    );
  }
}

class _ExampleColumnTitle extends StatelessWidget {
  const _ExampleColumnTitle({required this.icon, required this.title});

  final IconData icon;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 22, color: _blue),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: _ink,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
      ],
    );
  }
}

class _ExampleSignalItem extends StatelessWidget {
  const _ExampleSignalItem({
    required this.icon,
    required this.title,
    required this.description,
    required this.source,
  });

  final IconData icon;
  final String title;
  final String description;
  final String source;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 46,
            height: 46,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: const Color(0xFFF1F7FC),
              border: Border.all(color: const Color(0xFFCCE0EF)),
              borderRadius: BorderRadius.circular(7),
            ),
            child: Icon(icon, size: 24, color: _blue),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: textTheme.titleSmall?.copyWith(
                    color: _ink,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  description,
                  style: textTheme.bodyMedium?.copyWith(
                    color: _ink,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 7),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F7FC),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    source,
                    style: textTheme.labelSmall?.copyWith(
                      color: _blue,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _InduRadarReading extends StatelessWidget {
  const _InduRadarReading();

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF1FAF7),
        border: Border.all(color: const Color(0xFF9ACFC2)),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.track_changes_outlined, color: _success, size: 26),
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Lectura InduRadar',
                  style: textTheme.titleSmall?.copyWith(
                    color: _success,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  'La convergencia de señales apunta a un proyecto real de ampliación en fase activa. La oportunidad no nace de una única noticia, sino de evidencias que refuerzan la misma hipótesis de inversión.',
                  style: textTheme.bodySmall?.copyWith(
                    color: _ink,
                    height: 1.45,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ExampleOpportunityDetail extends StatelessWidget {
  const _ExampleOpportunityDetail({
    required this.icon,
    required this.label,
    required this.value,
    this.accent = _blue,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 46,
          height: 46,
          alignment: Alignment.center,
          decoration: const BoxDecoration(
            color: Color(0xFFF1F7FC),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, size: 24, color: accent),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: textTheme.titleSmall?.copyWith(
                  color: accent == _success ? _success : _ink,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                value,
                style: textTheme.bodyMedium?.copyWith(
                  color: accent == _success ? _success : _ink,
                  height: 1.4,
                  fontWeight: accent == _success ? FontWeight.w700 : null,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _HowItWorksSection extends StatelessWidget {
  const _HowItWorksSection();

  @override
  Widget build(BuildContext context) {
    return _LandingBand(
      color: _surface,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionHeading(
            title: 'Cómo funciona',
            text:
                'Un proceso breve para definir el objetivo, investigar con criterio y entregar resultados accionables.',
          ),
          const SizedBox(height: 32),
          LayoutBuilder(
            builder: (context, constraints) {
              const steps = [
                _HowStep(
                  number: '1',
                  title: 'Define tu radar',
                  text:
                      'Qué vendes, sectores, empresas, territorio y señales que te interesan.',
                ),
                _HowStep(
                  number: '2',
                  title: 'Investigamos señales y proyectos',
                  text:
                      'Contrastamos fuentes corporativas, oficiales y sectoriales para identificar cambios relevantes.',
                ),
                _HowStep(
                  number: '3',
                  title: 'Recibes oportunidades priorizadas',
                  text:
                      'Empresas, proyectos, evidencias, necesidad probable y siguiente acción comercial.',
                ),
              ];

              if (constraints.maxWidth < 760) {
                return Column(
                  children: [
                    steps[0],
                    const SizedBox(height: 28),
                    steps[1],
                    const SizedBox(height: 28),
                    steps[2],
                  ],
                );
              }

              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: steps[0]),
                  const SizedBox(width: 34),
                  Expanded(child: steps[1]),
                  const SizedBox(width: 34),
                  Expanded(child: steps[2]),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _HowStep extends StatelessWidget {
  const _HowStep({
    required this.number,
    required this.title,
    required this.text,
  });

  final String number;
  final String title;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 38,
          height: 38,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: _blue,
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text(
            number,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: _ink,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0,
                ),
              ),
              const SizedBox(height: 7),
              Text(
                text,
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(color: _steel, height: 1.5),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _TrustSection extends StatelessWidget {
  const _TrustSection();

  @override
  Widget build(BuildContext context) {
    return _LandingBand(
      color: Colors.white,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionHeading(
            title: 'Inteligencia comercial, no un feed de noticias',
            text:
                'La trazabilidad y la revisión importan tanto como detectar el cambio.',
          ),
          const SizedBox(height: 32),
          LayoutBuilder(
            builder: (context, constraints) {
              final itemWidth = constraints.maxWidth >= 700
                  ? (constraints.maxWidth - 26) / 2
                  : constraints.maxWidth;
              return Wrap(
                spacing: 26,
                runSpacing: 28,
                children: [
                  SizedBox(
                    width: itemWidth,
                    child: const _TrustItem(
                      icon: Icons.filter_alt_outlined,
                      title: 'Señales, no titulares',
                      text:
                          'Identificamos el hecho o cambio relevante detrás de la noticia.',
                    ),
                  ),
                  SizedBox(
                    width: itemWidth,
                    child: const _TrustItem(
                      icon: Icons.link_outlined,
                      title: 'Evidencia trazable',
                      text:
                          'Cada oportunidad conserva las fuentes que respaldan la información.',
                    ),
                  ),
                  SizedBox(
                    width: itemWidth,
                    child: const _TrustItem(
                      icon: Icons.compare_arrows_outlined,
                      title: 'Hechos e inferencias separados',
                      text:
                          'Diferenciamos lo confirmado de una necesidad comercial probable.',
                    ),
                  ),
                  SizedBox(
                    width: itemWidth,
                    child: const _TrustItem(
                      icon: Icons.person_search_outlined,
                      title: 'Revisión humana',
                      text:
                          'La información se revisa antes de entregarse al cliente.',
                    ),
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _TrustItem extends StatelessWidget {
  const _TrustItem({
    required this.icon,
    required this.title,
    required this.text,
  });

  final IconData icon;
  final String title;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.only(left: 17),
      decoration: const BoxDecoration(
        border: Border(left: BorderSide(color: _cyan, width: 3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: _blue, size: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: _ink,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  text,
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(color: _steel, height: 1.45),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _FinalCallToAction extends StatelessWidget {
  const _FinalCallToAction({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return _LandingBand(
      color: const Color(0xFFE5F5F7),
      topPadding: 54,
      bottomPadding: 54,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final copy = Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Define qué quieres encontrar',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  color: _ink,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                'Configura tu radar comercial y dinos qué empresas, proyectos y señales son relevantes para tu negocio.',
                style: Theme.of(
                  context,
                ).textTheme.bodyLarge?.copyWith(color: _steel, height: 1.5),
              ),
            ],
          );
          final button = FilledButton.icon(
            key: const ValueKey('final-form-cta'),
            onPressed: onPressed,
            icon: const Icon(Icons.arrow_upward),
            label: const Text('Definir mi radar comercial'),
            style: FilledButton.styleFrom(
              minimumSize: const Size(250, 52),
              padding: const EdgeInsets.symmetric(horizontal: 22),
            ),
          );

          if (constraints.maxWidth < 760) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [copy, const SizedBox(height: 24), button],
            );
          }

          return Row(
            children: [
              Expanded(child: copy),
              const SizedBox(width: 42),
              button,
            ],
          );
        },
      ),
    );
  }
}

class _LandingFooter extends StatelessWidget {
  const _LandingFooter();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: _line)),
      ),
      child: Text(
        'InduRadar · Industrial Opportunity Intelligence',
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: _steel),
      ),
    );
  }
}

class _SectionHeading extends StatelessWidget {
  const _SectionHeading({required this.title, required this.text});

  final String title;
  final String text;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 780),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
              color: _ink,
              fontWeight: FontWeight.w800,
              letterSpacing: 0,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            text,
            style: Theme.of(
              context,
            ).textTheme.bodyLarge?.copyWith(color: _steel, height: 1.5),
          ),
        ],
      ),
    );
  }
}

class _FormPricingHeader extends StatelessWidget {
  const _FormPricingHeader({
    required this.pricingQuote,
    required this.pricingLoadFailed,
    required this.entryPilotPriceEur,
  });

  final PricingQuote? pricingQuote;
  final bool pricingLoadFailed;
  final num? entryPilotPriceEur;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final title = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 10,
          runSpacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text(
              'Define tu radar comercial',
              style: textTheme.headlineSmall?.copyWith(
                color: _ink,
                fontWeight: FontWeight.w800,
                letterSpacing: 0,
              ),
            ),
            if (entryPilotPriceEur != null)
              Container(
                key: const ValueKey('pricing-entry-price'),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFE2F6F8),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  'Desde ${_formatPrice(entryPilotPriceEur!)} €',
                  style: textTheme.labelLarge?.copyWith(
                    color: _blue,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          'Cuéntanos qué vendes, qué empresas quieres encontrar y qué cambios te interesa detectar.',
          style: textTheme.bodyMedium?.copyWith(color: _steel, height: 1.45),
        ),
      ],
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        final isWide = constraints.maxWidth >= 560;
        final price = _PricingSummary(
          quote: pricingQuote,
          loadFailed: pricingLoadFailed,
          horizontal: !isWide,
        );
        if (!isWide) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [title, const SizedBox(height: 16), price],
          );
        }
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: title),
            const SizedBox(width: 20),
            SizedBox(width: 190, child: price),
          ],
        );
      },
    );
  }
}

class _PricingSummary extends StatelessWidget {
  const _PricingSummary({
    required this.quote,
    required this.loadFailed,
    required this.horizontal,
  });

  final PricingQuote? quote;
  final bool loadFailed;
  final bool horizontal;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final border = horizontal
        ? const Border(top: BorderSide(color: _line, width: 2))
        : const Border(left: BorderSide(color: _cyan, width: 3));
    final padding = horizontal
        ? const EdgeInsets.only(top: 12)
        : const EdgeInsets.only(left: 14);

    return Container(
      key: const ValueKey('pricing-summary'),
      decoration: BoxDecoration(border: border),
      padding: padding,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            quote == null
                ? 'ESTIMACIÓN DE PRECIO'
                : 'ESTIMACIÓN · ${quote!.pilotLabel.toUpperCase()}',
            style: textTheme.labelSmall?.copyWith(
              color: _blue,
              fontWeight: FontWeight.w800,
              letterSpacing: 0,
            ),
          ),
          const SizedBox(height: 6),
          if (quote == null)
            Text(
              loadFailed
                  ? 'Precio pendiente de revisión'
                  : 'Calculando precio…',
              style: textTheme.bodyMedium?.copyWith(
                color: _ink,
                fontWeight: FontWeight.w700,
              ),
            )
          else
            for (var index = 0; index < quote!.lineItems.length; index++) ...[
              if (index > 0) const SizedBox(height: 8),
              _PricingLine(item: quote!.lineItems[index]),
            ],
          if (quote != null) ...[
            const SizedBox(height: 8),
            Text(
              'Incluye hasta ${quote!.includedSectors} sectores, '
              '${quote!.includedProvinces} provincias y '
              '${quote!.includedCompanyTypes} tipos de empresa. '
              'Señales y áreas incluidas.',
              style: textTheme.bodySmall?.copyWith(color: _steel, height: 1.35),
            ),
          ],
        ],
      ),
    );
  }
}

class _PricingLine extends StatelessWidget {
  const _PricingLine({required this.item});

  final PricingLineItem item;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final suffix = item.isMonthly ? '/mes' : '';
    final billingLabel = item.isMonthly ? 'cuota mensual' : 'pago único';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '${_formatPrice(item.pilotPriceEur)} €$suffix',
          key: ValueKey('pricing-${item.planCode}'),
          style: textTheme.titleLarge?.copyWith(
            color: _ink,
            fontWeight: FontWeight.w800,
            letterSpacing: 0,
          ),
        ),
        Text(
          '${item.planLabel} · $billingLabel',
          style: textTheme.bodySmall?.copyWith(
            color: _ink,
            fontWeight: FontWeight.w700,
            height: 1.35,
          ),
        ),
        Text(
          'Estándar: ${_formatPrice(item.standardPriceEur)} €$suffix',
          style: textTheme.bodySmall?.copyWith(color: _steel, height: 1.35),
        ),
        if (item.requiresActivePriorStudy)
          Text(
            'Requiere un estudio puntual previo activo del mismo alcance.',
            style: textTheme.bodySmall?.copyWith(
              color: _blue,
              fontWeight: FontWeight.w700,
              height: 1.35,
            ),
          ),
      ],
    );
  }
}

String _formatPrice(num value) {
  if (value == value.roundToDouble()) {
    return value.toInt().toString();
  }
  return value
      .toStringAsFixed(2)
      .replaceFirst(RegExp(r'0+$'), '')
      .replaceAll('.', ',');
}

class _LeadFormPanel extends StatelessWidget {
  const _LeadFormPanel({
    required this.formKey,
    required this.fullNameController,
    required this.companyController,
    required this.jobTitleController,
    required this.emailController,
    required this.phoneController,
    required this.websiteController,
    required this.addressController,
    required this.offerDescriptionController,
    required this.otherOfferCategoryController,
    required this.otherProblemController,
    required this.prioritySolutionsController,
    required this.otherSectorController,
    required this.otherTargetCompanyTypeController,
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
    required this.geographyCountries,
    required this.spanishProvinces,
    required this.investmentSignals,
    required this.innovationSignals,
    required this.growthSignals,
    required this.publicFinanceSignals,
    required this.commercialNeeds,
    required this.serviceTypes,
    required this.targetRevenueRange,
    required this.targetEmployeeRange,
    required this.minimumOpportunityValue,
    required this.spainCoverage,
    required this.expandedSectionIndex,
    required this.sectionHeaderKeys,
    required this.showSelectionErrors,
    required this.completedSections,
    required this.privacyAccepted,
    required this.marketingConsent,
    required this.privacyError,
    required this.successMessage,
    required this.submissionError,
    required this.isSubmitting,
    required this.submissionSucceeded,
    required this.pricingQuote,
    required this.pricingLoadFailed,
    required this.entryPilotPriceEur,
    required this.onToggleOption,
    required this.onRevenueChanged,
    required this.onEmployeeRangeChanged,
    required this.onMinimumValueChanged,
    required this.onGeographyCountriesChanged,
    required this.onSpainCoverageChanged,
    required this.onSpanishProvincesChanged,
    required this.onSetAllSignals,
    required this.onSetAllCommercialNeeds,
    required this.onSectionChanged,
    required this.onPrivacyChanged,
    required this.onMarketingChanged,
    required this.onPrivacyPolicyTap,
    required this.onSubmit,
    required this.onStartNewRequest,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController fullNameController;
  final TextEditingController companyController;
  final TextEditingController jobTitleController;
  final TextEditingController emailController;
  final TextEditingController phoneController;
  final TextEditingController websiteController;
  final TextEditingController addressController;
  final TextEditingController offerDescriptionController;
  final TextEditingController otherOfferCategoryController;
  final TextEditingController otherProblemController;
  final TextEditingController prioritySolutionsController;
  final TextEditingController otherSectorController;
  final TextEditingController otherTargetCompanyTypeController;
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
  final Set<String> geographyCountries;
  final Set<String> spanishProvinces;
  final Set<String> investmentSignals;
  final Set<String> innovationSignals;
  final Set<String> growthSignals;
  final Set<String> publicFinanceSignals;
  final Set<String> commercialNeeds;
  final Set<String> serviceTypes;
  final String? targetRevenueRange;
  final String? targetEmployeeRange;
  final String? minimumOpportunityValue;
  final String? spainCoverage;
  final int expandedSectionIndex;
  final List<GlobalKey> sectionHeaderKeys;
  final bool showSelectionErrors;
  final List<bool> completedSections;
  final bool privacyAccepted;
  final bool marketingConsent;
  final String? privacyError;
  final String? successMessage;
  final String? submissionError;
  final bool isSubmitting;
  final bool submissionSucceeded;
  final PricingQuote? pricingQuote;
  final bool pricingLoadFailed;
  final num? entryPilotPriceEur;
  final void Function(Set<String> values, String label, bool selected)
  onToggleOption;
  final ValueChanged<String?> onRevenueChanged;
  final ValueChanged<String?> onEmployeeRangeChanged;
  final ValueChanged<String?> onMinimumValueChanged;
  final ValueChanged<Set<String>> onGeographyCountriesChanged;
  final ValueChanged<String?> onSpainCoverageChanged;
  final ValueChanged<Set<String>> onSpanishProvincesChanged;
  final ValueChanged<bool> onSetAllSignals;
  final ValueChanged<bool> onSetAllCommercialNeeds;
  final ValueChanged<int> onSectionChanged;
  final ValueChanged<bool?> onPrivacyChanged;
  final ValueChanged<bool?> onMarketingChanged;
  final VoidCallback onPrivacyPolicyTap;
  final VoidCallback onSubmit;
  final VoidCallback onStartNewRequest;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final allSignalsSelected =
        investmentSignals.length == _investmentSignalOptions.length &&
        innovationSignals.length == _innovationSignalOptions.length &&
        growthSignals.length == _growthSignalOptions.length &&
        publicFinanceSignals.length == _publicFinanceSignalOptions.length;
    final selectedStandardNeeds = commercialNeeds.where(
      (option) => option != _otherNeedOption,
    );
    final allCommercialNeedsSelected =
        selectedStandardNeeds.length == _commercialNeedOptions.length - 1;

    return DecoratedBox(
      key: const ValueKey('lead-form-panel'),
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
              _FormPricingHeader(
                pricingQuote: pricingQuote,
                pricingLoadFailed: pricingLoadFailed,
                entryPilotPriceEur: entryPilotPriceEur,
              ),
              const SizedBox(height: 10),
              Wrap(
                alignment: WrapAlignment.spaceBetween,
                runSpacing: 4,
                children: [
                  Text(
                    'Paso ${expandedSectionIndex + 1} de 5',
                    key: const ValueKey('form-progress-label'),
                    style: textTheme.labelLarge?.copyWith(
                      color: _blue,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  Text(
                    'Solo algunos campos son obligatorios',
                    style: textTheme.bodySmall?.copyWith(color: _steel),
                  ),
                ],
              ),
              const SizedBox(height: 9),
              ClipRRect(
                borderRadius: BorderRadius.circular(2),
                child: LinearProgressIndicator(
                  key: const ValueKey('form-progress-bar'),
                  value: (expandedSectionIndex + 1) / 5,
                  minHeight: 4,
                  color: _cyan,
                  backgroundColor: const Color(0xFFE7EFF3),
                ),
              ),
              const SizedBox(height: 22),
              if (successMessage != null) ...[
                _SuccessBanner(
                  message: successMessage!,
                  onStartNewRequest: onStartNewRequest,
                ),
                const SizedBox(height: 18),
              ],
              if (submissionError != null) ...[
                _ErrorBanner(message: submissionError!),
                const SizedBox(height: 18),
              ],
              _FormSection(
                sectionId: 'company-offer',
                headerAnchorKey: sectionHeaderKeys[0],
                title: '1. ¿Qué vendes?',
                isLocked: submissionSucceeded,
                isExpanded: expandedSectionIndex == 0,
                isComplete: completedSections[0],
                onToggle: () => onSectionChanged(0),
                children: [
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
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: fullNameController,
                    autofillHints: const [AutofillHints.name],
                    decoration: const InputDecoration(
                      labelText: 'Nombre y apellidos *',
                      prefixIcon: Icon(Icons.person_outline),
                    ),
                    textInputAction: TextInputAction.next,
                    validator: _required,
                  ),
                  const SizedBox(height: 14),
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
                  const SizedBox(height: 14),
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
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: jobTitleController,
                    decoration: const InputDecoration(
                      labelText: 'Cargo / función (opcional)',
                      prefixIcon: Icon(Icons.work_outline),
                    ),
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: phoneController,
                    autofillHints: const [AutofillHints.telephoneNumber],
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(
                      labelText: 'Teléfono (opcional)',
                      prefixIcon: Icon(Icons.phone_outlined),
                    ),
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: websiteController,
                    autofillHints: const [AutofillHints.url],
                    keyboardType: TextInputType.url,
                    decoration: const InputDecoration(
                      labelText: 'Web de la empresa (opcional)',
                      prefixIcon: Icon(Icons.language_outlined),
                    ),
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: addressController,
                    autofillHints: const [AutofillHints.fullStreetAddress],
                    decoration: const InputDecoration(
                      labelText: 'Dirección (opcional)',
                      prefixIcon: Icon(Icons.location_on_outlined),
                    ),
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: 18),
                  _OptionalFields(
                    title: 'Afinar tu oferta',
                    description:
                        'Categorías, problemas que resuelves y soluciones prioritarias.',
                    showOptionalLabel: false,
                    forceExpanded:
                        (showSelectionErrors && offerCategories.isEmpty) ||
                        (offerCategories.contains(_otherOfferCategoryOption) &&
                            otherOfferCategoryController.text.trim().isEmpty) ||
                        (problemsSolved.contains(_otherProblemOption) &&
                            otherProblemController.text.trim().isEmpty),
                    children: [
                      _MultiSelectChipGroup(
                        title: 'Categoría principal de tu oferta *',
                        errorText:
                            showSelectionErrors && offerCategories.isEmpty
                            ? 'Selecciona al menos una categoría de oferta.'
                            : null,
                        options: _offerCategoryOptions,
                        selectedValues: offerCategories,
                        isEnabled: !isSubmitting,
                        onChanged: (label, selected) {
                          onToggleOption(offerCategories, label, selected);
                        },
                      ),
                      if (offerCategories.contains(
                        _otherOfferCategoryOption,
                      )) ...[
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
                              'Productos, soluciones o servicios que quieres priorizar (opcional)',
                          hintText:
                              'Familias concretas, especialidades, marcas, tecnologías, aplicaciones o servicios.',
                          alignLabelWithHint: true,
                          prefixIcon: Icon(Icons.tune_outlined),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _FormSection(
                sectionId: 'target-company',
                headerAnchorKey: sectionHeaderKeys[1],
                title: '2. ¿Qué empresas buscas?',
                isLocked: submissionSucceeded,
                isExpanded: expandedSectionIndex == 1,
                isComplete: completedSections[1],
                onToggle: () => onSectionChanged(1),
                children: [
                  _MultiSelectChipGroup(
                    title: 'Sectores objetivo',
                    errorText: showSelectionErrors && targetSectors.isEmpty
                        ? 'Selecciona al menos un sector objetivo.'
                        : null,
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
                    errorText: showSelectionErrors && targetCompanyTypes.isEmpty
                        ? 'Selecciona al menos un tipo de empresa objetivo.'
                        : null,
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
                  _GeographySelector(
                    countries: geographyCountries,
                    spainCoverage: spainCoverage,
                    spanishProvinces: spanishProvinces,
                    isEnabled: !isSubmitting,
                    onCountriesChanged: onGeographyCountriesChanged,
                    onSpainCoverageChanged: onSpainCoverageChanged,
                    onProvincesChanged: onSpanishProvincesChanged,
                  ),
                  const SizedBox(height: 18),
                  _OptionalFields(
                    title: 'Criterios avanzados',
                    description:
                        'Tamaño, valor mínimo y características de la empresa ideal.',
                    forceExpanded:
                        minimumOpportunityValue == _otherMinimumValueOption &&
                        otherMinimumValueController.text.trim().isEmpty,
                    children: [
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
                      if (minimumOpportunityValue ==
                          _otherMinimumValueOption) ...[
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
                          labelText:
                              'Define tu empresa objetivo ideal (opcional)',
                          hintText:
                              'Producción propia, decisión local, varias plantas, exportación, tecnologías concretas, certificaciones, tamaño mínimo...',
                          alignLabelWithHint: true,
                          prefixIcon: Icon(Icons.business_center_outlined),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _FormSection(
                sectionId: 'signals',
                headerAnchorKey: sectionHeaderKeys[2],
                title: '3. ¿Qué cambios quieres detectar?',
                isLocked: submissionSucceeded,
                isExpanded: expandedSectionIndex == 2,
                isComplete: completedSections[2],
                onToggle: () => onSectionChanged(2),
                children: [
                  _SelectAllControl(
                    label: 'Seleccionar todos los cambios',
                    isSelected: allSignalsSelected,
                    isEnabled: !isSubmitting,
                    onChanged: onSetAllSignals,
                  ),
                  const SizedBox(height: 18),
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
                sectionId: 'needs',
                headerAnchorKey: sectionHeaderKeys[3],
                title: '4. ¿Qué necesidades quieres detectar?',
                isLocked: submissionSucceeded,
                isExpanded: expandedSectionIndex == 3,
                isComplete: completedSections[3],
                onToggle: () => onSectionChanged(3),
                children: [
                  _SelectAllControl(
                    label: 'Seleccionar todas las áreas',
                    isSelected: allCommercialNeedsSelected,
                    isEnabled: !isSubmitting,
                    onChanged: onSetAllCommercialNeeds,
                  ),
                  const SizedBox(height: 18),
                  _MultiSelectChipGroup(
                    title:
                        '¿En qué áreas de oportunidad quieres clasificar los resultados?',
                    helperText:
                        'La sección 2 define en qué empresas buscar; aquí defines qué necesidades podrían encajar con tu oferta. Todas están incluidas en la tarifa.',
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
                      label: 'Otra área de oportunidad',
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
                  _OptionalFields(
                    title: 'Referencias y exclusiones',
                    description:
                        'Casos, clientes, cuentas y límites que nos ayudan a afinar el encaje.',
                    children: [
                      TextFormField(
                        controller: recentCaseController,
                        minLines: 3,
                        maxLines: 6,
                        decoration: const InputDecoration(
                          labelText:
                              'Ayúdanos con un caso real o reciente (opcional)',
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
                            label:
                                'Clientes actuales para buscar perfiles similares (opcional)',
                            hint:
                                'Empresas ya clientes cuyo perfil quieres replicar. Hasta 5, una por línea.',
                          ),
                          _MultilineReferenceField(
                            controller: idealClientsController,
                            label:
                                'Clientes ideales: clientes de la competencia a seguir (opcional)',
                            hint:
                                'Empresas que compran a competidores y quieres investigar. Hasta 5, una por línea.',
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      _ResponsiveFields(
                        children: [
                          _MultilineReferenceField(
                            controller: watchlistAccountsController,
                            label:
                                'Cuentas estratégicas para búsqueda especializada (opcional)',
                            hint:
                                'Empresas concretas para una investigación más profunda. Hasta 5, una por línea.',
                          ),
                          _MultilineReferenceField(
                            controller: competitorsController,
                            label: 'Competidores (opcional)',
                            hint:
                                'Indica si quieres excluirlos o monitorizarlos.',
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      TextFormField(
                        controller: excludedCompaniesController,
                        minLines: 2,
                        maxLines: 4,
                        decoration: const InputDecoration(
                          labelText: 'Empresas excluidas (opcional)',
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
                              '¿Por qué una empresa aparentemente ideal no os compraría? (opcional)',
                          hintText:
                              'Decisión centralizada en otro país, consumo insuficiente, tecnología incompatible, ticket demasiado pequeño...',
                          alignLabelWithHint: true,
                          prefixIcon: Icon(Icons.report_problem_outlined),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _FormSection(
                sectionId: 'service',
                headerAnchorKey: sectionHeaderKeys[4],
                title: '5. ¿Cómo quieres recibir los resultados?',
                isLocked: submissionSucceeded,
                isExpanded: expandedSectionIndex == 4,
                isComplete: completedSections[4],
                onToggle: () => onSectionChanged(4),
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
                  const SizedBox(height: 10),
                  Text(
                    'Las revisiones requieren un estudio puntual previo activo del mismo alcance. Si amplías sectores o provincias, primero se presupuesta la ampliación puntual.',
                    style: textTheme.bodySmall?.copyWith(
                      color: _steel,
                      height: 1.45,
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: serviceCommentsController,
                    minLines: 2,
                    maxLines: 5,
                    decoration: const InputDecoration(
                      labelText:
                          'Comentarios sobre cuentas concretas a monitorizar, frecuencia, fechas o alcance (opcional)',
                      alignLabelWithHint: true,
                      prefixIcon: Icon(Icons.event_note_outlined),
                    ),
                  ),
                  const SizedBox(height: 18),
                  const Divider(color: _line),
                  const SizedBox(height: 8),
                  _PrivacyConsent(
                    privacyAccepted: privacyAccepted,
                    marketingConsent: marketingConsent,
                    errorText: privacyError,
                    onPrivacyChanged: isSubmitting ? null : onPrivacyChanged,
                    onMarketingChanged: isSubmitting
                        ? null
                        : onMarketingChanged,
                    onPrivacyPolicyTap: onPrivacyPolicyTap,
                  ),
                ],
              ),
              const SizedBox(height: 22),
              FilledButton.icon(
                key: const ValueKey('primary-form-cta'),
                onPressed: isSubmitting || submissionSucceeded
                    ? null
                    : onSubmit,
                icon: isSubmitting
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Icon(
                        submissionSucceeded
                            ? Icons.check_circle_outline
                            : Icons.send_outlined,
                      ),
                label: Text(
                  isSubmitting
                      ? 'Enviando solicitud…'
                      : submissionSucceeded
                      ? 'Solicitud recibida'
                      : 'Definir mi radar comercial',
                ),
              ),
              const SizedBox(height: 10),
              Text(
                'Revisaremos tu solicitud antes de iniciar la investigación.',
                textAlign: TextAlign.center,
                style: textTheme.bodySmall?.copyWith(
                  color: _steel,
                  height: 1.4,
                ),
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
    required this.sectionId,
    required this.headerAnchorKey,
    required this.title,
    required this.children,
    required this.isLocked,
    required this.isExpanded,
    required this.isComplete,
    required this.onToggle,
  });

  final String sectionId;
  final GlobalKey headerAnchorKey;
  final String title;
  final List<Widget> children;
  final bool isLocked;
  final bool isExpanded;
  final bool isComplete;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        border: const Border(
          top: BorderSide(color: _line),
          bottom: BorderSide(color: _line),
        ),
      ),
      child: Column(
        children: [
          Material(
            key: headerAnchorKey,
            color: isLocked
                ? const Color(0xFFF6F8F9)
                : isExpanded
                ? const Color(0xFFF1F8FA)
                : Colors.white,
            child: InkWell(
              key: ValueKey('form-section-header-$sectionId'),
              onTap: isLocked ? null : onToggle,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 5),
                child: ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 10),
                  title: Text(
                    title,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: isLocked ? _steel : _ink,
                      fontWeight: FontWeight.w800,
                      height: 1.25,
                      letterSpacing: 0,
                    ),
                  ),
                  subtitle: Padding(
                    padding: const EdgeInsets.only(top: 3),
                    child: _SectionStatus(isComplete: isComplete),
                  ),
                  trailing: AnimatedRotation(
                    turns: isExpanded ? 0.5 : 0,
                    duration: const Duration(milliseconds: 180),
                    child: Icon(
                      Icons.keyboard_arrow_down,
                      color: isLocked ? _steel : _blue,
                    ),
                  ),
                ),
              ),
            ),
          ),
          TweenAnimationBuilder<double>(
            tween: Tween<double>(end: isExpanded ? 1 : 0),
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOutCubic,
            builder: (context, value, child) {
              return ClipRect(
                child: Align(
                  key: ValueKey('form-section-body-$sectionId'),
                  alignment: Alignment.topCenter,
                  heightFactor: value,
                  child: Opacity(opacity: value, child: child),
                ),
              );
            },
            child: IgnorePointer(
              ignoring: !isExpanded,
              child: ExcludeSemantics(
                excluding: !isExpanded,
                child: FocusScope(
                  canRequestFocus: !isLocked,
                  descendantsAreFocusable: !isLocked,
                  descendantsAreTraversable: !isLocked,
                  child: AbsorbPointer(
                    key: sectionId == 'company-offer'
                        ? const ValueKey('submitted-form-lock')
                        : null,
                    absorbing: isLocked,
                    child: Opacity(
                      opacity: isLocked ? 0.58 : 1,
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(14, 18, 14, 20),
                        child: Column(children: children),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionStatus extends StatelessWidget {
  const _SectionStatus({required this.isComplete});

  final bool isComplete;

  @override
  Widget build(BuildContext context) {
    final label = isComplete
        ? 'Datos obligatorios completos'
        : 'Faltan datos obligatorios';
    final color = isComplete ? _success : _steel;

    return Row(
      children: [
        Icon(
          isComplete ? Icons.check_circle_outline : Icons.info_outline,
          size: 13,
          color: color,
        ),
        const SizedBox(width: 5),
        Flexible(
          child: Text(
            label,
            maxLines: 2,
            softWrap: true,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    );
  }
}

class _OptionalFields extends StatefulWidget {
  const _OptionalFields({
    required this.title,
    required this.description,
    required this.children,
    this.forceExpanded = false,
    this.showOptionalLabel = true,
  });

  final String title;
  final String description;
  final List<Widget> children;
  final bool forceExpanded;
  final bool showOptionalLabel;

  @override
  State<_OptionalFields> createState() => _OptionalFieldsState();
}

class _OptionalFieldsState extends State<_OptionalFields> {
  late bool _isExpanded = widget.forceExpanded;

  @override
  void didUpdateWidget(covariant _OptionalFields oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.forceExpanded && !_isExpanded) {
      _isExpanded = true;
    }
  }

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFFF8FBFC),
        border: Border.all(color: _line),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Column(
        children: [
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: widget.forceExpanded
                  ? null
                  : () => setState(() => _isExpanded = !_isExpanded),
              child: ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 14),
                title: Text(
                  widget.showOptionalLabel
                      ? '${widget.title} (opcional)'
                      : widget.title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: _ink,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                subtitle: Text(
                  widget.description,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: _steel, height: 1.35),
                ),
                trailing: AnimatedRotation(
                  turns: _isExpanded ? 0.5 : 0,
                  duration: const Duration(milliseconds: 180),
                  child: const Icon(Icons.keyboard_arrow_down, color: _blue),
                ),
              ),
            ),
          ),
          TweenAnimationBuilder<double>(
            tween: Tween<double>(end: _isExpanded ? 1 : 0),
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOutCubic,
            builder: (context, value, child) {
              return ClipRect(
                child: Align(
                  heightFactor: value,
                  alignment: Alignment.topCenter,
                  child: Opacity(opacity: value, child: child),
                ),
              );
            },
            child: IgnorePointer(
              ignoring: !_isExpanded,
              child: ExcludeSemantics(
                excluding: !_isExpanded,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 8, 14, 16),
                  child: Column(children: widget.children),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SelectAllControl extends StatelessWidget {
  const _SelectAllControl({
    required this.label,
    required this.isSelected,
    required this.isEnabled,
    required this.onChanged,
  });

  final String label;
  final bool isSelected;
  final bool isEnabled;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFFF0F8FA),
        border: Border.all(color: _line),
        borderRadius: BorderRadius.circular(6),
      ),
      child: CheckboxListTile(
        key: ValueKey('select-all-$label'),
        value: isSelected,
        onChanged: isEnabled ? (value) => onChanged(value ?? false) : null,
        controlAffinity: ListTileControlAffinity.leading,
        contentPadding: const EdgeInsets.symmetric(horizontal: 10),
        activeColor: _blue,
        checkColor: Colors.white,
        dense: true,
        title: Text(
          isSelected ? 'Desmarcar todos' : label,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: _ink,
            fontWeight: FontWeight.w800,
          ),
        ),
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
    this.errorText,
  });

  final String title;
  final String? helperText;
  final String? errorText;
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
        ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: DecoratedBox(
            decoration: BoxDecoration(
              border: Border.all(
                color: errorText == null
                    ? _line
                    : Theme.of(context).colorScheme.error,
              ),
            ),
            child: Column(
              children: [
                for (var index = 0; index < options.length; index++) ...[
                  CheckboxListTile(
                    value: selectedValues.contains(options[index]),
                    onChanged: isEnabled
                        ? (selected) {
                            onChanged(options[index], selected ?? false);
                          }
                        : null,
                    controlAffinity: ListTileControlAffinity.leading,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 10),
                    activeColor: _blue,
                    checkColor: Colors.white,
                    selectedTileColor: const Color(0xFFEAF7FA),
                    selected: selectedValues.contains(options[index]),
                    dense: true,
                    title: Text(
                      options[index],
                      style: textTheme.bodyMedium?.copyWith(
                        color: _ink,
                        height: 1.3,
                      ),
                    ),
                  ),
                  if (index < options.length - 1)
                    const Divider(height: 1, color: _line),
                ],
              ],
            ),
          ),
        ),
        if (errorText != null) ...[
          const SizedBox(height: 7),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                Icons.error_outline,
                size: 16,
                color: Theme.of(context).colorScheme.error,
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  errorText!,
                  style: textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.error,
                  ),
                ),
              ),
            ],
          ),
        ],
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
        ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: DecoratedBox(
            decoration: BoxDecoration(border: Border.all(color: _line)),
            child: RadioGroup<String>(
              groupValue: selectedValue,
              onChanged: (value) {
                if (isEnabled) {
                  onChanged(value);
                }
              },
              child: Column(
                children: [
                  for (var index = 0; index < options.length; index++) ...[
                    RadioListTile<String>(
                      value: options[index],
                      enabled: isEnabled,
                      selected: selectedValue == options[index],
                      controlAffinity: ListTileControlAffinity.leading,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 10,
                      ),
                      activeColor: _blue,
                      selectedTileColor: const Color(0xFFEAF7FA),
                      dense: true,
                      title: Text(
                        options[index],
                        style: textTheme.bodyMedium?.copyWith(
                          color: _ink,
                          height: 1.3,
                        ),
                      ),
                    ),
                    if (index < options.length - 1)
                      const Divider(height: 1, color: _line),
                  ],
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _GeographySelector extends StatelessWidget {
  const _GeographySelector({
    required this.countries,
    required this.spainCoverage,
    required this.spanishProvinces,
    required this.isEnabled,
    required this.onCountriesChanged,
    required this.onSpainCoverageChanged,
    required this.onProvincesChanged,
  });

  final Set<String> countries;
  final String? spainCoverage;
  final Set<String> spanishProvinces;
  final bool isEnabled;
  final ValueChanged<Set<String>> onCountriesChanged;
  final ValueChanged<String?> onSpainCoverageChanged;
  final ValueChanged<Set<String>> onProvincesChanged;

  @override
  Widget build(BuildContext context) {
    final hasSpain = countries.contains(_spainCountry);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Geografía',
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
            color: _ink,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 10),
        FormField<Set<String>>(
          initialValue: Set<String>.from(countries),
          validator: (_) {
            if (countries.isEmpty) {
              return 'Selecciona al menos un país.';
            }
            return null;
          },
          builder: (field) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _MultiSelectChipGroup(
                  title: 'Países *',
                  helperText: 'Puedes seleccionar España, Portugal o ambos.',
                  options: _geographyCountryOptions,
                  selectedValues: countries,
                  isEnabled: isEnabled,
                  onChanged: (label, selected) {
                    final next = Set<String>.from(countries);
                    if (selected) {
                      next.add(label);
                    } else {
                      next.remove(label);
                    }
                    field.didChange(next);
                    onCountriesChanged(next);
                  },
                ),
                if (field.hasError) _SelectionError(message: field.errorText!),
              ],
            );
          },
        ),
        if (hasSpain) ...[
          const SizedBox(height: 18),
          FormField<String>(
            key: ValueKey('spain-coverage-$spainCoverage'),
            initialValue: spainCoverage,
            validator: (_) {
              if (spainCoverage == null) {
                return 'Elige la cobertura para España.';
              }
              return null;
            },
            builder: (field) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _SingleSelectChipGroup(
                    title: 'Cobertura en España *',
                    options: _spainCoverageOptions,
                    selectedValue: spainCoverage,
                    isEnabled: isEnabled,
                    onChanged: (value) {
                      field.didChange(value);
                      onSpainCoverageChanged(value);
                    },
                  ),
                  if (field.hasError)
                    _SelectionError(message: field.errorText!),
                ],
              );
            },
          ),
        ],
        if (hasSpain && spainCoverage == _spainByProvince) ...[
          const SizedBox(height: 18),
          FormField<Set<String>>(
            key: ValueKey('spain-provinces-${spanishProvinces.length}'),
            initialValue: Set<String>.from(spanishProvinces),
            validator: (_) {
              if (spanishProvinces.isEmpty) {
                return 'Selecciona al menos una provincia.';
              }
              return null;
            },
            builder: (field) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _MultiSelectChipGroup(
                    title: 'Provincias *',
                    options: _spanishProvinceOptions,
                    selectedValues: spanishProvinces,
                    isEnabled: isEnabled,
                    onChanged: (label, selected) {
                      final next = Set<String>.from(spanishProvinces);
                      if (selected) {
                        next.add(label);
                      } else {
                        next.remove(label);
                      }
                      field.didChange(next);
                      onProvincesChanged(next);
                    },
                  ),
                  if (field.hasError)
                    _SelectionError(message: field.errorText!),
                ],
              );
            },
          ),
        ],
      ],
    );
  }
}

class _SelectionError extends StatelessWidget {
  const _SelectionError({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8, left: 12),
      child: Text(
        message,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: Theme.of(context).colorScheme.error,
        ),
      ),
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
    required this.onPrivacyPolicyTap,
  });

  final bool privacyAccepted;
  final bool marketingConsent;
  final String? errorText;
  final ValueChanged<bool?>? onPrivacyChanged;
  final ValueChanged<bool?>? onMarketingChanged;
  final VoidCallback onPrivacyPolicyTap;

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
          title: Wrap(
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(
                'He leído y acepto la ',
                style: textTheme.bodySmall?.copyWith(
                  color: _steel,
                  height: 1.45,
                ),
              ),
              TextButton(
                onPressed: onPrivacyPolicyTap,
                style: TextButton.styleFrom(
                  padding: EdgeInsets.zero,
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  textStyle: textTheme.bodySmall?.copyWith(
                    decoration: TextDecoration.underline,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                child: const Text('Política de privacidad.'),
              ),
              Text(
                ' *',
                style: textTheme.bodySmall?.copyWith(
                  color: _steel,
                  height: 1.45,
                ),
              ),
            ],
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
            'Quiero recibir novedades y comunicaciones de InduRadar.',
            style: textTheme.bodySmall?.copyWith(color: _steel, height: 1.45),
          ),
        ),
      ],
    );
  }
}

class _SuccessBanner extends StatelessWidget {
  const _SuccessBanner({
    required this.message,
    required this.onStartNewRequest,
  });

  final String message;
  final VoidCallback onStartNewRequest;

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
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    message,
                    style: Theme.of(
                      context,
                    ).textTheme.bodyMedium?.copyWith(color: _ink, height: 1.4),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    key: const ValueKey('new-request-cta'),
                    onPressed: onStartNewRequest,
                    icon: const Icon(Icons.add_circle_outline),
                    label: const Text('Generar nueva solicitud'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colorScheme.errorContainer,
        border: Border.all(color: colorScheme.error.withValues(alpha: 0.35)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.error_outline, color: colorScheme.error, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                message,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: colorScheme.onErrorContainer,
                  height: 1.4,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

void _logLeadDebug(String message) {
  if (kDebugMode) {
    debugPrint(message);
  }
}

class LeadSubmissionService {
  const LeadSubmissionService({
    String endpoint = _leadEndpoint,
    http.Client? client,
    Duration timeout = const Duration(seconds: 20),
  }) : _endpoint = endpoint,
       _client = client,
       _timeout = timeout;

  final String _endpoint;
  final http.Client? _client;
  final Duration _timeout;

  Future<LeadSubmissionResult> submit(LeadRequest request) async {
    final endpoint = _endpoint.trim();
    if (endpoint.isEmpty) {
      _logLeadDebug('LEAD_ENDPOINT is not configured.');
      throw const LeadSubmissionException(
        'El formulario no está configurado para enviar solicitudes.',
        technicalDetail: 'LEAD_ENDPOINT is empty.',
      );
    }

    final uri = Uri.tryParse(endpoint);
    if (uri == null || uri.scheme != 'https' || uri.host.isEmpty) {
      _logLeadDebug('LEAD_ENDPOINT is not a valid HTTPS URL.');
      throw const LeadSubmissionException(
        'El formulario no está configurado correctamente.',
        technicalDetail: 'LEAD_ENDPOINT must be a valid HTTPS URL.',
      );
    }

    const headers = <String, String>{
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    final body = jsonEncode(request.toJson());

    _logLeadDebug('Submitting lead');
    late final http.Response response;
    try {
      response =
          await (_client == null
                  ? http.post(uri, headers: headers, body: body)
                  : _client.post(uri, headers: headers, body: body))
              .timeout(_timeout);
    } on TimeoutException {
      _logLeadDebug('Lead submission timed out.');
      throw const LeadSubmissionException(
        'El envío ha tardado demasiado. Inténtalo de nuevo en unos minutos.',
        technicalDetail: 'Lead submission timed out.',
      );
    } catch (error) {
      _logLeadDebug('Lead connection error: ${error.runtimeType}');
      throw LeadSubmissionException(
        'No hemos podido enviar la solicitud. Inténtalo de nuevo en unos minutos.',
        technicalDetail: 'Lead connection error: ${error.runtimeType}',
      );
    }

    _logLeadDebug('Lead HTTP status: ${response.statusCode}');

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw LeadSubmissionException(
        'No hemos podido enviar la solicitud. Inténtalo de nuevo en unos minutos.',
        technicalDetail: 'Lead endpoint returned HTTP ${response.statusCode}.',
      );
    }

    late final Object? decoded;
    try {
      decoded = jsonDecode(response.body);
    } on FormatException {
      throw const LeadSubmissionException(
        'No hemos podido confirmar el envío. Inténtalo de nuevo en unos minutos.',
        technicalDetail: 'Lead endpoint returned invalid JSON.',
      );
    }
    if (decoded is! Map<String, dynamic>) {
      throw const LeadSubmissionException(
        'No hemos podido confirmar el envío. Inténtalo de nuevo en unos minutos.',
        technicalDetail: 'Lead endpoint returned a non-object JSON response.',
      );
    }

    final result = LeadSubmissionResult.fromJson(decoded);
    _logLeadDebug('Lead success: ${result.success}');
    _logLeadDebug('Lead submission_id: ${result.submissionId ?? 'null'}');
    _logLeadDebug('Lead email_sent: ${result.emailSent ?? 'null'}');

    if (!result.success) {
      throw const LeadSubmissionException(
        'No hemos podido enviar la solicitud. Inténtalo de nuevo en unos minutos.',
        technicalDetail: 'Lead endpoint returned success=false.',
      );
    }

    return result;
  }
}

class LeadSubmissionException implements Exception {
  const LeadSubmissionException(this.message, {this.technicalDetail});

  final String message;
  final String? technicalDetail;

  @override
  String toString() => message;
}

class LeadSubmissionResult {
  const LeadSubmissionResult({
    required this.success,
    this.submissionId,
    this.emailSent,
    this.emailError,
  });

  factory LeadSubmissionResult.fromJson(Map<String, dynamic> json) {
    return LeadSubmissionResult(
      success: json['success'] == true,
      submissionId: json['submission_id']?.toString(),
      emailSent: json['email_sent'] is bool ? json['email_sent'] as bool : null,
      emailError: json['email_error']?.toString(),
    );
  }

  final bool success;
  final String? submissionId;
  final bool? emailSent;
  final String? emailError;
}

class LeadRequest {
  const LeadRequest({
    required this.fullName,
    required this.company,
    required this.jobTitle,
    required this.email,
    required this.phone,
    required this.website,
    required this.address,
    required this.offerDescription,
    required this.offerCategories,
    required this.problemsSolved,
    required this.prioritySolutions,
    required this.targetSectors,
    required this.targetCompanyTypes,
    required this.geographyCountries,
    required this.spainCoverage,
    required this.geographyProvinces,
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
    this.pricingQuote,
  });

  final String fullName;
  final String company;
  final String jobTitle;
  final String email;
  final String phone;
  final String website;
  final String address;
  final String offerDescription;
  final List<String> offerCategories;
  final List<String> problemsSolved;
  final String prioritySolutions;
  final List<String> targetSectors;
  final List<String> targetCompanyTypes;
  final List<String> geographyCountries;
  final String? spainCoverage;
  final List<String> geographyProvinces;
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
  final PricingQuote? pricingQuote;

  Map<String, Object?> toJson() {
    final nameParts = fullName
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty)
        .toList(growable: false);
    final firstName = nameParts.isEmpty ? null : nameParts.first;
    final lastName = nameParts.length < 2 ? null : nameParts.skip(1).join(' ');
    final rawSignalTypes = [
      ...investmentSignals,
      ...innovationSignals,
      ...growthSignals,
      ...publicFinanceSignals,
    ];
    final rawTechnologies = prioritySolutions
        .split(RegExp(r'[\n,;]'))
        .map((value) => value.trim())
        .where((value) => value.isNotEmpty)
        .toList(growable: false);
    final sectorCodes = _canonicalCodes(
      targetSectors,
      _sectorCodeByLabel,
      fallbackCode: 'other_sector',
    );
    final targetCompanyTypeCodes = _canonicalCodes(
      targetCompanyTypes,
      _companyTypeCodeByLabel,
      fallbackCode: 'other_company_type',
    );
    final signalTypeCodes = _canonicalCodes(
      rawSignalTypes,
      _signalTypeCodeByLabel,
      fallbackCode: 'other_signal',
    );
    final opportunityAreaCodes = _canonicalCodes(
      commercialNeeds,
      _opportunityAreaCodeByNeed,
    );
    final technologyCodes = _canonicalCodes(
      rawTechnologies,
      _technologyCodeByLabel,
      fallbackCode: rawTechnologies.isEmpty ? null : 'other_technology',
    );
    final geographies = _buildGeographies();
    final frequency = _requestFrequency();
    final submittedAtIso = submittedAt.toIso8601String();
    final scopeEstimate = ResearchScopeCalculator.calculate(
      targetSectors: targetSectors,
      targetCompanyTypes: targetCompanyTypes,
      geographyCountries: geographyCountries,
      spainCoverage: spainCoverage,
      geographyProvinces: geographyProvinces,
      investmentSignals: investmentSignals,
      innovationSignals: innovationSignals,
      growthSignals: growthSignals,
      publicFinanceSignals: publicFinanceSignals,
      commercialNeeds: commercialNeeds,
      currentClients: currentClients,
      idealClients: idealClients,
      watchlistAccounts: watchlistAccounts,
      competitors: competitors,
      excludedCompanies: excludedCompanies,
    );
    final requestExtensions = <String, Object?>{
      'target_revenue_range': targetRevenueRange,
      'target_employee_range': targetEmployeeRange,
      'minimum_opportunity_value': minimumOpportunityValue,
      'target_company_description': targetCompanyDescription,
      'commercial_needs': commercialNeeds,
      'recent_case_description': recentCaseDescription,
      'current_clients': currentClients,
      'ideal_clients': idealClients,
      'watchlist_accounts': watchlistAccounts,
      'competitors': competitors,
      'excluded_companies': excludedCompanies,
      'no_buy_reason': noBuyReason,
      'service_types': serviceTypes,
      'service_comments': serviceComments,
      'taxonomy_labels': {
        'sectors': targetSectors,
        'target_company_types': targetCompanyTypes,
        'signal_types': rawSignalTypes,
        'opportunity_areas': commercialNeeds,
        'technologies': rawTechnologies,
      },
      'research_scope_units': scopeEstimate.units,
      'research_scope_level': scopeEstimate.level,
      'research_scope_model_version': ResearchScopeCalculator.modelVersion,
      if (pricingQuote != null) 'estimated_pricing': pricingQuote!.toJson(),
    };

    return {
      'source': 'induradar_landing',
      'form_version': _webFormVersion,
      'contract_version': _dataContractVersion,
      'execution_contract_version': _executionContractVersion,
      'stack_configuration': _stackConfiguration,
      'intake_metadata': const {
        'normalization_target': _dataContractVersion,
        'submission_id_owner': 'supabase_edge_function_submit_lead',
        'baseline_mode': 'canonical_fresh',
        'canonical_output': 'report_json_lossless',
        'client_default_output': 'light_report',
      },
      'research_scope_units': scopeEstimate.units,
      'research_scope_level': scopeEstimate.level,
      'research_scope_model_version': ResearchScopeCalculator.modelVersion,
      'channel': 'web_form',
      'submitted_at': submittedAtIso,
      if (pricingQuote != null) 'pricing': pricingQuote!.toJson(),
      'contact': {
        'first_name': firstName,
        'last_name': lastName,
        'company_name': company,
        'job_title': _nullIfBlank(jobTitle),
        'email': email,
        'phone': _nullIfBlank(phone),
        'country': null,
        'region_city': _nullIfBlank(address),
        'website': _nullIfBlank(website),
        'linkedin': null,
      },
      'organization_profile': const {
        'company_type': null,
        'employee_range': 'unknown',
        'team_name': null,
      },
      'seller_profile': {
        'generic_supplier_label': offerDescription,
        'offer': offerDescription,
        'value_proposition': null,
        'problems_solved': problemsSolved,
        'industrial_processes': const <String>[],
        'target_buyer_roles': const <String>[],
        'technologies': technologyCodes,
        'minimum_ticket_eur': null,
        'must_have': targetCompanyDescription.trim().isEmpty
            ? const <String>[]
            : <String>[targetCompanyDescription.trim()],
        'exclusions': excludedCompanies,
        'negative_signals': noBuyReason.trim().isEmpty
            ? const <String>[]
            : <String>[noBuyReason.trim()],
        'competitors_or_installed_base': competitors,
        'offer_categories': offerCategories,
        'priority_solutions': prioritySolutions,
        'technologies_free_text': rawTechnologies,
      },
      'request': {
        'title': 'Solicitud de radar comercial - $company',
        'sectors': sectorCodes,
        'target_company_types': targetCompanyTypeCodes,
        'opportunity_areas': opportunityAreaCodes,
        'signal_types': signalTypeCodes,
        'technologies': technologyCodes,
        'geographies': geographies,
        'description': opportunityTriggerDescription,
        'cutoff_date': null,
        'delivery_format': const <String>[],
        'frequency': frequency,
        'neutral_output': true,
        'internal_output_authorized': false,
        'subsectors': const <String>[],
        'capabilities': const <String>[],
      },
      'request_extensions': requestExtensions,
      'privacy': {
        'privacy_notice_accepted': privacyAccepted,
        'commercial_contact_consent': marketingConsent,
        'accepted_at': privacyAccepted ? submittedAtIso : null,
      },
      'first_name': firstName,
      'last_name': lastName,
      'full_name': fullName,
      'company': company,
      'job_title': jobTitle,
      'email': email,
      'phone': phone,
      'website': website,
      'address': address,
      'city_province': address,
      'offer_description': offerDescription,
      'offer': offerDescription,
      'offer_categories': offerCategories,
      'problems_solved': problemsSolved,
      'priority_solutions': prioritySolutions,
      'target_sectors': targetSectors,
      'target_company_types': targetCompanyTypes,
      'geography_countries': geographyCountries,
      'geography_spain_scope': spainCoverage,
      'geography_regions': const <String>[],
      'geography_provinces': geographyProvinces,
      'geography_free_zone': '',
      'target_revenue_range': targetRevenueRange,
      'target_employee_range': targetEmployeeRange,
      'minimum_opportunity_value': minimumOpportunityValue,
      'target_company_description': targetCompanyDescription,
      'investment_capacity_signals': investmentSignals,
      'innovation_product_signals': innovationSignals,
      'organization_growth_signals': growthSignals,
      'public_finance_signals': publicFinanceSignals,
      'signal_types': rawSignalTypes,
      'canonical_sector_codes': sectorCodes,
      'canonical_target_company_type_codes': targetCompanyTypeCodes,
      'canonical_signal_type_codes': signalTypeCodes,
      'canonical_opportunity_area_codes': opportunityAreaCodes,
      'canonical_technology_codes': technologyCodes,
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

  List<Map<String, Object?>> _buildGeographies() {
    final geographies = <Map<String, Object?>>[];

    if (geographyCountries.contains(_spainCountry)) {
      if (spainCoverage == _spainByProvince && geographyProvinces.isNotEmpty) {
        for (final province in geographyProvinces) {
          geographies.add({
            'scope': 'province',
            'country': _spainCountry,
            'region': _provinceAutonomousCommunity[province],
            'province': province,
            'city': null,
            'radius_km': null,
            'free_text': null,
          });
        }
      } else {
        geographies.add({
          'scope': 'country',
          'country': _spainCountry,
          'region': null,
          'province': null,
          'city': null,
          'radius_km': null,
          'free_text': null,
        });
      }
    }

    if (geographyCountries.contains(_portugalCountry)) {
      geographies.add({
        'scope': 'country',
        'country': _portugalCountry,
        'region': null,
        'province': null,
        'city': null,
        'radius_km': null,
        'free_text': null,
      });
    }

    return geographies;
  }

  String _requestFrequency() {
    if (serviceTypes.contains('Revisión semanal')) {
      return 'weekly';
    }
    if (serviceTypes.any(_monthlyServiceTypes.contains)) {
      return 'monthly';
    }
    return 'one_off';
  }
}

String? _nullIfBlank(String value) {
  final trimmed = value.trim();
  return trimmed.isEmpty ? null : trimmed;
}

List<String> _canonicalCodes(
  Iterable<String> labels,
  Map<String, String> codesByLabel, {
  String? fallbackCode,
}) {
  final codes = <String>{};
  for (final label in labels) {
    final code = codesByLabel[label] ?? fallbackCode;
    if (code != null) {
      codes.add(code);
    }
  }
  return codes.toList(growable: false);
}

class ResearchScopeEstimate {
  const ResearchScopeEstimate({required this.units, required this.level});

  final num units;
  final String level;
}

class ResearchScopeCalculator {
  const ResearchScopeCalculator._();

  static const modelVersion = 'InduRadar_Calculadora_Alcance_RU_v1';

  static ResearchScopeEstimate calculate({
    required List<String> targetSectors,
    required List<String> targetCompanyTypes,
    required List<String> geographyCountries,
    required String? spainCoverage,
    required List<String> geographyProvinces,
    required List<String> investmentSignals,
    required List<String> innovationSignals,
    required List<String> growthSignals,
    required List<String> publicFinanceSignals,
    required List<String> commercialNeeds,
    required List<String> currentClients,
    required List<String> idealClients,
    required List<String> watchlistAccounts,
    required List<String> competitors,
    required List<String> excludedCompanies,
    int monitoredProjects = 0,
  }) {
    final total =
        60 +
        _additionalCount(targetSectors) * 10 +
        _additionalCount(targetCompanyTypes) * 3 +
        _geographyUnits(geographyCountries, spainCoverage, geographyProvinces) +
        _uniqueCount(investmentSignals) * 2 +
        _uniqueCount(innovationSignals) * 4 +
        _uniqueCount(growthSignals) * 3 +
        _uniqueCount(publicFinanceSignals) * 3 +
        _uniqueCount(commercialNeeds) * 6 +
        _uniqueCount(currentClients) * 0.5 +
        _uniqueCount(idealClients) * 0.5 +
        _uniqueCount(watchlistAccounts) * 2 +
        _uniqueCount(competitors) * 1.5 +
        _uniqueCount(excludedCompanies) * 0.2 +
        monitoredProjects * 3;
    final rounded = (total * 10).round() / 10;
    final units = rounded == rounded.roundToDouble()
        ? rounded.toInt()
        : rounded;
    final level = units < 100
        ? 'Ligero'
        : units <= 175
        ? 'Medio'
        : units <= 275
        ? 'Amplio'
        : 'Muy amplio';

    return ResearchScopeEstimate(units: units, level: level);
  }

  static int _uniqueCount(Iterable<String> values) {
    return values
        .map((value) => value.trim().toLowerCase())
        .where((value) => value.isNotEmpty)
        .toSet()
        .length;
  }

  static int _additionalCount(Iterable<String> values) {
    final count = _uniqueCount(values);
    return count > 1 ? count - 1 : 0;
  }

  static int _geographyUnits(
    List<String> countries,
    String? spainCoverage,
    List<String> provinces,
  ) {
    final selectedCountries = countries.toSet();
    final hasSpain = selectedCountries.contains(_spainCountry);
    final hasPortugal = selectedCountries.contains(_portugalCountry);

    if (hasSpain && hasPortugal) {
      return 85;
    }
    if (hasPortugal) {
      return 40;
    }
    if (!hasSpain) {
      return 0;
    }
    if (spainCoverage == _spainAll) {
      return 60;
    }
    if (spainCoverage != _spainByProvince || provinces.length <= 1) {
      return 0;
    }

    final autonomousCommunities = provinces
        .map(
          (province) =>
              _provinceAutonomousCommunity[province] ??
              'Provincia desconocida: ${province.toLowerCase()}',
        )
        .toSet();
    return autonomousCommunities.length == 1 ? 15 : 35;
  }
}

const _provinceAutonomousCommunity = <String, String>{
  'A Coruña': 'Galicia',
  'Álava': 'País Vasco',
  'Albacete': 'Castilla-La Mancha',
  'Alicante': 'Comunitat Valenciana',
  'Almería': 'Andalucía',
  'Asturias': 'Asturias',
  'Ávila': 'Castilla y León',
  'Badajoz': 'Extremadura',
  'Barcelona': 'Cataluña',
  'Bizkaia': 'País Vasco',
  'Burgos': 'Castilla y León',
  'Cáceres': 'Extremadura',
  'Cádiz': 'Andalucía',
  'Cantabria': 'Cantabria',
  'Castellón': 'Comunitat Valenciana',
  'Ciudad Real': 'Castilla-La Mancha',
  'Córdoba': 'Andalucía',
  'Cuenca': 'Castilla-La Mancha',
  'Girona': 'Cataluña',
  'Granada': 'Andalucía',
  'Guadalajara': 'Castilla-La Mancha',
  'Gipuzkoa': 'País Vasco',
  'Huelva': 'Andalucía',
  'Huesca': 'Aragón',
  'Illes Balears': 'Illes Balears',
  'Jaén': 'Andalucía',
  'La Rioja': 'La Rioja',
  'Las Palmas': 'Canarias',
  'León': 'Castilla y León',
  'Lleida': 'Cataluña',
  'Lugo': 'Galicia',
  'Madrid': 'Comunidad de Madrid',
  'Málaga': 'Andalucía',
  'Murcia': 'Región de Murcia',
  'Navarra': 'Navarra',
  'Ourense': 'Galicia',
  'Palencia': 'Castilla y León',
  'Pontevedra': 'Galicia',
  'Salamanca': 'Castilla y León',
  'Santa Cruz de Tenerife': 'Canarias',
  'Segovia': 'Castilla y León',
  'Sevilla': 'Andalucía',
  'Soria': 'Castilla y León',
  'Tarragona': 'Cataluña',
  'Teruel': 'Aragón',
  'Toledo': 'Castilla-La Mancha',
  'Valencia': 'Comunitat Valenciana',
  'Valladolid': 'Castilla y León',
  'Zamora': 'Castilla y León',
  'Zaragoza': 'Aragón',
};

const _otherOfferCategoryOption = 'Otra';
const _otherProblemOption = 'Otro';
const _otherSectorOption = 'Otros';
const _otherTargetCompanyTypeOption = 'Otro';
const _otherMinimumValueOption = 'Otro';
const _otherNeedOption = 'Otra';

const _spainCountry = 'España';
const _portugalCountry = 'Portugal';
const _spainAll = 'Toda España';
const _spainByProvince = 'Seleccionar provincias';

const _geographyCountryOptions = [_portugalCountry, _spainCountry];
const _spainCoverageOptions = [_spainAll, _spainByProvince];

const _sectorCodeByLabel = <String, String>{
  'Alimentación y bebidas': 'food_beverage',
  'Química y petroquímica': 'chemicals_petrochemicals',
  'Farmacéutica, biotecnología y cosmética': 'pharma_biotech_cosmetics',
  'Cerámica, vidrio y materiales de construcción':
      'ceramics_glass_building_materials',
  'Automoción y movilidad': 'automotive_mobility',
  'Metal, mecanizado y transformación metálica': 'metal_machining',
  'Maquinaria y bienes de equipo': 'machinery_capital_goods',
  'Plástico, caucho y materiales compuestos': 'plastics_rubber_composites',
  'Papel, cartón, impresión y packaging': 'paper_cardboard_printing_packaging',
  'Textil, calzado y cuero': 'textile_footwear_leather',
  'Madera y mueble': 'wood_furniture',
  'Electrónica y material eléctrico': 'electronics_electrical_equipment',
  'Energía y utilities': 'energy_utilities',
  'Agua, medioambiente y residuos': 'water_environment_waste',
  'Logística, almacenamiento y distribución':
      'logistics_warehousing_distribution',
  'Minería, cemento y minerales': 'mining_cement_minerals',
  'Aeroespacial, ferroviario y naval': 'aerospace_rail_naval',
  'Construcción e infraestructuras': 'construction_infrastructure',
};

const _companyTypeCodeByLabel = <String, String>{
  'Fabricante industrial o planta productiva': 'industrial_manufacturer',
  'Fabricante de maquinaria / OEM': 'machine_builder_oem',
  'Ingeniería, integrador o EPC': 'engineering_integrator_epc',
  'Fabricante de componentes': 'component_manufacturer',
  'Proveedor tecnológico': 'technology_provider',
  'Distribuidor o suministrador industrial': 'industrial_distributor',
  'Mantenimiento o servicios industriales': 'industrial_services_maintenance',
  'Operador logístico': 'logistics_operator',
  'Constructora / infraestructuras': 'construction_infrastructure_company',
  'Consultora': 'consultant',
  'Inversor, fondo o grupo empresarial': 'investor_corporate_group',
  'Administración u organismo público': 'public_administration',
  'Centro tecnológico o de investigación': 'technology_research_center',
};

const _signalTypeCodeByLabel = <String, String>{
  'Nueva fábrica, planta, nave o centro': 'new_factory',
  'Ampliación de instalaciones': 'facility_expansion',
  'Nueva línea de producción': 'new_production_line',
  'Aumento de capacidad': 'capacity_increase',
  'Compra o renovación de maquinaria/equipos': 'machinery_purchase_renewal',
  'Modernización de instalaciones': 'maintenance_modernization',
  'Nueva instalación logística o almacén': 'industrial_real_estate_move',
  'Nuevo producto o gama': 'product_machine_redesign',
  'Nuevo diseño, formato o aplicación': 'product_machine_redesign',
  'Presentación o lanzamiento en feria': 'fair_product_launch',
  'Contratación de perfiles de I+D / ingeniería': 'key_hiring',
  'Nuevo directivo o responsable': 'new_executive',
  'Crecimiento significativo de plantilla': 'key_hiring',
  'Expansión geográfica / internacional': 'international_expansion',
  'Fusión': 'merger_acquisition_ownership_change',
  'Adquisición': 'merger_acquisition_ownership_change',
  'Cambio de propiedad': 'merger_acquisition_ownership_change',
  'Nueva alianza o acuerdo estratégico': 'strategic_partnership',
  'Subvención o ayuda concedida': 'grant_public_aid',
  'Licitación o concurso': 'tender_procurement',
  'Adjudicación': 'tender_procurement',
  'Contrato público': 'tender_procurement',
  'Incentivo fiscal o financiación pública relevante': 'grant_public_aid',
};

const _opportunityAreaCodeByNeed = <String, String>{
  'Maquinaria y automatización': 'machinery_automation',
  'Energía y descarbonización': 'energy_decarbonization',
  'Instalaciones industriales': 'industrial_facilities',
  'Construcción e infraestructuras': 'construction_infrastructure',
  'Logística e intralogística': 'logistics_intralogistics',
  'Mantenimiento industrial': 'industrial_maintenance',
  'Digitalización e Industria 4.0': 'digitalization_industry_4',
  'Calidad, inspección y laboratorio': 'quality_inspection_laboratory',
  'Medioambiente y residuos': 'environment_waste',
  'Seguridad industrial': 'industrial_safety',
  'Packaging y final de línea': 'packaging_end_of_line',
  'Componentes y suministros': 'components_supplies',
  'Ingeniería e integración': 'engineering_integration',
  'Servicios ligados a inversión industrial': 'industrial_investment_services',
  'Inmobiliario industrial': 'industrial_real_estate',
  'Telecomunicaciones e IT industrial': 'industrial_it_telecom',
  'Movilidad industrial y flotas': 'industrial_mobility_fleets',
  'Recursos humanos industriales': 'industrial_human_resources',
  'Limpieza, higiene y servicios auxiliares': 'cleaning_hygiene_auxiliary',
  'Materias primas y consumibles': 'raw_materials_consumables',
};

const _technologyCodeByLabel = <String, String>{
  'Automatización y control': 'automation_control',
  'Automatización industrial': 'automation_control',
  'PLC, HMI y SCADA': 'plc_hmi_scada',
  'Robótica y cobots': 'robotics_cobots',
  'Robótica': 'robotics_cobots',
  'Motion, servos y variadores': 'motion_servos_drives',
  'Visión e inspección': 'machine_vision_inspection',
  'Visión artificial': 'machine_vision_inspection',
  'Seguridad de máquinas y procesos': 'machine_process_safety',
  'Sensórica e instrumentación': 'sensors_instrumentation',
  'Identificación y trazabilidad': 'identification_traceability',
  'IIoT, conectividad y Edge': 'iiot_connectivity_edge',
  'Datos, IA y analítica': 'industrial_data_ai_analytics',
  'Mantenimiento predictivo': 'predictive_maintenance',
  'Gestión energética': 'energy_management',
  'Electrificación y descarbonización': 'electrification_decarbonization',
  'Hidrógeno y nuevas energías': 'hydrogen_new_energy',
  'Intralogística, AGV y AMR': 'agv_amr_intralogistics',
  'Almacenamiento automático': 'automated_storage',
  'Ciberseguridad industrial': 'industrial_cybersecurity',
  'Control de procesos, temperatura y combustión':
      'process_temperature_combustion',
  'Neumática, hidráulica y mecánica': 'pneumatics_hydraulics_mechanics',
  'Componentes eléctricos/electrónicos': 'electrical_electronic_components',
  'Software industrial': 'industrial_software',
  'Ingeniería e integración': 'engineering_integration',
};

const _spanishProvinceOptions = [
  'A Coruña',
  'Álava',
  'Albacete',
  'Alicante',
  'Almería',
  'Asturias',
  'Ávila',
  'Badajoz',
  'Barcelona',
  'Bizkaia',
  'Burgos',
  'Cáceres',
  'Cádiz',
  'Cantabria',
  'Castellón',
  'Ciudad Real',
  'Córdoba',
  'Cuenca',
  'Girona',
  'Granada',
  'Guadalajara',
  'Gipuzkoa',
  'Huelva',
  'Huesca',
  'Illes Balears',
  'Jaén',
  'La Rioja',
  'Las Palmas',
  'León',
  'Lleida',
  'Lugo',
  'Madrid',
  'Málaga',
  'Murcia',
  'Navarra',
  'Ourense',
  'Palencia',
  'Pontevedra',
  'Salamanca',
  'Santa Cruz de Tenerife',
  'Segovia',
  'Sevilla',
  'Soria',
  'Tarragona',
  'Teruel',
  'Toledo',
  'Valencia',
  'Valladolid',
  'Zamora',
  'Zaragoza',
];

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
  'Maquinaria y automatización',
  'Energía y descarbonización',
  'Instalaciones industriales',
  'Construcción e infraestructuras',
  'Logística e intralogística',
  'Mantenimiento industrial',
  'Digitalización e Industria 4.0',
  'Calidad, inspección y laboratorio',
  'Medioambiente y residuos',
  'Seguridad industrial',
  'Packaging y final de línea',
  'Componentes y suministros',
  'Ingeniería e integración',
  'Servicios ligados a inversión industrial',
  'Inmobiliario industrial',
  'Telecomunicaciones e IT industrial',
  'Movilidad industrial y flotas',
  'Recursos humanos industriales',
  'Limpieza, higiene y servicios auxiliares',
  'Materias primas y consumibles',
  _otherNeedOption,
];

const _serviceTypeOptions = [
  'Estudio puntual',
  'Revisión semanal',
  'Revisión mensual',
  'Vigilancia continua de cuentas concretas',
  'Vigilancia de un sector',
  'Vigilancia de una zona geográfica',
  'Monitorización de proyectos concretos',
  'Alertas prioritarias ante cambios relevantes',
];

const _monthlyServiceTypes = <String>{
  'Revisión mensual',
  'Vigilancia continua de cuentas concretas',
  'Vigilancia de un sector',
  'Vigilancia de una zona geográfica',
  'Monitorización de proyectos concretos',
  'Alertas prioritarias ante cambios relevantes',
};
