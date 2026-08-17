import 'package:flutter_test/flutter_test.dart';

import 'package:induradarweb/main.dart';

void main() {
  testWidgets('Landing page renders lead form', (WidgetTester tester) async {
    await tester.pumpWidget(const InduRadarApp());

    expect(find.text('InduRadar'), findsOneWidget);
    expect(find.text('Define tu radar comercial'), findsOneWidget);
    expect(find.text('1 · Tu empresa y tu oferta'), findsOneWidget);
    expect(find.text('2 · Tu empresa objetivo'), findsOneWidget);
    expect(
      find.text('3 · Señales que deben activar una alerta'),
      findsOneWidget,
    );
    expect(find.text('4 · Necesidades y referencias'), findsOneWidget);
    expect(
      find.text('5 · Tipo de investigación y seguimiento'),
      findsOneWidget,
    );
    expect(find.text('Enviar solicitud'), findsOneWidget);
  });
}
