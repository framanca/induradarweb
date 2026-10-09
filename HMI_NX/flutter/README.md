# Omron WebHMI Offline · Flutter

Aplicación para Windows, macOS, Linux, iOS y Android. Incluye el editor actual de `HMI_NX_ST` y permite diseñar, previsualizar, abrir proyectos y exportar el programa Sysmac sin conexión a Internet.

La interfaz del editor sigue siendo HTML/JavaScript, empaquetada como recursos dentro de una aplicación Flutter. No descarga el editor desde una web. Flutter se ocupa del alojamiento local, los archivos, el almacenamiento duradero y los diálogos del sistema. No se presenta como una reescritura de los widgets en Dart.

## Funcionalidad

- Pantallas, variables Sysmac, imágenes OFF/ON, alarmas y recetas del editor ST actual.
- Todos sus widgets: texto, estado, valor, entrada, botón, barra, slider, switch, selector, multestado, gauge, ajuste +/−, contador, desplegable, imagen y depósito.
- Copiar/pegar mediante teclado, menú contextual y botones accesibles desde móvil. Deshacer/rehacer y vista previa local.
- Abrir y guardar `.nxst`; importar variables CSV/TSV/TXT e imágenes mediante diálogos nativos.
- Exportar el mismo ZIP Sysmac con ST, variables y HTML embebido.
- Autoguardado en disco, restauración al arrancar, copia anterior y hasta 50 versiones nativas. La demo solo se carga explícitamente.
- Herramientas, lienzo y propiedades accesibles mediante pestañas en pantallas pequeñas.

El alcance es **el editor ST actual**. El editor histórico `HMI_NX` tiene otro contrato de proyecto y no forma parte de esta app. No se añaden funciones del PLC ni se cambia el transporte de la HMI exportada. Editar y generar el ZIP no requiere PLC, nube, cuenta ni conexión a Internet. Para operar la HMI generada se necesita la red local y el programa correspondiente en el PLC.

## Preparar y ejecutar

Recomendado: Flutter **3.47.7 estable**, incluido en el flujo de compilación. Las dependencias están fijadas en `pubspec.lock`.

Desde la raíz del repositorio:

```bash
cd HMI_NX/flutter
python3 tool/sync_editor.py
flutter pub get
flutter analyze
flutter test
flutter run -d windows  # o macos, linux, un dispositivo Android o un iPhone
```

En Windows, `python tool/sync_editor.py` sirve si `python3` no está disponible. Los recursos ya están incluidos en el repositorio; el sincronizador solo es necesario al actualizar el editor ST.

El sincronizador copia los archivos actuales del editor y aplica los adaptadores únicamente a su copia offline. Si cambian los puntos de integración, se detiene para que se revise el adaptador. `assets/editor/source-manifest.json` registra las huellas de los originales.

## Compilar

| Destino | Máquina de compilación | Comando |
| --- | --- | --- |
| Windows | Windows con Visual Studio y C++ de escritorio | `flutter build windows --release` |
| macOS | Mac con Xcode | `flutter build macos --release` |
| Linux | Linux con GTK y WebKitGTK 4.1 | `flutter build linux --release` |
| Android | Android SDK y Java 17 | `flutter build apk --release` |
| iOS simulador | Mac con Xcode | `flutter build ios --simulator --no-codesign` |
| iOS dispositivo | Mac con Xcode y firma de Apple configurada | `flutter build ipa --release` |

En Windows se requiere NuGet para compilar el plugin y **WebView2 Runtime** en el equipo que ejecuta la aplicación. WebView2 es un componente instalado: el editor no accede a la web. Para una instalación completamente desconectada, instala primero WebView2 desde su instalador offline.

En Ubuntu/Debian, preparar Linux con:

```bash
sudo apt-get install clang cmake ninja-build pkg-config libgtk-3-dev libwebkit2gtk-4.1-dev libsoup-3.0-dev
```

Android usa API mínima 24 (Android 7). El build fija AGP 8.13.2, Gradle 8.14.3 y Kotlin 2.3.0 para mantener la compatibilidad con el plugin WebView estable (AGP 9 retira una configuración ProGuard que todavía utiliza ese plugin). iOS usa versión mínima 15 y macOS versión mínima 12. Las plataformas Apple requieren Xcode y CocoaPods. Los permisos de red de la app sirven para su servidor **127.0.0.1**, nunca expuesto a la LAN. Los diálogos de archivos de macOS tienen el permiso de archivos seleccionados por el usuario.

En Linux, el editor se abre en una ventana WebKitGTK propia. La ventana Flutter inicial mantiene el servidor local: debe permanecer abierta mientras se edita. En las otras cuatro plataformas, el editor está integrado dentro de la ventana Flutter.

El workflow `.github/workflows/webhmi-flutter.yml` ejecuta análisis/pruebas y compila los cinco destinos. Sus artefactos contienen el paquete Windows completo, la app macOS, el bundle Linux, el APK y una app para el simulador iOS. No son instaladores firmados para todas las tiendas. La firma/notarización de Apple y la firma de distribución Android se configuran antes de publicar una versión comercial.

## Proyectos y recuperación

Los datos se guardan en el directorio de soporte de la aplicación, dentro de `WebHMI-ST/`:

```text
workspace.json                 Proyecto y copias del editor
workspace.previous.json        Estado anterior válido
versions/                      Hasta 50 versiones nativas
exports/                       Copias de cada exportación generada
damaged-*.json                  Originales retenidos cuando hay corrupción
```

El estado se escribe en un archivo temporal, se vacía a disco y se renombra antes de confirmar el guardado al editor. Una revisión evita que una ventana antigua sobrescriba un estado más reciente. La exclusión de archivos limita la app a una instancia por directorio de proyectos.

Si el archivo principal está dañado se busca una copia válida, conservando el original. Si no queda ninguna copia válida, la app detiene el arranque; el botón **Recuperar desde una copia .nxst** permite restaurar una copia externa sin borrar los originales dañados. **Versiones en disco** permite recuperar estados anteriores desde el editor.

Una desinstalación o la eliminación manual de datos de la app puede borrar esos archivos. Guarda `.nxst` externos para tus copias de seguridad y para pasar proyectos entre equipos. Se mantiene la protección del editor antes de borrar o sustituir proyectos. Cancelar un diálogo externo no se anuncia como un guardado externo exitoso; el paquete generado permanece también en `exports/`.

## Validación

```bash
# Desde la raíz del repositorio:
node --test HMI_NX_ST/tests/*.test.cjs

cd HMI_NX/flutter
dart tool/verify_native.dart
flutter analyze
flutter test

# Integración con Chromium y el servidor Dart real:
python3 -m pip install playwright==1.57.0
python3 -m playwright install chromium
python3 tool/verify_browser.py
```

`verify_native.dart` verifica reinicios, fallo de escritura, recuperación de corrupción, retención, conflictos de revisión, importaciones/exportaciones y rechazo de accesos ajenos al editor. `verify_browser.py` verifica edición, deshacer/rehacer, restauración con otro proceso y puerto, formatos de archivos reales y acceso a propiedades desde móvil. Los resultados y capturas se producen en `test-results/`.

Las pruebas de modelo y almacenamiento no equivalen a validación en los cinco dispositivos reales. Mantener la validación en NX de cada evolución del HTML/ST exportado.

El CMake de Windows incluye una compatibilidad acotada al plugin WebView para el encabezado de corutinas legado en MSVC reciente. Al actualizar el plugin a C++20, debe retirarse esa definición.
