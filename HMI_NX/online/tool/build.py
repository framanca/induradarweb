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
    for stale in ['runtime.js','st.js','zip.js','compiler.js']:
        (dest / stale).unlink(missing_ok=True)
    for name in ['index.html','style.css','expressions.js','model.js','sysmac-types.js','history.js','app.js']:
        text=(SOURCE/name).read_text()
        if name == 'index.html':
            for module in ['runtime.js','st.js','zip.js']:
                text=replace(text,f'<script defer src="{module}"></script>\n','')
            text=replace(text,'<script defer src="app.js"></script>','<script defer src="config.js"></script>\n<script defer src="online.js"></script>\n<script defer src="app.js"></script>')
            text=replace(text,'<link rel="stylesheet" href="style.css">','<link rel="stylesheet" href="style.css"><link rel="stylesheet" href="online.css">')
            text=replace(text,'<iframe id="previewFrame" title="Previsualización de la HMI">','<iframe id="previewFrame" title="Previsualización de la HMI" sandbox="allow-scripts">')
            text=text.replace('HMI NX ST','HMI NX Online')
        if name == 'app.js':
            text=replace(text,"let p=C.demoProject()", "let p=C.newProject()")
            text=text.replace("'hmi-nx-st:p0:","'hmi-nx-online:p0:")
            start=text.index('function renderDiag()'); end=text.index('\nfunction ',start+10)
            text=text[:start]+'''function renderDiag(){syncProjectInputs();const errors=C.validate(p);$('#diagnostics').innerHTML='<div class="diagnostic '+(errors.length?'error':'ok')+'">'+(errors.length?'Bloqueos: '+errors.length:'Validación local correcta')+'</div>'+errors.slice(0,7).map(e=>'<div class="diagnostic error">'+C.esc(e)+'</div>').join('')+'<div class="diagnostic">Compilación y tamaño HTML se verifican en Supabase al previsualizar o exportar.</div>';}'''+text[end:]
            start=text.index('function preview(){'); end=text.index('\n}',start)+2
            text=text[:start]+'''async function preview(){syncProjectInputs();try{const result=await NXOnline.request('preview',C.copy(p));$('#previewFrame').srcdoc=result.html;$('#previewDialog').showModal();clampPreviewDialog()}catch(error){toast(error.message)}}'''+text[end:]
            start=text.index("$('#exportBtn').onclick=");end=text.index(';\n',start)
            text=text[:start]+'''$('#exportBtn').onclick=async()=>{syncProjectInputs();const snapshot=C.copy(p),json=JSON.stringify(C.normalize(snapshot));try{const out=await NXOnline.request('compile',snapshot);download((snapshot.name||'WebHMI_ST').replace(/[^A-Za-z0-9_-]+/g,'_')+'_Sysmac.zip',out,'application/zip');if(p0JSON()===json)p0Checkpoint();p0Snapshot('exportado-supabase',true);toast('Paquete Sysmac generado en Supabase')}catch(error){toast(error.message)}}'''+text[end:]
            text = replace(text, "p0Snapshot('antes-abrir-archivo',true);if(p0Dirty()", "if(!p0Snapshot('antes-abrir-archivo',true)){toast('No se puede respaldar el proyecto actual. Guarda una copia antes de abrir otro.');e.target.value='';return}if(p0Dirty()")
            text = replace(text, "p0Snapshot('antes-recuperar',true);p=C.normalize", "if(!p0Snapshot('antes-recuperar',true)){toast('No se puede respaldar el proyecto actual. Recuperación cancelada.');return}p=C.normalize")
            if 'buildRuntimeHTML' in text or 'exportPackage' in text:
                raise RuntimeError('A browser compiler call escaped the split')
        (dest/name).write_text(text)
    for name in ['online.js','online.css','config.js']:
        shutil.copyfile(APP/'client'/name,dest/name)
    compiler=APP/'supabase/functions/webhmi-compile/compiler.js'
    compiler.write_text('\n'.join((SOURCE/name).read_text() for name in ['expressions.js','model.js','sysmac-types.js','runtime.js','st.js','zip.js']))
    manifest={name:hashlib.sha256((SOURCE/name).read_bytes()).hexdigest() for name in ['expressions.js','model.js','sysmac-types.js','runtime.js','st.js','zip.js']}
    (APP/'server/source-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print('Built online frontend without ST/ZIP/runtime compiler sources:',dest)

if __name__=='__main__': build(Path(sys.argv[1]) if len(sys.argv)>1 else APP/'public')
