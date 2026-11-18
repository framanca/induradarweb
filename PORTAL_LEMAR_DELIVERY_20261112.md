# Entrega del informe final de Lemar

`IR-20261106-E4D4SQ` está finalizado y ready. El filtro del HTML canónico detectó una cautela heredada sobre la demanda de otro cliente y, por separado, una marca de PLC legítima. Se neutralizan exclusivamente cuatro copias del texto de cautela en la proyección web de su hash finalizado. Una discrepancia en el número de copias bloquea la proyección. Los demás informes reciben exactamente su entrada original.

Se comprobó la fuente pública https://rivasrobotics.com/programacion-plc-hmi/ y su enlace con la señal y evidencia aprobadas del Report. Las tres menciones restantes son la misma lista pública de tecnologías. La API existente de revisión autorizó esa marca para este informe únicamente, después de verificar que no quedaban otras menciones. No se cambiaron el Report JSON, el Light Report, términos globales, permisos, roles, membresías ni reglas generales de privacidad.

El gate y el materializador usan la misma corrección; se conservan sus contratos, ACL y controles originales. La migración aborta atómicamente ante cambios del código de origen, contratos o fingerprint ejecutable. La fuente de migración `20261112003434` corresponde a la versión aplicada `20261112003513`. El Q0 aceptado sigue siendo `6ffceb1c99b2151c7f79e8d259cb0e7d2dc12b212a69b9d2b5bdb9aaedbcdff4`; no se fabricó ninguna aceptación.

La regresión nativa pasó con claims autenticados de la cuenta administradora existente: 42 informes elegibles, primer acceso sin caché, reutilización idéntica del HTML y rechazo de otro tenant y de metadatos de rol falsificados. También se rechazaron otros textos protegidos, cambios de ámbito y la ausencia de los cuatro fragmentos revisados. La ejecución del operador conservó únicamente la caché derivada validada; el test guardado usa rollback por defecto. La caché contiene 766918 caracteres y su gate WEB-REPORT-V1 pasa.

Pasaron 39 tests Node del portal y el parser SQL. Se ejecutaron los guards y regresiones contra el servidor real; Docker no estaba disponible para una nueva repetición local. El navegador tampoco estaba accesible en esta sesión: esta prueba nativa no se presenta como un nuevo E2E visual. El E2E de Albacete documentado anteriormente conserva su propio ámbito histórico.

Los advisors conservan los recuentos previos: seguridad 30 grupos, rendimiento 3, salud 0. No hubo nuevas búsquedas ni llamadas al proveedor. El daemon general permanece apagado. Los hashes y pruebas concretas están en `PORTAL_LEMAR_DELIVERY_20261112.json`.
