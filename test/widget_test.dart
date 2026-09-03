import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';

import 'package:induradarweb/main.dart';
import 'package:induradarweb/pricing.dart';

final _testPricingCatalog = PricingCatalog.fromJsonString(
  File(PricingCatalog.assetPath).readAsStringSync(),
);

void _setTestViewSize(WidgetTester tester, Size size) {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });
}

void main() {
  testWidgets('Landing page renders lead form', (WidgetTester tester) async {
    await tester.pumpWidget(const InduRadarApp());

    expect(
      find.text('Convierte cambios industriales en oportunidades comerciales'),
      findsOneWidget,
    );
    expect(find.text('Define tu radar comercial'), findsOneWidget);
    expect(find.text('1. ¿Qué vendes?'), findsOneWidget);
    expect(find.text('2. ¿Qué empresas buscas?'), findsOneWidget);
    expect(find.text('3. ¿Qué cambios quieres detectar?'), findsOneWidget);
    expect(find.text('4. ¿Qué oportunidades te interesan?'), findsOneWidget);
    expect(
      find.text('5. ¿Cómo quieres recibir los resultados?'),
      findsOneWidget,
    );
    expect(find.text('Definir mi radar comercial'), findsNWidgets(2));
    expect(
      find.text('Así convierte InduRadar varias señales en una oportunidad'),
      findsOneWidget,
    );
  });

  testWidgets(
    'Desktop aligns the form with the brand and enlarges step titles',
    (WidgetTester tester) async {
      _setTestViewSize(tester, const Size(1400, 1000));
      await tester.pumpWidget(
        MaterialApp(home: LandingPage(pricingCatalog: _testPricingCatalog)),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const ValueKey('landing-hero-wide')), findsOneWidget);
      expect(find.byKey(const ValueKey('landing-hero-narrow')), findsNothing);
      final brandTop = tester
          .getTopLeft(find.byKey(const ValueKey('brand-header')))
          .dy;
      final formTop = tester
          .getTopLeft(find.byKey(const ValueKey('lead-form-panel')))
          .dy;
      expect(formTop, closeTo(brandTop, 0.1));

      final brandBounds = tester.getRect(
        find.byKey(const ValueKey('brand-header')),
      );
      final logoBounds = tester.getRect(
        find.byKey(const ValueKey('brand-logo')),
      );
      expect(logoBounds.center.dx, closeTo(brandBounds.center.dx, 0.1));

      final firstStepTitle = tester.widget<Text>(find.text('1. ¿Qué vendes?'));
      expect(firstStepTitle.style?.fontSize, greaterThanOrEqualTo(20));
    },
  );

  testWidgets('Illustrative example combines signals into an opportunity', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const InduRadarApp());
    final example = find.byKey(const ValueKey('opportunity-example-card'));

    for (final text in [
      'Nueva línea automatizada y ampliación de capacidad',
      'Ayuda pública',
      'Permiso / licencia',
      'Contratación',
      'Comunicación corporativa',
      'Lectura InduRadar',
      'Necesidad probable',
      'Confianza',
      'Ventana probable',
      'Siguiente acción',
    ]) {
      expect(
        find.descendant(of: example, matching: find.text(text)),
        findsOneWidget,
      );
    }
    expect(
      find.descendant(of: example, matching: find.text('4')),
      findsOneWidget,
    );
    expect(
      find.descendant(of: example, matching: find.text('3–9 meses')),
      findsOneWidget,
    );
  });

  testWidgets('Form sections behave as an exclusive accordion', (
    WidgetTester tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(1400, 1000));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(const InduRadarApp());
    await tester.pumpAndSettle();

    double sectionHeightFactor(String id) {
      return tester
          .widget<Align>(find.byKey(ValueKey('form-section-body-$id')))
          .heightFactor!;
    }

    expect(sectionHeightFactor('company-offer'), 0);
    expect(sectionHeightFactor('target-company'), 0);
    expect(sectionHeightFactor('signals'), 0);
    expect(sectionHeightFactor('needs'), 0);
    expect(sectionHeightFactor('service'), 0);

    await tester.ensureVisible(
      find.byKey(const ValueKey('form-section-header-target-company')),
    );
    await tester.tap(
      find.byKey(const ValueKey('form-section-header-target-company')),
    );
    await tester.pumpAndSettle();

    expect(sectionHeightFactor('company-offer'), 0);
    expect(sectionHeightFactor('target-company'), 1);
    expect(sectionHeightFactor('signals'), 0);

    final targetHeaderTop = tester
        .getTopLeft(
          find.byKey(const ValueKey('form-section-header-target-company')),
        )
        .dy;
    final firstLineTop = tester.getTopLeft(find.text('Sectores objetivo')).dy;
    expect(targetHeaderTop, inInclusiveRange(0, 60));
    expect(firstLineTop, greaterThan(targetHeaderTop));
    expect(firstLineTop, lessThan(260));
  });

  testWidgets('Company section starts with offer and required contact fields', (
    WidgetTester tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(1400, 1000));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(const InduRadarApp());
    await tester.pumpAndSettle();

    final offer = find.text('¿Qué ofrece tu empresa? *');
    final fullName = find.text('Nombre y apellidos *');
    final company = find.text('Empresa *');
    final email = find.text('Email profesional *');

    expect(offer, findsOneWidget);
    expect(fullName, findsOneWidget);
    expect(company, findsOneWidget);
    expect(email, findsOneWidget);
    expect(
      tester.getTopLeft(offer).dy,
      lessThan(tester.getTopLeft(fullName).dy),
    );
    expect(
      tester.getTopLeft(fullName).dy,
      lessThan(tester.getTopLeft(company).dy),
    );
    expect(
      tester.getTopLeft(company).dy,
      lessThan(tester.getTopLeft(email).dy),
    );
  });

  testWidgets('Price reacts to sectors and provinces by service type', (
    WidgetTester tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(1400, 1000));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      MaterialApp(home: LandingPage(pricingCatalog: _testPricingCatalog)),
    );
    await tester.pumpAndSettle();

    expect(find.text('Desde 49,5 €'), findsOneWidget);
    expect(find.text('49,5 €'), findsOneWidget);
    expect(find.text('Estudio puntual · pago único'), findsOneWidget);
    expect(find.textContaining('RU estimadas'), findsNothing);

    await tester.ensureVisible(
      find.byKey(const ValueKey('form-section-header-target-company')),
    );
    await tester.tap(
      find.byKey(const ValueKey('form-section-header-target-company')),
    );
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.widgetWithText(CheckboxListTile, 'España'));
    await tester.tap(find.widgetWithText(CheckboxListTile, 'España'));
    await tester.pumpAndSettle();

    expect(find.text('113,25 €'), findsOneWidget);
    expect(find.textContaining('RU estimadas'), findsNothing);

    await tester.ensureVisible(
      find.byKey(const ValueKey('form-section-header-service')),
    );
    await tester.tap(find.byKey(const ValueKey('form-section-header-service')));
    await tester.pumpAndSettle();
    final weekly = find.widgetWithText(CheckboxListTile, 'Revisión semanal');
    await tester.ensureVisible(weekly);
    await tester.tap(weekly);
    await tester.pumpAndSettle();

    expect(find.text('56,88 €/mes'), findsOneWidget);
    expect(find.text('Revisión semanal · cuota mensual'), findsOneWidget);
    expect(find.text('Estudio puntual · pago único'), findsNothing);

    final oneOff = find.widgetWithText(CheckboxListTile, 'Estudio puntual');
    await tester.ensureVisible(oneOff);
    await tester.tap(oneOff);
    await tester.pumpAndSettle();

    expect(find.text('113,25 €'), findsOneWidget);
    expect(find.text('56,88 €/mes'), findsOneWidget);
    expect(find.text('Estudio puntual · pago único'), findsOneWidget);
    expect(find.text('Revisión semanal · cuota mensual'), findsOneWidget);
  });

  testWidgets('Landing page fits a mobile viewport without layout errors', (
    WidgetTester tester,
  ) async {
    _setTestViewSize(tester, const Size(390, 844));
    await tester.pumpWidget(
      MaterialApp(home: LandingPage(pricingCatalog: _testPricingCatalog)),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    for (final finder in [
      find.text('Define tu radar comercial'),
      find.byKey(const ValueKey('pricing-entry-price')),
      find.byKey(const ValueKey('pricing-summary')),
    ]) {
      final rect = tester.getRect(finder);
      expect(rect.left, greaterThanOrEqualTo(20));
      expect(rect.right, lessThanOrEqualTo(370));
    }
  });

  testWidgets('Completed sections expose their status', (
    WidgetTester tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(1400, 1000));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(const InduRadarApp());
    await tester.pumpAndSettle();

    await tester.enterText(
      find.widgetWithText(TextFormField, '¿Qué ofrece tu empresa? *'),
      'Automatización industrial',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Nombre y apellidos *'),
      'Ana Pérez',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Empresa *'),
      'Industria Ejemplo',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Email profesional *'),
      'ana@example.com',
    );

    await tester.ensureVisible(
      find.byKey(const ValueKey('form-section-header-target-company')),
    );
    await tester.tap(
      find.byKey(const ValueKey('form-section-header-target-company')),
    );
    await tester.pumpAndSettle();

    expect(
      find.descendant(
        of: find.byKey(const ValueKey('form-section-header-company-offer')),
        matching: find.text('Completo'),
      ),
      findsOneWidget,
    );
    expect(find.text('Paso 2 de 5'), findsOneWidget);
  });

  testWidgets('Selecting Spain defaults to all of Spain', (
    WidgetTester tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(1400, 1000));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(const InduRadarApp());
    await tester.pumpAndSettle();

    await tester.ensureVisible(
      find.byKey(const ValueKey('form-section-header-target-company')),
    );
    await tester.tap(
      find.byKey(const ValueKey('form-section-header-target-company')),
    );
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.widgetWithText(CheckboxListTile, 'España'));
    await tester.tap(find.widgetWithText(CheckboxListTile, 'España'));
    await tester.pumpAndSettle();

    final coverageGroup = tester.widget<RadioGroup<String>>(
      find
          .descendant(
            of: find.byKey(const ValueKey('form-section-body-target-company')),
            matching: find.byType(RadioGroup<String>),
          )
          .first,
    );
    expect(coverageGroup.groupValue, 'Toda España');
  });

  testWidgets('Section two requires a sector and a company type', (
    WidgetTester tester,
  ) async {
    _setTestViewSize(tester, const Size(1400, 1000));
    await tester.pumpWidget(
      MaterialApp(home: LandingPage(pricingCatalog: _testPricingCatalog)),
    );
    await tester.pumpAndSettle();

    await tester.enterText(
      find.widgetWithText(TextFormField, '¿Qué ofrece tu empresa? *'),
      'Automatización industrial',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Nombre y apellidos *'),
      'Ana Pérez',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Empresa *'),
      'Industria Ejemplo',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Email profesional *'),
      'ana@example.com',
    );

    await tester.ensureVisible(
      find.byKey(const ValueKey('form-section-header-service')),
    );
    await tester.tap(find.byKey(const ValueKey('form-section-header-service')));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const ValueKey('primary-form-cta')));
    await tester.tap(find.byKey(const ValueKey('primary-form-cta')));
    await tester.pumpAndSettle();

    expect(find.text('Paso 2 de 5'), findsOneWidget);
    expect(
      find.text('Selecciona al menos un sector objetivo.'),
      findsOneWidget,
    );
    expect(
      find.text('Selecciona al menos un tipo de empresa objetivo.'),
      findsOneWidget,
    );
  });

  testWidgets('Sections three and four select standard options by default', (
    WidgetTester tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(1400, 1000));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(const InduRadarApp());
    await tester.pumpAndSettle();

    await tester.ensureVisible(
      find.byKey(const ValueKey('form-section-header-signals')),
    );
    await tester.tap(find.byKey(const ValueKey('form-section-header-signals')));
    await tester.pumpAndSettle();
    final signalCheckboxes = tester
        .widgetList<CheckboxListTile>(
          find.descendant(
            of: find.byKey(const ValueKey('form-section-body-signals')),
            matching: find.byType(CheckboxListTile),
          ),
        )
        .toList(growable: false);
    expect(signalCheckboxes, isNotEmpty);
    expect(
      signalCheckboxes.every((checkbox) => checkbox.value == true),
      isTrue,
    );
    expect(
      tester
          .widget<CheckboxListTile>(
            find.widgetWithText(
              CheckboxListTile,
              'Nueva fábrica, planta, nave o centro',
            ),
          )
          .value,
      isTrue,
    );
    expect(
      tester
          .widget<CheckboxListTile>(
            find.widgetWithText(
              CheckboxListTile,
              'Subvención o ayuda concedida',
            ),
          )
          .value,
      isTrue,
    );

    await tester.ensureVisible(
      find.byKey(const ValueKey('form-section-header-needs')),
    );
    await tester.tap(find.byKey(const ValueKey('form-section-header-needs')));
    await tester.pumpAndSettle();
    final needCheckboxes = tester
        .widgetList<CheckboxListTile>(
          find.descendant(
            of: find.byKey(const ValueKey('form-section-body-needs')),
            matching: find.byType(CheckboxListTile),
          ),
        )
        .toList(growable: false);
    expect(
      needCheckboxes.where((checkbox) => checkbox.value == false),
      hasLength(1),
    );
    expect(
      tester
          .widget<CheckboxListTile>(
            find.widgetWithText(
              CheckboxListTile,
              'Maquinaria y automatización',
            ),
          )
          .value,
      isTrue,
    );
    expect(
      tester
          .widget<CheckboxListTile>(
            find.descendant(
              of: find.byKey(const ValueKey('form-section-body-needs')),
              matching: find.widgetWithText(CheckboxListTile, 'Otra'),
            ),
          )
          .value,
      isFalse,
    );
  });

  testWidgets('Reference account fields explain their research purpose', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const InduRadarApp());

    expect(
      find.text('Clientes actuales para buscar perfiles similares (opcional)'),
      findsOneWidget,
    );
    expect(
      find.text(
        'Clientes ideales: clientes de la competencia a seguir (opcional)',
      ),
      findsOneWidget,
    );
    expect(
      find.text('Cuentas estratégicas para búsqueda especializada (opcional)'),
      findsOneWidget,
    );
  });

  testWidgets('Privacy choices are inside step five', (
    WidgetTester tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(1400, 1000));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(const InduRadarApp());
    await tester.pumpAndSettle();

    final serviceBody = find.byKey(const ValueKey('form-section-body-service'));
    expect(
      find.descendant(
        of: serviceBody,
        matching: find.text('Política de privacidad.'),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: serviceBody,
        matching: find.text(
          'Quiero recibir novedades y comunicaciones de InduRadar.',
        ),
      ),
      findsOneWidget,
    );
  });

  testWidgets('Required privacy keeps marketing consent optional', (
    WidgetTester tester,
  ) async {
    final submissionService = _RecordingSubmissionService();
    await tester.binding.setSurfaceSize(const Size(1400, 1000));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      MaterialApp(
        home: LandingPage(
          submissionService: submissionService,
          pricingCatalog: _testPricingCatalog,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(
      find.widgetWithText(TextFormField, '¿Qué ofrece tu empresa? *'),
      'Automatización industrial',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Nombre y apellidos *'),
      'Ana Pérez',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Empresa *'),
      'Industria Ejemplo',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Email profesional *'),
      'ana@example.com',
    );

    await tester.ensureVisible(
      find.byKey(const ValueKey('form-section-header-target-company')),
    );
    await tester.tap(
      find.byKey(const ValueKey('form-section-header-target-company')),
    );
    await tester.pumpAndSettle();
    await tester.ensureVisible(
      find.widgetWithText(CheckboxListTile, 'Portugal'),
    );
    await tester.tap(find.widgetWithText(CheckboxListTile, 'Portugal'));
    await tester.pump();
    final sector = find.widgetWithText(
      CheckboxListTile,
      'Alimentación y bebidas',
    );
    await tester.ensureVisible(sector);
    await tester.tap(sector);
    await tester.pump();
    final companyType = find.widgetWithText(
      CheckboxListTile,
      'Fabricante industrial o planta productiva',
    );
    await tester.ensureVisible(companyType);
    await tester.tap(companyType);
    await tester.pump();

    await tester.ensureVisible(
      find.byKey(const ValueKey('form-section-header-needs')),
    );
    await tester.tap(find.byKey(const ValueKey('form-section-header-needs')));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(
        TextFormField,
        'Describe una oportunidad comercial que justificaría una acción de tu equipo de ventas *',
      ),
      'Una nueva línea de producción.',
    );

    await tester.ensureVisible(
      find.byKey(const ValueKey('form-section-header-service')),
    );
    await tester.tap(find.byKey(const ValueKey('form-section-header-service')));
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.byKey(const ValueKey('primary-form-cta')));
    await tester.tap(find.byKey(const ValueKey('primary-form-cta')));
    await tester.pumpAndSettle();
    expect(submissionService.request, isNull);
    expect(
      find.text('Necesitamos tu consentimiento para responderte.'),
      findsOneWidget,
    );

    final privacyCheckbox = find.ancestor(
      of: find.text('He leído y acepto la '),
      matching: find.byType(CheckboxListTile),
    );
    await tester.ensureVisible(privacyCheckbox);
    await tester.tap(privacyCheckbox);
    await tester.pump();

    await tester.ensureVisible(find.byKey(const ValueKey('primary-form-cta')));
    await tester.tap(find.byKey(const ValueKey('primary-form-cta')));
    await tester.pumpAndSettle();

    expect(submissionService.request, isNotNull);
    expect(submissionService.request!.privacyAccepted, isTrue);
    expect(submissionService.request!.marketingConsent, isFalse);
    expect(submissionService.submissionCount, 1);
    final submittedJson = submissionService.request!.toJson();
    expect(submittedJson['research_scope_units'], isA<num>());
    expect(submittedJson['pricing'], isA<Map<String, Object?>>());
    expect(submittedJson['form_version'], '3.13.1');
    expect(submittedJson['contract_version'], '1.3.2');
    expect(
      (submittedJson['pricing'] as Map<String, Object?>)['pricing_model'],
      'transparent_scope_v2',
    );
    expect(
      (submittedJson['pricing'] as Map<String, Object?>)['line_items'],
      isNotEmpty,
    );
    expect(
      find.textContaining('Solicitud recibida correctamente.'),
      findsOneWidget,
    );
    expect(
      tester
          .widget<TextFormField>(
            find.widgetWithText(TextFormField, 'Empresa *'),
          )
          .controller!
          .text,
      'Industria Ejemplo',
    );

    final formLock = tester.widget<AbsorbPointer>(
      find.byKey(const ValueKey('submitted-form-lock')),
    );
    expect(formLock.absorbing, isTrue);

    final submitButton = tester.widget<FilledButton>(
      find.byKey(const ValueKey('primary-form-cta')),
    );
    expect(submitButton.onPressed, isNull);
    expect(find.text('Generar nueva solicitud'), findsOneWidget);

    await tester.ensureVisible(find.byKey(const ValueKey('new-request-cta')));
    await tester.tap(find.byKey(const ValueKey('new-request-cta')));
    await tester.pumpAndSettle();

    expect(
      find.textContaining('Solicitud recibida correctamente.'),
      findsNothing,
    );
    expect(
      tester
          .widget<TextFormField>(
            find.widgetWithText(TextFormField, 'Empresa *'),
          )
          .controller!
          .text,
      isEmpty,
    );
    expect(
      tester
          .widget<AbsorbPointer>(
            find.byKey(const ValueKey('submitted-form-lock')),
          )
          .absorbing,
      isFalse,
    );
    expect(
      tester
          .widget<FilledButton>(find.byKey(const ValueKey('primary-form-cta')))
          .onPressed,
      isNotNull,
    );
    expect(
      tester
          .widget<CheckboxListTile>(
            find.widgetWithText(
              CheckboxListTile,
              'Nueva fábrica, planta, nave o centro',
            ),
          )
          .value,
      isTrue,
    );
    expect(
      tester
          .widget<CheckboxListTile>(
            find.widgetWithText(
              CheckboxListTile,
              'Maquinaria y automatización',
            ),
          )
          .value,
      isTrue,
    );
    expect(
      tester
          .widget<CheckboxListTile>(
            find.descendant(
              of: find.byKey(const ValueKey('form-section-body-needs')),
              matching: find.widgetWithText(CheckboxListTile, 'Otra'),
            ),
          )
          .value,
      isFalse,
    );
  });

  testWidgets('Final CTA scrolls back to the lead form', (
    WidgetTester tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(1400, 1000));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(const InduRadarApp());
    await tester.pumpAndSettle();

    final finalCta = find.byKey(const ValueKey('final-form-cta'));
    await tester.ensureVisible(finalCta);
    await tester.tap(finalCta);
    await tester.pumpAndSettle();

    final formTitlePosition = tester.getTopLeft(
      find.text('Define tu radar comercial'),
    );
    expect(formTitlePosition.dy, greaterThanOrEqualTo(-2));
    expect(formTitlePosition.dy, lessThan(200));
  });
}

class _RecordingSubmissionService extends LeadSubmissionService {
  LeadRequest? request;
  int submissionCount = 0;

  @override
  Future<LeadSubmissionResult> submit(LeadRequest request) async {
    this.request = request;
    submissionCount += 1;
    return const LeadSubmissionResult(
      success: true,
      submissionId: 'test-submission-id',
      emailSent: false,
      emailError: 'Email intentionally disabled in widget tests.',
    );
  }
}
