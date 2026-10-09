import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
// ignore: avoid_relative_lib_imports
import '../lib/native_server.dart';
// ignore: avoid_relative_lib_imports
import '../lib/snapshot_store.dart';

Future<void> main(List<String> args) async {
  final directory = Directory(args[0]);
  final store = SnapshotStore(directory)..open();
  final assets = <String, Uint8List>{};
  for (final file in Directory('assets/editor').listSync().whereType<File>()) {
    assets[file.uri.pathSegments.last] = file.readAsBytesSync();
  }
  final server = NativeServer(store: store, assets: assets,
    pickFile: (kind) async {
      final name = kind == 'varsFile' ? 'variables.tsv' : kind == 'imageFile' ? 'image.png' : 'import.nxst';
      final file = File('${directory.path}/$name');
      return {'name': name, 'mime': kind == 'imageFile' ? 'image/png' : 'application/json', 'base64': base64Encode(file.readAsBytesSync())};
    },
    saveFile: (name, bytes) async { File('${directory.path}/$name').writeAsBytesSync(bytes, flush: true); return true; },
  );
  await server.start();
  File('${directory.path}/url.txt').writeAsStringSync(server.url.toString());
  await stdin.first;
  await server.close();
  store.close();
}
