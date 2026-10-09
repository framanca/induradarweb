"""Bundle the current ST editor. Only the offline copy receives native adapters."""
import hashlib
import json
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
REPO = APP.parents[1]
SOURCE = REPO / "HMI_NX_ST"
DEST = APP / "assets" / "editor"
FILES = ["index.html", "style.css", "expressions.js", "model.js", "sysmac-types.js", "runtime.js", "st.js", "zip.js", "history.js", "app.js"]


def once(text, before, after):
    if text.count(before) != 1:
        raise RuntimeError("The editor changed; review the offline adapter anchor: " + before[:80])
    return text.replace(before, after, 1)


def bundle():
    DEST.mkdir(parents=True, exist_ok=True)
    manifest = {"source": "HMI_NX_ST", "files": {}}
    for name in FILES:
        original = (SOURCE / name).read_bytes()
        manifest["files"][name] = hashlib.sha256(original).hexdigest()
        text = original.decode("utf-8")
        if name == "index.html":
            text = once(text, '<link rel="stylesheet" href="style.css">', '<link rel="stylesheet" href="style.css"><link rel="stylesheet" href="offline.css">')
            text = once(text, '<script defer src="app.js"></script>', '<script defer src="offline.js"></script><script defer src="app.js"></script>')
        if name == "app.js":
            text = once(text, "let p=C.demoProject()", "let p=C.newProject()")
            if text.count("localStorage.") < 5:
                raise RuntimeError("Storage hooks changed")
            text = text.replace("localStorage.", "NXOffline.storage.")
            start = text.index("function download(name,")
            end = text.index("\nfunction preview()", start)
            text = text[:start] + "function download(name,data,type='application/octet-stream'){return NXOffline.download(name,data,type);}" + text[end:]
            start = text.index("$('#saveBtn').onclick=")
            end = text.index(";$('#loadBtn').onclick=", start)
            text = text[:start] + """$('#saveBtn').onclick=async()=>{syncProjectInputs();try{p0Snapshot('antes-guardado',true);const expected=p0JSON(),data=JSON.stringify(C.normalize(p),null,2);const saved=await download((p.name||'project').replace(/[^A-Za-z0-9_-]+/g,'_')+'.nxst',data,'application/json');if(saved){if(p0JSON()===expected)p0Checkpoint();p0Snapshot('guardado-manual',true);toast('Proyecto guardado')}}catch(error){toast('No se pudo guardar: '+error.message)}}""" + text[end:]
            start = text.index("$('#exportBtn').onclick=")
            end = text.index(";\n$('#undoBtn').onclick=", start)
            text = text[:start] + """$('#exportBtn').onclick=async()=>{syncProjectInputs();try{const expected=p0JSON(),out=C.exportPackage(p),name=(p.name||'WebHMI_ST').replace(/[^A-Za-z0-9_-]+/g,'_')+'_Sysmac.zip';p0Snapshot('antes-exportar',true);const saved=await download(name,out.zip,'application/zip');if(saved){if(p0JSON()===expected)p0Checkpoint();p0Snapshot('exportado-sysmac',true);toast('Paquete Sysmac guardado')}}catch(error){toast(error.message)}}""" + text[end:]
            # The runtime places a newline before </script>; match the invocation itself.
            start = text.index('function preview()')
            end = text.index('\n', start)
            preview = text[start:end].replace('startComm();</script>', 'startComm();').replace('paint();</script>', 'paint();')
            text = text[:start] + preview + text[end:]
            text = once(text, "p0Snapshot('antes-abrir-archivo',true);if(p0Dirty()", "if(!p0Snapshot('antes-abrir-archivo',true)){toast('No se puede respaldar el proyecto actual. Guarda una copia antes de abrir otro.');e.target.value='';return}if(p0Dirty()")
            text = once(text, "p0Snapshot('antes-recuperar',true);p=C.normalize", "if(!p0Snapshot('antes-recuperar',true)){toast('No se puede respaldar el proyecto actual. Recuperación cancelada.');return}p=C.normalize")
            text = text.replace("Guardado local", "Guardado en disco")
            # A native recovery enters through the same model/history paths as a normal open.
            api = """window.NXOfflineEditor={copyWidget,pasteWidget,flush:()=>p0Snapshot('app-oculta',false),getProject:()=>C.copy(p),openProject:q=>{if(!p0Snapshot('antes-recuperar-disco',true))return false;if(!confirm('¿Recuperar esta versión? El proyecto actual se conserva en las copias.'))return false;p=C.normalize(q);screenId=p.screens[0].id;selected=null;editReset();render();p0Checkpoint();p0Snapshot('recuperado-disco',true);return true}};
"""
            text = once(text, "\np0Boot();", "\n" + api + "p0Boot();")
        (DEST / name).write_text(text, encoding="utf-8")
    for name in ["offline.js", "offline.css"]:
        (DEST / name).write_bytes((APP / "tool" / name).read_bytes())
    (DEST / "source-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print("Bundled current WebHMI ST editor with offline adapters.")


if __name__ == "__main__":
    bundle()
