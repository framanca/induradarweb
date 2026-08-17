import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:induradarweb/main.dart';

const _endpoint =
    'https://example-project.supabase.co/functions/v1/submit-lead';

void main() {
  test(
    'posts the complete lead as JSON and parses a successful response',
    () async {
      late http.Request sentRequest;
      final client = MockClient((request) async {
        sentRequest = request;
        return http.Response(
          jsonEncode({
            'success': true,
            'submission_id': 'submission-123',
            'email_sent': true,
            'email_error': null,
          }),
          201,
        );
      });
      final service = LeadSubmissionService(
        endpoint: _endpoint,
        client: client,
      );

      final result = await service.submit(_leadRequest());

      expect(sentRequest.method, 'POST');
      expect(sentRequest.url.toString(), _endpoint);
      expect(sentRequest.headers['Content-Type'], 'application/json');
      expect(
        sentRequest.headers.keys.map((key) => key.toLowerCase()),
        isNot(contains('authorization')),
      );
      final body = jsonDecode(sentRequest.body) as Map<String, dynamic>;
      expect(body['contact']['company_name'], 'Industria Ejemplo');
      expect(body['seller_profile']['offer'], 'Automatización industrial');
      expect(body['request']['description'], 'Nueva línea de producción.');
      expect(body['request']['geographies'], isNotEmpty);
      expect(body['privacy']['privacy_notice_accepted'], isTrue);
      expect(result.success, isTrue);
      expect(result.submissionId, 'submission-123');
      expect(result.emailSent, isTrue);
    },
  );

  test(
    'treats success true as success when notification email fails',
    () async {
      final service = _serviceReturning({
        'success': true,
        'submission_id': 'submission-456',
        'email_sent': false,
        'email_error': 'Resend unavailable',
      });

      final result = await service.submit(_leadRequest());

      expect(result.success, isTrue);
      expect(result.emailSent, isFalse);
      expect(result.emailError, 'Resend unavailable');
    },
  );

  test('rejects a 2xx response when success is false', () async {
    final service = _serviceReturning({'success': false});

    await expectLater(
      service.submit(_leadRequest()),
      throwsA(
        isA<LeadSubmissionException>().having(
          (error) => error.technicalDetail,
          'technicalDetail',
          contains('success=false'),
        ),
      ),
    );
  });

  test('handles non-2xx responses without exposing the response body', () async {
    final service = LeadSubmissionService(
      endpoint: _endpoint,
      client: MockClient(
        (_) async => http.Response('Internal server error', 500),
      ),
    );

    await expectLater(
      service.submit(_leadRequest()),
      throwsA(
        isA<LeadSubmissionException>()
            .having(
              (error) => error.message,
              'message',
              'No hemos podido enviar la solicitud. Inténtalo de nuevo en unos minutos.',
            )
            .having(
              (error) => error.technicalDetail,
              'technicalDetail',
              contains('HTTP 500'),
            ),
      ),
    );
  });

  test('handles invalid JSON responses', () async {
    final service = LeadSubmissionService(
      endpoint: _endpoint,
      client: MockClient((_) async => http.Response('<html>Error</html>', 200)),
    );

    await expectLater(
      service.submit(_leadRequest()),
      throwsA(
        isA<LeadSubmissionException>().having(
          (error) => error.technicalDetail,
          'technicalDetail',
          contains('invalid JSON'),
        ),
      ),
    );
  });

  test('handles timeouts with a controlled message', () async {
    final service = LeadSubmissionService(
      endpoint: _endpoint,
      timeout: const Duration(milliseconds: 1),
      client: MockClient((_) async {
        await Future<void>.delayed(const Duration(milliseconds: 25));
        return http.Response('{}', 200);
      }),
    );

    await expectLater(
      service.submit(_leadRequest()),
      throwsA(
        isA<LeadSubmissionException>().having(
          (error) => error.message,
          'message',
          contains('ha tardado demasiado'),
        ),
      ),
    );
  });

  test('fails clearly when LEAD_ENDPOINT is empty', () async {
    const service = LeadSubmissionService(endpoint: '');

    await expectLater(
      service.submit(_leadRequest()),
      throwsA(
        isA<LeadSubmissionException>().having(
          (error) => error.technicalDetail,
          'technicalDetail',
          contains('LEAD_ENDPOINT is empty'),
        ),
      ),
    );
  });
}

LeadSubmissionService _serviceReturning(Map<String, Object?> responseBody) {
  return LeadSubmissionService(
    endpoint: _endpoint,
    client: MockClient(
      (_) async => http.Response(jsonEncode(responseBody), 200),
    ),
  );
}

LeadRequest _leadRequest() {
  return LeadRequest(
    fullName: 'Ana Pérez',
    company: 'Industria Ejemplo',
    jobTitle: 'Dirección comercial',
    email: 'ana@example.com',
    phone: '',
    website: 'https://example.com',
    address: 'Castellón',
    offerDescription: 'Automatización industrial',
    offerCategories: const ['Tecnología, automatización y software'],
    problemsSolved: const ['Aumentar productividad o capacidad'],
    prioritySolutions: 'Robótica',
    targetSectors: const ['Maquinaria y bienes de equipo'],
    targetCompanyTypes: const ['Fabricante de maquinaria / OEM'],
    geographyCountries: const ['España'],
    spainCoverage: 'Toda España',
    geographyProvinces: const [],
    targetRevenueRange: '10-50 M€',
    targetEmployeeRange: '101-500 empleados',
    minimumOpportunityValue: '> 25.000 €',
    targetCompanyDescription: 'Fabricantes con ingeniería propia.',
    investmentSignals: const ['Nueva línea de producción'],
    innovationSignals: const [],
    growthSignals: const [],
    publicFinanceSignals: const [],
    commercialNeeds: const ['Necesidad de aumentar capacidad'],
    opportunityTriggerDescription: 'Nueva línea de producción.',
    recentCaseDescription: '',
    currentClients: const [],
    idealClients: const [],
    watchlistAccounts: const [],
    competitors: const [],
    excludedCompanies: const [],
    noBuyReason: '',
    serviceTypes: const ['Estudio puntual'],
    serviceComments: '',
    privacyAccepted: true,
    marketingConsent: false,
    submittedAt: DateTime.utc(2026, 8, 17),
  );
}
