import 'package:web/web.dart' as web;

bool downloadDemoReport(String assetPath, String fileName) {
  final anchor = web.HTMLAnchorElement()
    ..href = assetPath
    ..download = fileName
    ..target = '_self'
    ..style.display = 'none';

  web.document.body?.append(anchor);
  anchor.click();
  anchor.remove();
  return true;
}
