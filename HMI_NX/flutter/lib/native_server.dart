import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'dart:typed_data';

import 'snapshot_store.dart';

typedef PickFile = Future<Map<String, String>?> Function(String kind);
typedef SaveFile = Future<bool> Function(String name, Uint8List bytes);

/// Loopback-only transport shared by every supported WebView implementation.
/// A fresh URL capability and a separate mutation header protect each run.
class NativeServer {
  NativeServer({required this.store, required this.assets, required this.pickFile, required this.saveFile});

  final SnapshotStore store;
  final Map<String, Uint8List> assets;
  final PickFile pickFile;
  final SaveFile saveFile;
  HttpServer? _server;
  bool _dialogBusy = false;
  final String token = base64UrlEncode(List.generate(32, (_) => Random.secure().nextInt(256))).replaceAll('=', '');
  Uri get url => Uri.parse('http://127.0.0.1:${_server!.port}/$token/index.html');

  Future<void> start() async {
    _server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0, shared: false);
    _server!.listen(_handle);
  }

  bool allowsNavigation(String address) {
    if (address == 'about:blank' || address == 'about:srcdoc') return true;
    final uri = Uri.tryParse(address);
    return uri != null && uri.scheme == 'http' && uri.host == '127.0.0.1' && uri.port == url.port && uri.path.startsWith('/$token/');
  }

  Future<void> _handle(HttpRequest request) async {
    final response = request.response;
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('Content-Security-Policy', "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-src 'self' data: blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'");
    try {
      if (request.headers.value(HttpHeaders.hostHeader) != '127.0.0.1:${_server!.port}' || !request.uri.path.startsWith('/$token/')) {
        response.statusCode = HttpStatus.forbidden;
        return;
      }
      final origin = request.headers.value('Origin');
      if (origin != null && origin != url.origin) {
        response.statusCode = HttpStatus.forbidden;
        return;
      }
      final path = request.uri.path.substring(token.length + 2);
      if (path.startsWith('_native/')) {
        if (request.headers.value('X-NX-Offline') != token) {
          response.statusCode = HttpStatus.forbidden;
          return;
        }
        await _api(request, path);
        return;
      }
      if (request.method != 'GET') {
        response.statusCode = HttpStatus.methodNotAllowed;
        return;
      }
      final bytes = assets[path];
      if (bytes == null) {
        response.statusCode = HttpStatus.notFound;
        return;
      }
      if (path == 'index.html') {
        final boot = jsonEncode({'token': token, 'revision': store.revision, 'values': store.values, 'notice': store.recoveryNotice}).replaceAll('<', r'\u003c');
        final html = utf8.decode(bytes).replaceFirst('<head>', '<head><script>window.NX_OFFLINE=$boot;</script>');
        response.headers.contentType = ContentType.html;
        response.write(html);
      } else {
        response.headers.contentType = ContentType('text', path.endsWith('.js') ? 'javascript' : path.endsWith('.css') ? 'css' : 'plain', charset: 'utf-8');
        response.add(bytes);
      }
    } catch (error) {
      response.statusCode = error is StateError ? HttpStatus.conflict : HttpStatus.badRequest;
      response.headers.contentType = ContentType.json;
      response.write(jsonEncode({'error': error.toString()}));
    } finally {
      await response.close();
    }
  }

  Future<Map<String, dynamic>> _body(HttpRequest request) async {
    const maxBytes = 12 * 1024 * 1024;
    if (request.contentLength > maxBytes) throw const FormatException('Archivo demasiado grande');
    final chunks = BytesBuilder(copy: false);
    await for (final chunk in request) {
      chunks.add(chunk);
      if (chunks.length > maxBytes) throw const FormatException('Archivo demasiado grande');
    }
    return Map<String, dynamic>.from(jsonDecode(utf8.decode(chunks.takeBytes())) as Map);
  }

  void _json(HttpRequest request, Object body) {
    request.response.headers.contentType = ContentType.json;
    request.response.write(jsonEncode(body));
  }

  Future<void> _api(HttpRequest request, String path) async {
    if (path == '_native/versions' && request.method == 'GET') {
      _json(request, store.versions());
      return;
    }
    if (path == '_native/version' && request.method == 'GET') {
      _json(request, store.readVersion(request.uri.queryParameters['id'] ?? ''));
      return;
    }
    if (request.method != 'POST') {
      request.response.statusCode = HttpStatus.methodNotAllowed;
      return;
    }
    final data = await _body(request);
    if (path == '_native/storage') {
      final revision = store.setValue(data['key'] as String, data['value'] as String?, data['revision'] as int);
      _json(request, {'revision': revision});
    } else if (path == '_native/pick') {
      if (_dialogBusy) throw StateError('Ya hay un diálogo de archivos abierto');
      final kind = data['kind'];
      if (!{'imageFile', 'varsFile', 'projectFile'}.contains(kind)) throw const FormatException('Importación no permitida');
      _dialogBusy = true;
      try {
        _json(request, {'file': await pickFile(kind as String)});
      } finally {
        _dialogBusy = false;
      }
    } else if (path == '_native/export') {
      if (_dialogBusy) throw StateError('Ya hay un diálogo de archivos abierto');
      final name = (data['name'] as String).replaceAll(RegExp(r'[^A-Za-z0-9_.-]'), '_');
      if (name.isEmpty || name.startsWith('.') || name.length > 180) throw const FormatException('Nombre de archivo no válido');
      final bytes = base64Decode(data['base64'] as String);
      final exports = Directory('${store.directory.path}/exports')..createSync(recursive: true);
      // Preserve every generated export even if the external save dialog is cancelled.
      File('${exports.path}/${DateTime.now().microsecondsSinceEpoch}-$name').writeAsBytesSync(bytes, flush: true);
      _dialogBusy = true;
      try {
        _json(request, {'saved': await saveFile(name, bytes)});
      } finally {
        _dialogBusy = false;
      }
    } else {
      request.response.statusCode = HttpStatus.notFound;
    }
  }

  Future<void> close() async {
    await _server?.close(force: true);
    _server = null;
  }
}
