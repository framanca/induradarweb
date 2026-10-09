import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

// ignore: avoid_relative_lib_imports
import '../lib/native_server.dart';
// ignore: avoid_relative_lib_imports
import '../lib/snapshot_store.dart';

Future<void> main() async => runNativeChecks();

Future<void> runNativeChecks() async {
  final directory = Directory.systemTemp.createTempSync('webhmi-native-test-');
  var checks = 0;
  void check(bool value, String name) {
    if (!value) throw StateError('FAIL: $name');
    checks++;
  }
  Map<String, dynamic> snapshot(String name) => {
    'savedAt': DateTime.now().millisecondsSinceEpoch,
    'project': {'name': name, 'screens': [{'id': 'screen-1', 'name': 'Principal', 'objects': []}], 'variables': []},
    'reason': 'test',
  };
  final store = SnapshotStore(directory, maxVersions: 3)..open();
  NativeServer? server;
  final client = HttpClient();
  try {
    check(store.values.isEmpty, 'first launch is empty');
    store.setValue(latestKey, jsonEncode(snapshot('Proyecto real')), 0);
    store.close();
    store.open();
    check(store.values[latestKey]!.contains('Proyecto real'), 'restart restores project');
    final originalRevision = store.revision;
    try {
      store.setValue(latestKey, jsonEncode(snapshot('stale')), 0);
      throw StateError('A stale writer was accepted');
    } on StateError catch (error) {
      check(error.message.toString().contains('Otra ventana'), 'stale writer rejected');
    }
    check(store.revision == originalRevision, 'stale write cannot advance revision');
    Directory('${directory.path}/workspace.json.pending').createSync();
    try {
      store.setValue(latestKey, jsonEncode(snapshot('No guardar')), store.revision);
      throw StateError('Failed storage was accepted');
    } on FileSystemException {
      check(store.values[latestKey]!.contains('Proyecto real'), 'write failure preserves in-memory state');
      check(store.revision == originalRevision, 'write failure preserves revision');
    }
    Directory('${directory.path}/workspace.json.pending').deleteSync();
    store.close();
    store.open();
    check(store.values[latestKey]!.contains('Proyecto real'), 'write failure preserves disk state');
    for (var i = 0; i < 6; i++) {
      store.setValue(latestKey, jsonEncode(snapshot('Version $i')), store.revision);
    }
    check(store.versions().length == 3, 'bounded native history');
    final version = store.versions().first;
    check(store.readVersion(version['id'] as String)['name'] == 'Version 4', 'native history returns actual previous project');
    try {
      store.readVersion('../../workspace.json');
      throw StateError('Path traversal accepted');
    } on FormatException {
      check(true, 'version path traversal rejected');
    }
    store.close();
    File('${directory.path}/workspace.json').writeAsStringSync('{broken');
    store.open();
    check(store.recoveryNotice != null, 'corrupt primary recovers a valid previous file');
    check(store.values[latestKey]!.contains('Version 4'), 'recovery does not load a demo');
    check(directory.listSync().whereType<File>().any((f) => f.path.contains('damaged-')), 'corrupt file retained');

    server = NativeServer(
      store: store,
      assets: {'index.html': Uint8List.fromList(utf8.encode('<html><head></head><body>editor</body></html>'))},
      pickFile: (_) async => {'name': 'test.nxst', 'mime': 'application/json', 'base64': base64Encode(utf8.encode('{}'))},
      saveFile: (name, bytes) async => false,
    );
    await server.start();
    final native = server;
    Future<(int, String)> request(String route, {String method = 'GET', Map<String, dynamic>? data, bool auth = true, String? origin}) async {
      final req = await client.openUrl(method, native.url.resolve(route));
      if (auth) req.headers.set('X-NX-Offline', native.token);
      if (origin != null) req.headers.set('Origin', origin);
      if (data != null) { req.headers.contentType = ContentType.json; req.write(jsonEncode(data)); }
      final response = await req.close();
      return (response.statusCode, await utf8.decoder.bind(response).join());
    }
    final page = await request('index.html');
    check(page.$1 == 200 && page.$2.contains('NX_OFFLINE'), 'bootstrap injected by real loopback server');
    check((await request('_native/versions', auth: false)).$1 == 403, 'native API rejects missing capability');
    check((await request('_native/versions', origin: 'https://foreign.example')).$1 == 403, 'native API rejects foreign origin');
    check((await request('../index.html')).$1 == 403, 'asset access rejects capability traversal');
    check((await request('_native/storage', method: 'POST', data: {'key': latestKey, 'value': jsonEncode(snapshot('HTTP saved')), 'revision': store.revision})).$1 == 200, 'HTTP save commits synchronously');
    check(store.values[latestKey]!.contains('HTTP saved'), 'HTTP commit writes correct project');
    check((await request('_native/storage', method: 'POST', data: {'key': 'foreign', 'value': '{}', 'revision': store.revision})).$1 == 400, 'foreign storage key rejected');
    check((await request('_native/storage', method: 'POST', data: {'key': latestKey, 'value': 'broken', 'revision': store.revision})).$1 == 400, 'malformed snapshot rejected');
    check(store.values[latestKey]!.contains('HTTP saved'), 'malformed snapshot cannot overwrite project');
    final picked = await request('_native/pick', method: 'POST', data: {'kind': 'projectFile'});
    check(picked.$1 == 200 && picked.$2.contains('test.nxst'), 'native picker returns selected bytes');
    final exported = await request('_native/export', method: 'POST', data: {'name': 'project.nxst', 'base64': base64Encode(utf8.encode('project-bytes'))});
    check(jsonDecode(exported.$2)['saved'] == false, 'cancelled export is reported as cancelled');
    check(Directory('${directory.path}/exports').listSync().whereType<File>().single.readAsStringSync() == 'project-bytes', 'cancelled export still has a durable local copy');
    check(native.allowsNavigation(native.url.toString()), 'local editor navigation allowed');
    for (final url in ['https://example.com', 'file:///etc/passwd', 'mailto:test@example.com', 'javascript:alert(1)', 'data:text/html,<script>']) {
      check(!native.allowsNavigation(url), 'non-editor navigation blocked: $url');
    }
    final damagedDirectory = Directory('${directory.path}/unrecoverable')..createSync();
    File('${damagedDirectory.path}/workspace.json').writeAsStringSync('{broken');
    final damaged = SnapshotStore(damagedDirectory);
    try {
      damaged.open();
      throw StateError('Unrecoverable data was silently replaced');
    } on FormatException {
      check(File('${damagedDirectory.path}/workspace.json').readAsStringSync() == '{broken', 'unrecoverable data stops startup and remains intact');
    }
    damaged.restoreExternal(Map<String, dynamic>.from(snapshot('Recovered externally')['project'] as Map));
    damaged.open();
    check(damaged.values[latestKey]!.contains('Recovered externally'), 'explicit external recovery restores project');
    check(damagedDirectory.listSync().whereType<File>().any((f) => f.path.contains('before-recovery-')), 'external recovery archives damaged original');
    damaged.close();
    stdout.writeln('PASS: $checks native persistence, recovery, file and HTTP checks.');
  } finally {
    client.close(force: true);
    await server?.close();
    store.close();
    directory.deleteSync(recursive: true);
  }
}
