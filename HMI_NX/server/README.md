# Banco HTTP de referencia — solo PC de pruebas

Este servidor es **un banco de pruebas Node.js con valores simulados**, no un driver, gateway requerido ni programa para el NX102. Sirve para comprobar sesiones, permisos, comandos, recetas, alarmas, registros y recuperación del protocolo NX HTTP v2 mediante una autoridad distinta del navegador.

Necesita Node 22 o posterior. No instala paquetes ni utiliza servicios cloud. No se publica como parte de GitHub Pages.

## Preparar

Exporta un proyecto para el perfil NX HTTP v2 desde el editor. El paquete debe contener `project.nxhmi` y `SD/`. Crea un directorio privado fuera de SD. Las cuentas se provisionan expresamente; no hay contraseñas predeterminadas:

```bash
node HMI_NX/server/provision.cjs --private /ruta/privada-hmi --user tecnico --role admin --name Tecnico
# Solicita la contraseña de forma oculta; no ponerla en la línea de comandos.

node HMI_NX/server/reference.cjs \
  --project /ruta/paquete/project.nxhmi \
  --private /ruta/privada-hmi \
  --public /ruta/paquete/SD \
  --port 8090
```

Abre `http://127.0.0.1:8090/`. El runtime usa mismo origen. Identifícate y habilita escrituras. Los roles deben existir en el proyecto instalado; el rol administrador debe tener `manageUsers` habilitado para administrar cuentas. Guarda la política/proyecto en un lugar administrado, no bajo el control del cliente web.

El servidor rechaza Host y Origin ajenos al loopback, limita cuerpo e intentos de login, usa hash scrypt con sal y comparación constante, y no sirve rutas fuera de SD ni enlaces simbólicos a datos privados. El único uso HTTP con credenciales permitido por el runtime es este loopback; para una máquina real se requiere HTTPS compatible.

## Persistencia y límites

`users.json` contiene los hashes privados. `state.json` conserva recetas, valores simulados, alarmas, resultados y operaciones. Los tokens de sesión no se persisten. Actualizar la interfaz no borra recetas operativas. Al reiniciar cambia la época del cursor; el navegador recupera una instantánea retenida.

El archivo de usuarios y el registro operacional son dos almacenes distintos; no se promete atomicidad conjunta de ambos. La actualización registra solicitud y resultado, por lo que un fallo intermedio puede dejar una solicitud cuyo resultado deba revisarse. La retención es acotada y sus huecos se declaran; no es almacenamiento inmutable ni cumplimiento regulatorio.

El modelo de recetas es atómico dentro del servicio de referencia; el NX debe implementar una transacción equivalente en su lógica, no una sucesión de escrituras sin validar. El banco no demuestra tiempos de ciclo, capturas, SD ni autenticación de un PLC.
