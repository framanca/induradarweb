(function(root){'use strict';const C=root.NXST,enc=new TextEncoder();
function stLiteral(s){return String(s).replace(/\$/g,()=> '$$').replace(/'/g,()=> "$'").replace(/\r/g,()=> '$r').replace(/\n/g,()=> '$n');}
function chunks(text,max=1400){const out=[];for(let i=0;i<text.length;i+=max)out.push(text.slice(i,i+max));return out;}
function toStringExpr(v){
 if(v.type==='BOOL')return null;
 if(v.enumType)return 'DINT_TO_STRING(EnumToNum('+v.name+'))';
 if(v.type==='STRING')return v.name;
 if(v.type==='TIME')return 'LINT_TO_STRING(TimeToNanoSec('+v.name+'))';
 if(v.type==='DATE')return 'DateToString('+v.name+')';
 if(v.type==='TIME_OF_DAY')return 'TodToString('+v.name+')';
 if(v.type==='DATE_AND_TIME')return 'DtToString('+v.name+')';
 return v.type+'_TO_STRING('+v.name+')';
}
function fromStringExpr(v){
 if(v.type==='BOOL')return null;
 if(v.type==='STRING')return 'Web_ValueText';
 if(v.type==='TIME')return 'NanoSecToTime(STRING_TO_LINT(Web_ValueText))';
 if(v.type==='DATE')return 'SecToDate(STRING_TO_LINT(Web_ValueText))';
 if(v.type==='TIME_OF_DAY')return 'SecToTod(STRING_TO_LINT(Web_ValueText))';
 if(v.type==='DATE_AND_TIME')return 'SecToDt(STRING_TO_LINT(Web_ValueText))';
 return 'STRING_TO_'+v.type+'(Web_ValueText)';
}
function stTyped(v,value){
 const t=v.type,canonical=C.sysmacTypes&&C.sysmacTypes.canonicalWrite;
 if(t==='BOOL')return (value===true||String(value)==='1'||String(value).toLowerCase()==='true')?'TRUE':'FALSE';
 if(t==='STRING')return "'"+stLiteral(String(value))+"'";
 if(t==='REAL'||t==='LREAL'){const n=Number(value);if(!Number.isFinite(n))throw Error(t+': valor invalido');return t+'#'+(Number.isInteger(n)?n.toFixed(1):String(n));}
 if(['BYTE','WORD','DWORD','LWORD'].includes(t))return t+'#16#'+(canonical?canonical(t,value):String(value));
 if(t==='TIME')return 'NanoSecToTime(LINT#'+(canonical?canonical(t,value):String(value))+')';
 if(t==='DATE'){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value)))throw Error('DATE: formato YYYY-MM-DD');return 'D#'+value}
 if(t==='TIME_OF_DAY'){if(!/^\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?$/.test(String(value)))throw Error('TOD: formato HH:mm:ss');return 'TOD#'+value}
 if(t==='DATE_AND_TIME'){if(!/^\d{4}-\d{2}-\d{2}-\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?$/.test(String(value)))throw Error('DT: formato YYYY-MM-DD-HH:mm:ss');return 'DT#'+value}
 if(C.NUMERIC_TYPES.has(t))return t+'#'+(canonical?canonical(t,value):String(Math.trunc(Number(value))));
 throw Error('Tipo no soportado en constante ST: '+t);
}
function alarmExpr(v,a){const op={eq:'=',ne:'<>',gt:'>',ge:'>=',lt:'<',le:'<='}[a.operator]||'=';const lhs=v.enumType?'EnumToNum('+v.name+')':v.type==='TIME'?'TimeToNanoSec('+v.name+')':v.name;const rhs=v.type==='TIME'?'LINT#'+(C.sysmacTypes?C.sysmacTypes.canonicalWrite('TIME',a.value):String(a.value)):stTyped(v,a.value);return '('+lhs+' '+op+' '+rhs+')';}
function buildST(input){
 const p=C.normalize(input),html=C.buildRuntimeHTML(p),parts=chunks(html),exposed=p.variables.filter(v=>v.expose&&v.live),rw=exposed.filter(v=>v.access==='RW'&&v.writeSupported),vm=new Map(p.variables.map(v=>[v.name,v]));
 const read=[];for(const v of exposed){if(v.type==='BOOL'){read.push(`IF ${v.name} THEN\n    Web_ApiBody := CONCAT(Web_ApiBody, '${v.id}=1$n');\nELSE\n    Web_ApiBody := CONCAT(Web_ApiBody, '${v.id}=0$n');\nEND_IF;`);}else{read.push(`Web_ApiBody := CONCAT(Web_ApiBody, '${v.id}=', ${toStringExpr(v)}, '$n');`);}}
 for(const [i,a] of p.alarms.entries()){const v=vm.get(a.binding);if(!v)continue;read.push(`IF ${alarmExpr(v,a)} THEN\n    Web_ApiBody := CONCAT(Web_ApiBody, 'A${i+1}=1$n');\nELSE\n    Web_ApiBody := CONCAT(Web_ApiBody, 'A${i+1}=0$n');\nEND_IF;\nIF Web_AlarmAck[${i+1}] THEN\n    Web_ApiBody := CONCAT(Web_ApiBody, 'K${i+1}=1$n');\nELSE\n    Web_ApiBody := CONCAT(Web_ApiBody, 'K${i+1}=0$n');\nEND_IF;`);}
 const writes=rw.map(v=>{
 if(v.type==='BOOL')return `${v.id}:\n                ${v.name} := (Web_ValueText = '1') OR (Web_ValueText = 'TRUE') OR (Web_ValueText = 'true');\n                Web_Found := TRUE;`;
 const statement=v.enumType?'NumToEnum(STRING_TO_DINT(Web_ValueText), '+v.name+')':v.name+' := '+fromStringExpr(v);
 return `${v.id}:\n                ${statement};\n                Web_Found := TRUE;`;
 }).join('\n            ');
 const alarmReset=p.alarms.map((a,i)=>{const v=vm.get(a.binding);return v?`IF NOT ${alarmExpr(v,a)} THEN Web_AlarmAck[${i+1}] := FALSE; END_IF;`:''}).filter(Boolean).join('\n');
 const alarmAckCases=p.alarms.map((a,i)=>{const v=vm.get(a.binding);return v?`${i+1}:\n IF ${alarmExpr(v,a)} THEN Web_AlarmAck[${i+1}] := TRUE; END_IF;\n Web_Found := TRUE;`:''}).filter(Boolean).join('\n');
 const alarmAckAll=p.alarms.map((a,i)=>{const v=vm.get(a.binding);return v?`IF ${alarmExpr(v,a)} THEN Web_AlarmAck[${i+1}] := TRUE; END_IF;`:''}).filter(Boolean).join('\n');
 const recipeCases=p.recipes.map((r,i)=>{const assigns=[];for(const [name,value] of Object.entries(r.values||{})){const v=vm.get(name);if(v&&v.access==='RW'&&v.writeSupported)assigns.push(v.enumType?`NumToEnum(${stTyped(v,value)}, ${v.name});`:`${v.name} := ${stTyped(v,value)};`);}return `${i+1}:\n                ${assigns.join('\n                ')||';'}\n                Web_Found := TRUE;`;}).join('\n            ');
 const chunkCases=parts.map((c,i)=>`${i}: Web_TxText := '${stLiteral(c)}';`).join('\n            ');
 return `(* HMI NX ST · servidor WebHMI generado
   Proyecto: ${p.name}
   Puerto: ${p.port}
   HTML embebido: ${enc.encode(html).length} bytes / ${parts.length} fragmentos
   Funciones: RW, pantallas, imágenes, widgets industriales, alarmas actuales y recetas.
   Seguridad funcional e interlocks permanecen en el programa de máquina.
*)

${alarmReset}
IF Web_State = Web_PrevState THEN
    IF (Web_State <> UINT#10) AND (Web_StateTicks < UDINT#4294967294) THEN
        Web_StateTicks := Web_StateTicks + UDINT#1;
    END_IF;
ELSE
    Web_PrevState := Web_State;
    Web_StateTicks := UDINT#0;
END_IF;

IF (Web_State <> UINT#10) AND (Web_StateTicks > Web_WatchdogLimit) THEN
    Web_Accept(Execute:=FALSE, SrcTcpPort:=UINT#${p.port}, TimeOut:=UINT#0);
    Web_Rcv(Execute:=FALSE, Socket:=Web_Socket, TimeOut:=UINT#0, Size:=UINT#0, RcvDat:=Web_Rx[0]);
    Web_Send(Execute:=FALSE, Socket:=Web_Socket, SendDat:=Web_Tx[0], Size:=UINT#0);
    Web_State := UINT#90;
    Web_StateTicks := UDINT#0;
END_IF;

CASE Web_State OF
0:
    Web_Accept(Execute:=FALSE, SrcTcpPort:=UINT#${p.port}, TimeOut:=UINT#0);
    Web_Rcv(Execute:=FALSE, Socket:=Web_Socket, TimeOut:=UINT#0, Size:=UINT#0, RcvDat:=Web_Rx[0]);
    Web_Send(Execute:=FALSE, Socket:=Web_Socket, SendDat:=Web_Tx[0], Size:=UINT#0);
    Web_Close(Execute:=FALSE, Socket:=Web_Socket);
    Web_State := UINT#10;

10:
    Web_Accept(Execute:=TRUE, SrcTcpPort:=UINT#${p.port}, TimeOut:=UINT#0);
    IF Web_Accept.Done THEN
        Web_Socket := Web_Accept.Socket;
        Web_Accept(Execute:=FALSE, SrcTcpPort:=UINT#${p.port}, TimeOut:=UINT#0);
        Web_State := UINT#20;
    ELSIF Web_Accept.Error THEN
        Web_Accept(Execute:=FALSE, SrcTcpPort:=UINT#${p.port}, TimeOut:=UINT#0);
    END_IF;

20:
    Web_Rcv(Execute:=TRUE, Socket:=Web_Socket, TimeOut:=UINT#50, Size:=UINT#1900, RcvDat:=Web_Rx[0]);
    IF Web_Rcv.Done THEN
        Web_RxText := AryToString(Web_Rx[0], Web_Rcv.RcvSize);
        Web_Rcv(Execute:=FALSE, Socket:=Web_Socket, TimeOut:=UINT#0, Size:=UINT#0, RcvDat:=Web_Rx[0]);
        Web_Request := UINT#0;
        IF (FIND(Web_RxText, 'GET / ') = 1) OR (FIND(Web_RxText, 'GET /index.html ') = 1) THEN
            Web_Request := UINT#1;
        ELSIF FIND(Web_RxText, 'GET /api/read ') = 1 THEN
            Web_Request := UINT#2;
        ELSIF FIND(Web_RxText, 'POST /api/write?') = 1 THEN
            Web_Request := UINT#3;
        ELSIF FIND(Web_RxText, 'POST /api/recipe?') = 1 THEN
            Web_Request := UINT#4;
         ELSIF FIND(Web_RxText, 'POST /api/ack?') = 1 THEN
             Web_Request := UINT#5;
        ELSE
            Web_Request := UINT#9;
        END_IF;
        Web_State := UINT#30;
    ELSIF Web_Rcv.Error THEN
        Web_Rcv(Execute:=FALSE, Socket:=Web_Socket, TimeOut:=UINT#0, Size:=UINT#0, RcvDat:=Web_Rx[0]);
        Web_State := UINT#90;
    END_IF;

30:
    CASE Web_Request OF
    1:
        Web_TxText := 'HTTP/1.0 200 OK$r$nContent-Type: text/html; charset=utf-8$r$nCache-Control: no-store$r$nConnection: close$r$n$r$n';
        Web_Chunk := UINT#0;

    2:
        Web_Seq := Web_Seq + UDINT#1;
        IF Web_Seq = UDINT#0 THEN Web_Seq := UDINT#1; END_IF;
        Web_ApiBody := CONCAT('SEQ=', UDINT_TO_STRING(Web_Seq), '$n');
        ${read.join('\n        ')}
        Web_ApiBody := CONCAT(Web_ApiBody, 'END=', UDINT_TO_STRING(Web_Seq), '$n');
        Web_TxText := 'HTTP/1.0 200 OK$r$nContent-Type: text/plain; charset=utf-8$r$nCache-Control: no-store$r$nConnection: close$r$n$r$n';

    3:
        Web_PosId := FIND(Web_RxText, '?id=');
        Web_PosEnd := FIND(Web_RxText, ' HTTP/');
        Web_PosBody := FIND(Web_RxText, '$r$n$r$n');
        Web_Found := FALSE;
        IF (Web_PosId > 0) AND (Web_PosEnd > Web_PosId) AND (Web_PosBody > 0) THEN
            Web_IdText := MID(In:=Web_RxText, L:=Web_PosEnd-(Web_PosId+UINT#4), P:=Web_PosId+UINT#4);
            Web_ValueText := MID(In:=Web_RxText, L:=LEN(Web_RxText)-(Web_PosBody+UINT#3), P:=Web_PosBody+UINT#4);
            Web_WriteId := STRING_TO_UINT(Web_IdText);
            CASE Web_WriteId OF
            ${writes||'0: ;'}
            ELSE
                ;
            END_CASE;
        END_IF;
        IF Web_Found THEN
            Web_ApiBody := 'OK';
            Web_TxText := 'HTTP/1.0 200 OK$r$nContent-Type: text/plain$r$nCache-Control: no-store$r$nConnection: close$r$n$r$n';
        ELSE
            Web_ApiBody := 'BAD WRITE';
            Web_TxText := 'HTTP/1.0 400 Bad Request$r$nContent-Type: text/plain$r$nConnection: close$r$n$r$n';
        END_IF;

    4:
        Web_PosId := FIND(Web_RxText, '?id=');
        Web_PosEnd := FIND(Web_RxText, ' HTTP/');
        Web_Found := FALSE;
        IF (Web_PosId > 0) AND (Web_PosEnd > Web_PosId) THEN
            Web_IdText := MID(In:=Web_RxText, L:=Web_PosEnd-(Web_PosId+UINT#4), P:=Web_PosId+UINT#4);
            Web_WriteId := STRING_TO_UINT(Web_IdText);
            CASE Web_WriteId OF
            ${recipeCases||'0: ;'}
            ELSE
                ;
            END_CASE;
        END_IF;
        IF Web_Found THEN
            Web_ApiBody := 'OK';
            Web_TxText := 'HTTP/1.0 200 OK$r$nContent-Type: text/plain$r$nCache-Control: no-store$r$nConnection: close$r$n$r$n';
        ELSE
            Web_ApiBody := 'BAD RECIPE';
            Web_TxText := 'HTTP/1.0 400 Bad Request$r$nContent-Type: text/plain$r$nConnection: close$r$n$r$n';
        END_IF;


    5:
        Web_PosId := FIND(Web_RxText, '?id=');
        Web_PosEnd := FIND(Web_RxText, ' HTTP/');
        Web_Found := FALSE;
        IF (Web_PosId > 0) AND (Web_PosEnd > Web_PosId) THEN
            Web_IdText := MID(In:=Web_RxText, L:=Web_PosEnd-(Web_PosId+UINT#4), P:=Web_PosId+UINT#4);
            Web_WriteId := STRING_TO_UINT(Web_IdText);
            IF Web_WriteId = UINT#0 THEN
                ${alarmAckAll}
                Web_Found := TRUE;
            ELSE
                CASE Web_WriteId OF
                ${alarmAckCases||'0: ;'}
                ELSE
                    ;
                END_CASE;
            END_IF;
        END_IF;
        IF Web_Found THEN
            Web_ApiBody := 'OK';
            Web_TxText := 'HTTP/1.0 200 OK$r$nContent-Type: text/plain$r$nCache-Control: no-store$r$nConnection: close$r$n$r$n';
        ELSE
            Web_ApiBody := 'BAD ACK';
            Web_TxText := 'HTTP/1.0 400 Bad Request$r$nContent-Type: text/plain$r$nConnection: close$r$n$r$n';
        END_IF;

    ELSE
        Web_ApiBody := 'NOT FOUND';
        Web_TxText := 'HTTP/1.0 404 Not Found$r$nContent-Type: text/plain$r$nConnection: close$r$n$r$n';
    END_CASE;
    Web_State := UINT#40;

40:
    Web_TxSize := StringToAry(Web_TxText, Web_Tx[0]);
    Web_Send(Execute:=TRUE, Socket:=Web_Socket, SendDat:=Web_Tx[0], Size:=Web_TxSize);
    IF Web_Send.Done THEN
        Web_Send(Execute:=FALSE, Socket:=Web_Socket, SendDat:=Web_Tx[0], Size:=UINT#0);
        IF Web_Request = UINT#1 THEN Web_State := UINT#50; ELSE Web_State := UINT#60; END_IF;
    ELSIF Web_Send.Error THEN
        Web_Send(Execute:=FALSE, Socket:=Web_Socket, SendDat:=Web_Tx[0], Size:=UINT#0);
        Web_State := UINT#90;
    END_IF;

50:
    CASE Web_Chunk OF
            ${chunkCases}
    ELSE
        Web_TxText := '';
    END_CASE;
    Web_TxSize := StringToAry(Web_TxText, Web_Tx[0]);
    Web_Send(Execute:=TRUE, Socket:=Web_Socket, SendDat:=Web_Tx[0], Size:=Web_TxSize);
    IF Web_Send.Done THEN
        Web_Send(Execute:=FALSE, Socket:=Web_Socket, SendDat:=Web_Tx[0], Size:=UINT#0);
        IF Web_Chunk >= UINT#${parts.length-1} THEN Web_State := UINT#90; ELSE Web_Chunk := Web_Chunk + UINT#1; END_IF;
    ELSIF Web_Send.Error THEN
        Web_Send(Execute:=FALSE, Socket:=Web_Socket, SendDat:=Web_Tx[0], Size:=UINT#0);
        Web_State := UINT#90;
    END_IF;

60:
    Web_TxText := Web_ApiBody;
    Web_TxSize := StringToAry(Web_TxText, Web_Tx[0]);
    Web_Send(Execute:=TRUE, Socket:=Web_Socket, SendDat:=Web_Tx[0], Size:=Web_TxSize);
    IF Web_Send.Done OR Web_Send.Error THEN
        Web_Send(Execute:=FALSE, Socket:=Web_Socket, SendDat:=Web_Tx[0], Size:=UINT#0);
        Web_State := UINT#90;
    END_IF;

90:
    Web_Close(Execute:=TRUE, Socket:=Web_Socket);
    IF Web_Close.Done OR Web_Close.Error THEN
        Web_Close(Execute:=FALSE, Socket:=Web_Socket);
        Web_State := UINT#10;
    END_IF;
END_CASE;
`;
}
function referencedVariables(p){const n=C.normalize(p),set=new Set(n.variables.filter(v=>v.expose&&v.live).map(v=>v.name));if(n.screenBinding)set.add(n.screenBinding);for(const s of n.screens)for(const o of C.screenObjects(n,s)){if(o.binding)set.add(o.binding);if(o.feedbackBinding)set.add(o.feedbackBinding);}for(const a of n.alarms)if(a.binding)set.add(a.binding);for(const r of n.recipes)for(const k of Object.keys(r.values||{}))set.add(k);return n.variables.filter(v=>set.has(v.name));}
function externalVariablesTSV(p){
 const roots=new Map();
 for(const v of referencedVariables(p)){
  const name=v.plcRoot||v.name,type=v.plcRootType||v.type;
  if(roots.has(name)&&roots.get(name)!==type)throw Error('Tipo externo conflictivo: '+name);
  roots.set(name,type);
 }
 return [...roots].map(([name,type])=>name+'\t'+type).join('\r\n');
}
function localVariablesTSV(input){const p=C.normalize(input);const rows=[
['Web_State','UINT','0','','','','Estado servidor HTTP'],
['Web_PrevState','UINT','0','','','','Estado anterior watchdog'],
['Web_StateTicks','UDINT','0','','','','Ciclos en estado actual'],
['Web_WatchdogLimit','UDINT','5000','','','','Límite ciclos watchdog'],
['Web_Seq','UDINT','0','','','','Secuencia snapshot API'],
 ['Web_AlarmAck',`ARRAY[1..${Math.max(1,p.alarms.length)}] OF BOOL`,'','','','','Alarmas reconocidas; rearme al desactivarse'],
['Web_Request','UINT','0','','','','Ruta solicitada'],
['Web_Chunk','UINT','0','','','','Fragmento HTML'],
['Web_WriteId','UINT','0','','','','ID escritura/receta'],
['Web_PosId','UINT','0','','','','Posición id'],
['Web_PosVal','UINT','0','','','','Posición valor'],
['Web_PosEnd','UINT','0','','','','Fin request line'],
['Web_PosBody','UINT','0','','','','Inicio cuerpo HTTP'],
['Web_TxSize','UINT','0','','','','Bytes a enviar'],
['Web_Found','BOOL','FALSE','','','','Ruta/ID válido'],
['Web_Rx','ARRAY[0..1999] OF BYTE','','','','','Buffer RX'],
['Web_Tx','ARRAY[0..1999] OF BYTE','','','','','Buffer TX'],
['Web_RxText','STRING[1985]','','','','','Petición HTTP'],
['Web_TxText','STRING[1985]','','','','','Respuesta/fragmento'],
['Web_ApiBody','STRING[1985]','','','','','Datos API'],
['Web_IdText','STRING[12]','','','','','ID parseado'],
['Web_ValueText','STRING[512]','','','','','Valor de escritura'],
['Web_Socket','_sSOCKET','','','','','Socket aceptado'],
['Web_Accept','SktTCPAccept','','','','','Accept TCP'],
['Web_Rcv','SktTCPRcv','','','','','Receive TCP'],
['Web_Send','SktTCPSend','','','','','Send TCP'],
['Web_Close','SktClose','','','','','Close TCP']
];return rows.map(r=>r.join('\t')).join('\r\n');}
function readme(input,html,st){const p=C.normalize(input);return `HMI NX ST · paquete generado

Proyecto: ${p.name}
Puerto: ${p.port}
Pantallas: ${p.screens.length}
Imágenes: ${p.assets.length}
Alarmas actuales: ${p.alarms.length}
Recetas: ${p.recipes.length}
HTML embebido: ${enc.encode(html).length} bytes
ST generado: ${enc.encode(st).length} bytes

INSTALACIÓN
- Pegar WebHMI_Server.st en un Program ST.
- Pegar WebHMI_LocalVariables.tsv en Internals.
- Pegar WebHMI_ExternalVariables.tsv en Externals.
- Las variables referenciadas deben existir como Global Variables con el mismo nombre/tipo.
- Si importaste una estructura, union, enumeracion o ARRAY, crea su tipo en Data Types de Sysmac y declara la raiz global. El TSV Externals contiene SOLO esa raiz, no miembros sueltos.
- Asignar el Program a una tarea y transferir al NX.
- Abrir http://IP_DEL_NX:${p.port}/

FUNCIONES
- Comunicación robusta: snapshots SEQ/END, actualización atómica y watchdog de estados.
- Lectura de los 20 tipos basicos NX, y de miembros de ARRAY/STRUCT/UNION/ENUM mediante variables raiz.
- Escritura directa BOOL, numeros, bitstrings hexadecimales, TIME como nanosegundos, STRING y enumeraciones (NumToEnum).
- DATE, TIME_OF_DAY y DATE_AND_TIME: lectura formateada y escritura con resolucion de 1 segundo usando SecToDate/SecToTod/SecToDt.
- Importante: la escritura DATE/DT/TOD trunca/substituye fracciones de segundo; DATE/DT admiten desde 1970 y se interpretan sin zona horaria.
- Botones SET/RESET/TOGGLE.
- Varias pantallas con número único, color de fondo y selección opcional por variable entera leída del PLC.
- Si se configura control PLC, el valor de esa variable gobierna siempre la pantalla; si no coincide con ningún número (o es inválido), se muestra la principal. Sin comunicación válida, se mantiene la última pantalla y se indica pérdida de comunicación.
- Imágenes embebidas como data URL, estáticas o con cambio OFF/ON gobernado por BOOL.
- Estado BOOL con símbolos SVG integrados OFF/ON: lámpara, motor, bomba, válvula, cinta y sensor; mapeo TRUE/FALSE invertible.
- Alarmas evaluadas en ST con ACK individual/total en /api/ack y estados K en /api/read.
- Recetas compiladas en ST y aplicadas en una sola ejecución del CASE de receta.

LÍMITES ACTUALES
- 1 cliente simultáneo.
- HTTP/1.0 con Connection: close.
- Petición <=1900 bytes en una recepción.
- Web_WatchdogLimit es un límite en ciclos de tarea (5000 por defecto), no tiempo absoluto.
- Alarmas: ACK en memoria PLC mientras sigan activas; no retentivas tras reinicio ni historial.
- Recetas: valores compilados con la exportación; editar una receta exige regenerar/transferir ST.
- Sin HTTPS ni gestión de usuarios todavía.
- No usar la HMI para funciones de seguridad.
`;}
Object.assign(C,{buildST,localVariablesTSV,externalVariablesTSV,readme});
})(globalThis);
