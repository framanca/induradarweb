'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ctx={TextEncoder,URL,console};ctx.globalThis=ctx;vm.createContext(ctx);
for(const file of ['expressions.js','model.js','sysmac-types.js','runtime.js','st.js','zip.js'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ctx,{filename:file});
const C=ctx.NXST;
const src=`TYPE ST_Sensor : STRUCT
 Enabled : BOOL;
 Count : UDINT;
 Bits : WORD;
 Duracion : TIME;
 Fecha : DATE;
END_STRUCT; END_TYPE
TYPE ST_Linea : STRUCT
 Sensores : ARRAY[0..1] OF ST_Sensor;
END_STRUCT; END_TYPE
TYPE E_Modo : (Paro := 0, Manual := 2, Automatico := 3); END_TYPE
VAR_GLOBAL
 Linea : ST_Linea;
 Modo : E_Modo;
 BitsCompartidos : ARRAY[0..1] OF DWORD;
END_VAR`;
test('nested Sysmac arrays, struct members, enum and roots are imported accurately',()=>{
 const variables=C.importSysmac(src);
 a.equal(variables.length,13);
 a.deepEqual(Array.from(variables,v=>v.name).slice(0,5),['Linea.Sensores[0].Enabled','Linea.Sensores[0].Count','Linea.Sensores[0].Bits','Linea.Sensores[0].Duracion','Linea.Sensores[0].Fecha']);
 a.equal(variables.find(v=>v.name==='Modo').enumValues.Automatico,3);
 a.equal(variables.find(v=>v.name==='Linea.Sensores[1].Fecha').writeSupported,true);
 a.equal(variables.find(v=>v.name==='Linea.Sensores[1].Duracion').writeSupported,true);
 const p=C.newProject();p.variables=variables;a.deepEqual(Array.from(C.validate(p)),[]);
 a.equal(C.externalVariablesTSV(p).split('\r\n').length,3);
 a.match(C.externalVariablesTSV(p),/^Linea\tST_Linea/m);
 a.match(C.externalVariablesTSV(p),/^Modo\tE_Modo/m);
 a.match(C.externalVariablesTSV(p),/^BitsCompartidos\tARRAY\[0\.\.1\] OF DWORD/m);
});
test('union and up to three dimensional arrays expand into typed leaf variables',()=>{
 const project=C.newProject();
 project.variables=C.importSysmac('TYPE U_Data : UNION W : WORD; B : ARRAY[0..1] OF BYTE; END_UNION; END_TYPE\nVAR_GLOBAL\nUnion1 : U_Data;\nTemp : ARRAY[1..2,0..1,3..4] OF LREAL;\nEND_VAR');
 a.equal(project.variables.length,11);
 a.ok(project.variables.some(v=>v.name==='Union1.B[1]'));
 a.ok(project.variables.some(v=>v.name==='Temp[2,1,4]'));
 a.deepEqual(Array.from(C.validate(project)),[]);
});
test('20 scalar types, including temporal and bitstrings, are importable',()=>{
 const types=['BOOL','SINT','USINT','INT','UINT','DINT','UDINT','LINT','ULINT','REAL','LREAL','STRING[120]','BYTE','WORD','DWORD','LWORD','TIME','DATE','TOD','DT'];
 const variables=C.importSysmac('Name\tData Type\n'+types.map((x,i)=>'V'+i+'\t'+x).join('\n'));
 a.equal(variables.length,20);
 a.ok(variables.every(v=>v.live));
 a.equal(variables[18].type,'TIME_OF_DAY');a.equal(variables[19].type,'DATE_AND_TIME');
 a.ok(variables.slice(17).every(v=>v.writeSupported));
});
test('PLC ST uses valid type-specific conversions and never declares array members as Externals',()=>{
 const p=C.newProject();p.variables=C.importSysmac(src);
 for(const v of p.variables)if(v.writeSupported)v.access='RW';
 const st=C.buildST(p);
 a.match(st,/WORD_TO_STRING\(Linea\.Sensores\[0\]\.Bits\)/);
 a.match(st,/DWORD_TO_STRING\(BitsCompartidos\[1\]\)/);
 a.match(st,/LINT_TO_STRING\(TimeToNanoSec\(Linea\.Sensores\[0\]\.Duracion\)\)/);
 a.match(st,/DateToString\(Linea\.Sensores\[0\]\.Fecha\)/);
 a.match(st,/EnumToNum\(Modo\)/);
 a.match(st,/NumToEnum\(STRING_TO_DINT\(Web_ValueText\), Modo\)/);
 a.match(st,/NanoSecToTime\(STRING_TO_LINT\(Web_ValueText\)\)/);
 a.match(st,/SecToDate\(STRING_TO_LINT\(Web_ValueText\)\)/);
 a.ok(!C.externalVariablesTSV(p).includes('Linea.Sensores[0]'));
 const pkg=C.exportPackage(p);a.ok(pkg.files['HMI_Embedded.html']);a.ok(pkg.files['WebHMI_Server.st']);
});
test('64-bit integers and bitstrings are validated losslessly before browser writes',()=>{
 const f=C.sysmacTypes.canonicalWrite;
 a.equal(f('LINT','-9223372036854775808'),'-9223372036854775808');
 a.equal(f('ULINT','18446744073709551615'),'18446744073709551615');
 a.equal(f('LWORD','0xffffffffffffffff'),'FFFFFFFFFFFFFFFF');
 a.equal(f('WORD','1a'),'001A');
 a.equal(f('DATE','2026-10-10'),'1791590400');
 a.equal(f('TIME_OF_DAY','08:30:00'),'30600');
 a.equal(f('DATE_AND_TIME','2026-10-10-08:30:00'),'1791621000');
 a.throws(()=>f('DATE','2026-02-29'));
 a.throws(()=>f('DATE_AND_TIME','2026-10-10-08:30:00.123'),/fracciones/);
 a.throws(()=>f('LINT','9223372036854775808'));
 a.throws(()=>f('ULINT','18446744073709551616'));
 a.throws(()=>f('WORD','12345'));
});
test('unsupported schemas fail rather than silently generate bad ST',()=>{
 a.throws(()=>C.importSysmac('VAR_GLOBAL\nM : ST_Unspecified;\nEND_VAR'),/no definido/);
 a.throws(()=>C.importSysmac('Name\tData Type\nA\tARRAY[0..1200] OF INT'),/grande/);
 a.throws(()=>C.importSysmac('Name\tData Type\nA\tARRAY[2..1] OF INT'),/Rango ARRAY invalido/);
 a.throws(()=>C.importSysmac('Name\tData Type\nA\tARRAY[0..1,0..1,0..1,0..1] OF INT'),/3 dimensiones/);
});
test('generated runtime retains exact bitstrings, wide integers and date strings',()=>{
 const p=C.newProject();
 p.variables=C.importSysmac('Name\tData Type\nFlags\tDWORD\nWide\tULINT\nT\tTIME\nDateValue\tDATE');
 const html=C.buildRuntimeHTML(p);
 a.match(html,/"LWORD","TIME","DATE"/);a.match(html,/BigInt\(raw\)/);
 a.match(html,/TIME_OF_DAY/);a.match(html,/LWORD/);
 a.ok([...html].every(x=>x.charCodeAt(0)<128));
 const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 a.doesNotThrow(()=>new Function(script));
});
