import 'dart:convert';
import 'dart:io';

const latestKey = 'hmi-nx-st:p0:latest:v1';
const historyKey = 'hmi-nx-st:p0:history:v1';
const storageKeys = {latestKey, historyKey};

/// Durable storage independent of the WebView origin, port and browser quota.
/// Memory advances only after the flushed temporary file has been renamed.
class SnapshotStore {
  SnapshotStore(this.directory, {this.maxVersions = 50});

  final Directory directory;
  final int maxVersions;
  Map<String, String> _values = {};
  int revision = 0;
  String? recoveryNotice;
  RandomAccessFile? _lock;
  File get _primary => File('${directory.path}/workspace.json');
  File get _previous => File('${directory.path}/workspace.previous.json');
  Directory get _history => Directory('${directory.path}/versions');
  Map<String, String> get values => Map.unmodifiable(_values);

  void open() {
    directory.createSync(recursive: true);
    _history.createSync(recursive: true);
    _lock = File('${directory.path}/workspace.lock').openSync(mode: FileMode.append);
    try {
      _lock!.lockSync(FileLock.exclusive);
      final candidates = [_primary, _previous, ..._versionFiles()];
      var foundExisting = false;
      for (final file in candidates) {
        if (!file.existsSync()) continue;
        foundExisting = true;
        try {
          final data = _decode(file.readAsStringSync());
          _values = data.$1;
          revision = data.$2;
          if (file.path != _primary.path) {
            recoveryNotice = 'Se ha recuperado la última copia válida. El archivo dañado se conserva.';
            if (_primary.existsSync()) {
              _primary.copySync('${directory.path}/damaged-${DateTime.now().microsecondsSinceEpoch}.json');
            }
            _replace(_primary, _encode(_values, revision));
          }
          return;
        } on FormatException {
          // Never replace damaged user data with a demo or an empty project.
        }
      }
      if (foundExisting) {
        throw const FormatException('No hay una copia válida. Los archivos se han conservado; restaura una copia externa .nxst.');
      }
    } catch (_) {
      close();
      rethrow;
    }
  }

  (Map<String, String>, int) _decode(String text) {
    final data = jsonDecode(text);
    if (data is! Map || data['schema'] != 1 || data['revision'] is! int || data['values'] is! Map) {
      throw const FormatException('Formato de almacenamiento no válido');
    }
    final result = <String, String>{};
    for (final entry in (data['values'] as Map).entries) {
      if (!storageKeys.contains(entry.key) || entry.value is! String) {
        throw const FormatException('Clave de almacenamiento no válida');
      }
      final value = jsonDecode(entry.value as String);
      if (entry.key == latestKey) _checkSnapshot(value);
      if (entry.key == historyKey) {
        if (value is! List) throw const FormatException('Historial no válido');
        for (final snapshot in value) {
          _checkSnapshot(snapshot);
        }
      }
      result[entry.key as String] = entry.value as String;
    }
    return (result, data['revision'] as int);
  }

  void _checkSnapshot(dynamic snapshot) {
    if (snapshot is! Map || snapshot['project'] is! Map || snapshot['savedAt'] is! num) {
      throw const FormatException('Copia de proyecto no válida');
    }
    final project = snapshot['project'] as Map;
    if (project['name'] is! String || project['screens'] is! List || (project['screens'] as List).isEmpty || project['variables'] is! List) {
      throw const FormatException('Proyecto no válido');
    }
  }

  String _encode(Map<String, String> values, int version) =>
      jsonEncode({'schema': 1, 'revision': version, 'values': values});

  void _replace(File target, String data) {
    final pending = File('${target.path}.pending');
    try {
      pending.writeAsStringSync(data, flush: true);
      pending.renameSync(target.path);
    } finally {
      if (pending.existsSync()) pending.deleteSync();
    }
  }

  int setValue(String key, String? value, int expectedRevision) {
    if (_lock == null) throw StateError('Almacenamiento cerrado');
    if (revision != expectedRevision) throw StateError('Otra ventana ha cambiado el proyecto. Vuelve a abrir el editor.');
    if (!storageKeys.contains(key)) throw const FormatException('Clave no permitida');
    final next = Map<String, String>.from(_values);
    if (value == null) {
      next.remove(key);
    } else {
      next[key] = value;
    }
    final payload = _encode(next, revision + 1);
    _decode(payload);
    if (next[key] == _values[key]) return revision;
    if (_primary.existsSync()) {
      final previous = _primary.readAsStringSync();
      _replace(_previous, previous);
      _replace(File('${_history.path}/${DateTime.now().microsecondsSinceEpoch}-$revision.json'), previous);
    }
    _replace(_primary, payload);
    _values = next;
    revision++;
    // Retention errors must not turn an already successful commit into a failure.
    try {
      for (final old in _versionFiles().skip(maxVersions)) {
        old.deleteSync();
      }
    } on FileSystemException {
      // Keep extra versions when deletion is unavailable.
    }
    return revision;
  }

  List<File> _versionFiles() {
    if (!_history.existsSync()) return [];
    final files = _history.listSync().whereType<File>().where((f) => f.path.endsWith('.json')).toList();
    files.sort((a, b) => b.path.compareTo(a.path));
    return files;
  }

  List<Map<String, Object?>> versions() {
    final rows = <Map<String, Object?>>[];
    for (final file in _versionFiles()) {
      try {
        final data = _decode(file.readAsStringSync());
        final raw = data.$1[latestKey];
        if (raw == null) continue;
        final snapshot = jsonDecode(raw) as Map;
        rows.add({
          'id': file.uri.pathSegments.last,
          'name': (snapshot['project'] as Map)['name'],
          'savedAt': snapshot['savedAt'],
          'reason': snapshot['reason'],
        });
      } on FormatException {
        // Preserve the corrupt file but do not offer it for recovery.
      }
    }
    return rows;
  }

  Map<String, dynamic> readVersion(String id) {
    if (!RegExp(r'^\d+-\d+\.json$').hasMatch(id)) {
      throw const FormatException('Versión no válida');
    }
    final values = _decode(File('${_history.path}/$id').readAsStringSync()).$1;
    final raw = values[latestKey];
    if (raw == null) throw const FormatException('Versión sin proyecto');
    return Map<String, dynamic>.from((jsonDecode(raw) as Map)['project'] as Map);
  }

  /// Explicit user recovery after startup fails. Archive every existing main
  /// file before replacing it, and keep the full native version directory.
  void restoreExternal(Map<String, dynamic> project) {
    final snapshot = jsonEncode({'savedAt': DateTime.now().millisecondsSinceEpoch, 'reason': 'recuperacion-externa', 'project': project});
    final payload = _encode({latestKey: snapshot}, 0);
    _decode(payload);
    directory.createSync(recursive: true);
    _lock = File('${directory.path}/workspace.lock').openSync(mode: FileMode.append);
    try {
      _lock!.lockSync(FileLock.exclusive);
      final stamp = DateTime.now().microsecondsSinceEpoch;
      for (final file in [_primary, _previous]) {
        if (file.existsSync()) file.copySync('${file.path}.before-recovery-$stamp');
      }
      _replace(_previous, payload);
      _replace(_primary, payload);
    } finally {
      close();
    }
  }

  void close() {
    final lock = _lock;
    _lock = null;
    if (lock != null) {
      try {
        lock.unlockSync();
      } finally {
        lock.closeSync();
      }
    }
  }
}
