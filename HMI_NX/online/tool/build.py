"""Build a separate public frontend; never copy the server compiler to it."""
from pathlib import Path
import hashlib, json, shutil, sys

ROOT = Path(__file__).resolve().parents[3]
APP = ROOT / 'HMI_NX' / 'online'
SOURCE = ROOT / 'HMI_NX_ST'

def replace(text, before, after):
    if text.count(before) != 1:
        raise RuntimeError('Editor anchor changed: ' + before[:60])
    return text.replace(before, after, 1)

def build(dest):
    dest.mkdir(parents=True, exist_ok=True)
    for stale in ['runtime.js','st.js','zip.js','lite.js','compiler.js']:
        (dest / stale).unlink(missing_ok=True)
    for name in ['index.html','style.css','expressions.js','model.js','sysmac-types.js','history.js','app.js']:
        text=(SOURCE/name).read_text()
        if name == 'index.html':
            for module in ['runtime.js','st.js','zip.js','lite.js']:
                text=replace(text,f'<script defer src="{module}"></script>\n','')
            text=replace(text,'<script defer src="app.js"></script>','<script defer src="config.js"></script>\n<script defer src="online.js"></script>\n<script defer src="app.js"></script>')
            text=replace(text,'<link rel="stylesheet" href="style.css">','<link rel="stylesheet" href="style.css"><link rel="stylesheet" href="online.css">')
            text=replace(text,'<iframe id="previewFrame" title="Previsualización de la HMI">','<iframe id="previewFrame" sandbox="allow-scripts" title="Previsualización de la HMI">')
            text=text.replace('HMI NX ST','HMI NX Online')
        if name == 'app.js':
            # Source editor already starts with an empty project (recipes disabled).
            # Keep an explicit assertion rather than replacing the old demo default.
            if text.count("let p=C.newProject()") != 1:
                raise RuntimeError('Editor must default to a new project')
            text=text.replace("'hmi-nx-st:p0:","'hmi-nx-online:p0:")
            text=replace(text, "async function liteCompile(snapshot){return C.exportLitePackage(snapshot)}", "async function liteCompile(snapshot){const zip=await NXOnline.request('compile-lite',snapshot);return {zip}}")
            text=replace(text, "async function litePreview(snapshot){return C.buildLiteRuntimeHTML(snapshot,{preview:true})}", "async function litePreview(snapshot){const result=await NXOnline.request('preview-lite',snapshot);return result.html}")
            start=text.index('function renderProjectSummary('); end=text.index('\nfunction openExportDiagnostics(',start)
            text=text[:start]+'''// The editor can check resources without carrying the server-side compiler.
const onlineSize={
 measured:null,errorKey:null,error:'',running:false,timer:null,lastRequestAt:0,
 signature(){return JSON.stringify(C.normalize(p));},
 schedule(key){
  clearTimeout(this.timer);
  this.timer=null;
  if(this.measured?.key===key||this.errorKey===key||this.running)return;
  if(!NXOnline.hasSession()||$('#sidebar-panel-project').hidden||C.validate(p).length)return;
  // A 2.5s idle debounce and 15s minimum interval leave room for other
  // operations under the guest tier (10 requests/minute per Edge instance).
  const delay=Math.max(2500,15000-(Date.now()-this.lastRequestAt));
  this.timer=setTimeout(()=>this.refresh(key),delay);
 },
 async refresh(expectedKey){
  this.timer=null;
  if(this.running||!NXOnline.hasSession()||$('#sidebar-panel-project').hidden)return;
  const snapshot=C.copy(p),key=JSON.stringify(C.normalize(snapshot));
  if(key!==expectedKey){renderDiag();return}
  if(C.validate(snapshot).length)return;
  this.running=true;this.lastRequestAt=Date.now();
  renderProjectSummary(null,'Calculando en Supabase…');
  try{
   const data=await NXOnline.request('size',snapshot);
   if(!Number.isSafeInteger(data.htmlBytes)||data.htmlBytes<0||data.limitBytes!==C.HTML_MAX_BYTES||data.optimized!==true)
    throw Error('Respuesta de tamaño incorrecta');
   this.measured={key,bytes:data.htmlBytes,rawBytes:data.originalHtmlBytes,overLimit:data.overLimit===true};
   this.errorKey=null;this.error='';
  }catch(error){this.errorKey=key;this.error=error.message;}
  finally{this.running=false;renderDiag();}
 }
};
function renderProjectSummary(htmlBytes=null,detail=''){
 const assetBytes=p.assets.reduce((n,a)=>n+C.dataUrlBytes(a.data),0);
 const htmlUsage=Number.isFinite(htmlBytes)?(htmlBytes/1024).toFixed(1)+' / 512 KB':'— / 512 KB';
 const text='HTML optimizado (Supabase): '+htmlUsage+(detail?' · '+detail:'')+' · imágenes: '+(assetBytes/1024).toFixed(1)+' / 256 KB · '+p.screens.length+' pantallas · '+p.variables.length+' variables · '+p.alarms.length+' alarmas · '+(p.recipeEnabled?p.recipes.length:0)+' recetas.';
 const summary=$('#projectResourceSummary');summary.textContent=text;
 summary.parentElement.classList.toggle('over-limit',assetBytes>C.IMAGE_TOTAL_MAX_BYTES||Number.isFinite(htmlBytes)&&htmlBytes>C.HTML_MAX_BYTES);
 return text;
}
function renderDiag(){
 syncProjectInputs();
 const key=onlineSize.signature(),errors=C.validate(p),baseErrorCount=errors.length;
 const report=NXOnline.hasSession()&&onlineSize.measured?.key===key?onlineSize.measured:null;
 if(report?.overLimit)errors.push('HTML optimizado supera 512 KB: exportación bloqueada.');
 const detail=report?'Tamaño final verificado':!NXOnline.hasSession()?'Inicia sesión para calcular':baseErrorCount?'Corrige el proyecto para calcular':onlineSize.errorKey===key?'Error: '+onlineSize.error:'Calculando en Supabase…';
 const projectSummary=renderProjectSummary(report?.bytes??null,detail);
 const ok=errors.length===0,button=$('#exportBtn');
 button.dataset.exportable=String(ok);
 button.title=ok?'Proyecto correcto: exportar Sysmac':'Pulsa para ver los problemas de validación';
 $('#exportWarningIcon').hidden=ok;
 $('#diagnostics').innerHTML='<div class="diagnostic '+(ok?'ok':'error')+'">'+(ok?'Validación local correcta':'Bloqueos: '+errors.length)+'</div>'+errors.map(e=>'<div class="diagnostic error">'+C.esc(e)+'</div>').join('')+'<div class="diagnostic">'+C.esc(projectSummary)+'</div>';
 onlineSize.schedule(key);
 return ok;
}'''+text[end:]
            text=replace(text,
              " $('.left-panels').scrollTop=0;if(focus)current.focus();",
              " $('.left-panels').scrollTop=0;if(focus)current.focus();if(name==='project')renderDiag();")
            text=replace(text,
              'p0Boot();\n})();',
              "window.addEventListener('webhmi-online-session',()=>{onlineSize.errorKey=null;clearTimeout(onlineSize.timer);renderDiag();});\np0Boot();\n})();")
            start=text.index('function preview(){'); end=text.index('\n}',start)+2
            text=text[:start]+'''async function preview(){syncProjectInputs();try{const result=await NXOnline.request('preview',C.copy(p));$('#previewFrame').srcdoc=result.html;$('#previewDialog').showModal();clampPreviewDialog()}catch(error){toast(error.message)}}'''+text[end:]
            start=text.index("$('#exportBtn').onclick=")
            # Multi-line export handlers must be replaced entirely; the old first-semicolon
            # splice left an orphan catch block when diagnostics were moved to a dialog.
            end_marker=";\n$('#closeDiagnostics').onclick"
            end=(text.index(end_marker,start)+1) if end_marker in text[start:] else (text.index(';\n',start)+1)
            text=text[:start]+'''$('#exportBtn').onclick=async()=>{
 if(!renderDiag()){openExportDiagnostics();return}
 const snapshot=C.copy(p),json=JSON.stringify(C.normalize(snapshot));
 try{
  const out=await NXOnline.request('compile',snapshot);
  download((snapshot.name||'WebHMI_ST').replace(/[^A-Za-z0-9_-]+/g,'_')+'_Sysmac.zip',out,'application/zip');
  if(p0JSON()===json)p0Checkpoint();
  p0Snapshot('exportado-supabase',true);
  toast('Paquete Sysmac generado en Supabase')
 }catch(error){openExportDiagnostics('No se pudo exportar: '+error.message)}
}'''+text[end:]
            text = replace(text, "p0Snapshot('antes-abrir-archivo',true);if(p0Dirty()", "if(!p0Snapshot('antes-abrir-archivo',true)){toast('No se puede respaldar el proyecto actual. Guarda una copia antes de abrir otro.');e.target.value='';return}if(p0Dirty()")
            text = replace(text, "p0Snapshot('antes-recuperar',true);p=C.normalize", "if(!p0Snapshot('antes-recuperar',true)){toast('No se puede respaldar el proyecto actual. Recuperación cancelada.');return}p=C.normalize")
            if any(x in text for x in ['buildRuntimeHTML','exportPackage','buildLiteRuntimeHTML','exportLitePackage']):
                raise RuntimeError('A browser compiler call escaped the split')
        (dest/name).write_text(text)
    for name in ['online.js','online.css','config.js']:
        shutil.copyfile(APP/'client'/name,dest/name)
    compiler=APP/'supabase/functions/webhmi-compile/compiler.js'
    compiler.write_text('\n'.join((SOURCE/name).read_text() for name in ['expressions.js','model.js','sysmac-types.js','runtime.js','st.js','zip.js','lite.js']))
    manifest={name:hashlib.sha256((SOURCE/name).read_bytes()).hexdigest() for name in ['expressions.js','model.js','sysmac-types.js','runtime.js','st.js','zip.js','lite.js']}
    (APP/'server/source-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print('Built online frontend without ST/ZIP/runtime compiler sources:',dest)

if __name__=='__main__': build(Path(sys.argv[1]) if len(sys.argv)>1 else APP/'public')
