import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:desktop_webview_window/desktop_webview_window.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:path/path.dart' as path;
import 'package:path_provider/path_provider.dart';

import 'native_server.dart';
import 'snapshot_store.dart';

void main(List<String> arguments) {
  WidgetsFlutterBinding.ensureInitialized();
  if (Platform.isLinux && runWebViewTitleBarWidget(arguments)) return;
  runApp(const WebHmiApp());
}

class WebHmiApp extends StatelessWidget {
  const WebHmiApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Omron WebHMI Offline',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(colorSchemeSeed: const Color(0xff2563eb), useMaterial3: true),
        home: const EditorHost(),
      );
}

class EditorHost extends StatefulWidget {
  const EditorHost({super.key});
  @override
  State<EditorHost> createState() => _EditorHostState();
}

class _EditorHostState extends State<EditorHost> with WidgetsBindingObserver {
  NativeServer? _server;
  SnapshotStore? _store;
  WebViewEnvironment? _environment;
  InAppWebViewController? _controller;
  Webview? _linuxView;
  String? _error;
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initialize();
  }

  Future<void> _initialize() async {
    try {
      final support = await getApplicationSupportDirectory();
      final store = SnapshotStore(Directory(path.join(support.path, 'WebHMI-ST')));
      store.open();
      _store = store;
      final assets = <String, Uint8List>{};
      for (final file in ['index.html', 'style.css', 'model.js', 'runtime.js', 'st.js', 'zip.js', 'history.js', 'app.js', 'offline.js', 'offline.css']) {
        final data = await rootBundle.load('assets/editor/$file');
        assets[file] = data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes);
      }
      final server = NativeServer(store: store, assets: assets, pickFile: _pick, saveFile: _save);
      await server.start();
      _server = server;
      if (Platform.isWindows) {
        _environment = await WebViewEnvironment.create(settings: WebViewEnvironmentSettings(userDataFolder: path.join(support.path, 'WebView2')));
      }
      if (!mounted) return;
      setState(() => _ready = true);
      if (Platform.isLinux) await _openLinuxEditor();
    } catch (error) {
      await _server?.close();
      _store?.close();
      if (mounted) setState(() => _error = error.toString());
    }
  }

  Future<Map<String, String>?> _pick(String kind) async {
    final extensions = kind == 'imageFile'
        ? ['png', 'jpg', 'jpeg', 'webp', 'svg']
        : kind == 'varsFile'
            ? ['csv', 'tsv', 'txt']
            : ['nxst', 'json'];
    final result = await FilePicker.platform.pickFiles(type: FileType.custom, allowedExtensions: extensions, withData: true);
    if (result == null || result.files.isEmpty) return null;
    final file = result.files.single;
    if (file.size > 32 * 1024 * 1024) throw const FormatException('El archivo supera 32 MB');
    final bytes = file.bytes ?? await File(file.path!).readAsBytes();
    final mime = switch (file.extension?.toLowerCase()) {
      'png' => 'image/png',
      'jpg' || 'jpeg' => 'image/jpeg',
      'webp' => 'image/webp',
      'svg' => 'image/svg+xml',
      'nxst' || 'json' => 'application/json',
      _ => 'text/plain',
    };
    return {'name': file.name, 'mime': mime, 'base64': base64Encode(bytes)};
  }

  Future<bool> _save(String name, Uint8List bytes) async {
    final selected = await FilePicker.platform.saveFile(dialogTitle: 'Guardar $name', fileName: name, bytes: bytes);
    return selected != null;
  }

  Future<void> _restoreExternal() async {
    try {
      final selected = await _pick('projectFile');
      if (selected == null) return;
      await _server?.close();
      _store?.close();
      _server = null;
      _store = null;
      final project = Map<String, dynamic>.from(jsonDecode(utf8.decode(base64Decode(selected['base64']!))) as Map);
      final support = await getApplicationSupportDirectory();
      final store = SnapshotStore(Directory(path.join(support.path, 'WebHMI-ST')));
      store.restoreExternal(project);
      if (mounted) setState(() { _error = null; _ready = false; });
      await _initialize();
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    }
  }

  Future<void> _openLinuxEditor() async {
    if (_linuxView != null) {
      await _linuxView!.bringToForeground();
      return;
    }
    try {
      final view = await WebviewWindow.create(configuration: const CreateConfiguration(title: 'Omron WebHMI Offline', windowWidth: 1440, windowHeight: 960, titleBarHeight: 0));
      _linuxView = view;
      view.setOnUrlRequestCallback((address) => _server!.allowsNavigation(address));
      view.launch(_server!.url.toString());
      if (mounted) setState(() {});
      unawaited(view.onClose.then((_) {
        _linuxView = null;
        if (mounted) setState(() {});
      }));
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.inactive || state == AppLifecycleState.paused) {
      unawaited(_controller?.evaluateJavascript(source: 'window.NXOfflineEditor?.flush();'));
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    unawaited(_server?.close());
    _store?.close();
    unawaited(_environment?.dispose());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return Scaffold(appBar: AppBar(title: const Text('WebHMI Offline')), body: Padding(padding: const EdgeInsets.all(24), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SelectableText('No se pudo abrir el editor.\n\n$_error\n\nLos proyectos guardados se conservan. En Windows, comprueba que WebView2 Runtime está instalado.'),
        const SizedBox(height: 20),
        FilledButton(onPressed: _restoreExternal, child: const Text('Recuperar desde una copia .nxst')),
      ])));
    }
    if (!_ready) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (Platform.isLinux) {
      return Scaffold(
        appBar: AppBar(title: const Text('Omron WebHMI Offline')),
        body: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.precision_manufacturing, size: 64),
          const SizedBox(height: 16),
          const Text('Editor local · Proyectos guardados en disco'),
          const SizedBox(height: 16),
          FilledButton(onPressed: _openLinuxEditor, child: Text(_linuxView == null ? 'Abrir editor' : 'Mostrar editor')),
          const SizedBox(height: 16),
          const Text('Mantén esta ventana abierta mientras editas.'),
        ])),
      );
    }
    return Scaffold(body: SafeArea(child: InAppWebView(
      webViewEnvironment: _environment,
      initialUrlRequest: URLRequest(url: WebUri(_server!.url.toString())),
      initialSettings: InAppWebViewSettings(javaScriptEnabled: true, useShouldOverrideUrlLoading: true, supportZoom: true, isInspectable: false),
      onWebViewCreated: (controller) => _controller = controller,
      shouldOverrideUrlLoading: (controller, action) async => _server!.allowsNavigation(action.request.url.toString()) ? NavigationActionPolicy.ALLOW : NavigationActionPolicy.CANCEL,
      onJsConfirm: (controller, request) async {
        final accepted = await showDialog<bool>(context: context, builder: (context) => AlertDialog(content: Text(request.message ?? ''), actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Continuar')),
        ]));
        return JsConfirmResponse(handledByClient: true, action: accepted == true ? JsConfirmResponseAction.CONFIRM : JsConfirmResponseAction.CANCEL);
      },
    )));
  }
}
