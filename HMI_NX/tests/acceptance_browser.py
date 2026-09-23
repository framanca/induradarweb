"""Browser acceptance for editor, operation roles and both SD formats.
Default is an offline DOM fixture. HMI_BROWSER_ORIGIN exercises real origin storage.
No actual NX102 or Omron driver is involved in either mode.
"""
import os, re, json, zipfile, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
SRC = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('HMI_TEST_OUTPUT', tempfile.mkdtemp(prefix='hmi-browser-')))
OUT.mkdir(parents=True, exist_ok=True)
MODULES = ['core','model','service','data','widgets','transport','runtime','exporter','panels','app']
ORIGIN = os.environ.get('HMI_BROWSER_ORIGIN', '')
PHASE = os.environ.get('HMI_TEST_PHASE','all')

def load(page):
    if ORIGIN:
        page.goto(ORIGIN, wait_until='networkidle')
    else:
        html = (SRC/'index.html').read_text()
        html = re.sub(r'<script[^>]+src="[^"]+"[^>]*></script>', '', html)
        html = html.replace('<link rel="stylesheet" href="style.css">', '<style>'+(SRC/'style.css').read_text()+'</style>')
        page.set_content(html)
        for f in MODULES:
            page.add_script_tag(content=(SRC/(f+'.js')).read_text())
        resources = {f:(SRC/f).read_text() for f in ['style.css']+[f+'.js' for f in MODULES]}
        page.evaluate('(resources)=>window.fetch=async path=>new Response(resources[path],{status:resources[path]?200:404})', resources)
    page.wait_for_function('window.NXApp && NXApp.S.p.schemaVersion === 2')
    page.wait_for_selector('#stage .nx-object')

def login(page, role):
    page.locator('#preview-host .nx-session-login').click()
    page.locator('.nx-sim-role[data-role="'+role+'"]').click()
    page.wait_for_function('NXApp.S.runtime.session && NXApp.S.runtime.good')

def fresh_demo(page):
    page.evaluate('()=>{NXApp.S.p=NXCore.demoProject(); NXApp.S.screen=NXApp.S.p.screens[0].id; NXApp.S.selected=null; NXApp.S.selection=[]; NXApp.S.tab="editor"; NXApp.render();}')

with sync_playwright() as pw:
    launch = {'headless':True, 'args':['--no-sandbox']}
    binary = os.environ.get('CHROMIUM_PATH')
    if binary:
        launch['executable_path'] = binary
    browser = pw.chromium.launch(**launch)
    page = browser.new_page(viewport={'width':1740,'height':1080})
    page.set_default_timeout(8000)
    errors=[]
    page.on('pageerror', lambda e:errors.append(str(e)))
    page.on('dialog', lambda d:d.accept())
    load(page)
    checks=[]
    if PHASE in ['all','runtime']:
        page.locator('[data-action="preview"]').click()
        page.wait_for_function('NXApp.S.runtime && NXApp.S.runtime.good')
        host=page.locator('#preview-host')
        assert host.get_by_role('button',name='MARCHA',exact=True).is_disabled()
        login(page,'observer');host.locator('.nx-arm').click()
        assert host.get_by_role('button',name='MARCHA',exact=True).is_disabled()
        login(page,'operator');host.locator('.nx-arm').click()
        host.get_by_role('button',name='MARCHA',exact=True).click()
        page.wait_for_function('NXApp.S.runtime.values["Machine.Running"]===true')
        page.evaluate('NXApp.S.runtime.setSim("Machine.Fault",true)')
        page.wait_for_function('NXApp.S.runtime.alarmRows.some(a=>a.active)')
        assert page.evaluate('!NXApp.S.runtime.readStats.lastNames.includes("Machine.Fault")')
        host.get_by_role('button',name='Detalle de motor',exact=True).click()
        host.locator('.nx-popup').wait_for()
        page.screenshot(path=str(OUT/'faceplate.png'),full_page=True)
        host.locator('.nx-popup').get_by_role('button',name='Cerrar',exact=True).click()
        assert host.locator('.nx-popup').count()==0
        host.locator('.nx-entry').first.fill('63');host.locator('.nx-apply').first.click()
        page.wait_for_function('NXApp.S.runtime.values["Process.Setpoint"]===63')
        host.get_by_role('button',name='Recetas y alarmas →',exact=True).click()
        host.locator('.nx-recipe-select').wait_for()
        host.locator('.nx-recipe-select').select_option(index=1)
        host.get_by_role('button',name='Aplicar lote',exact=True).click()
        page.wait_for_function('NXApp.S.runtime.values["Process.Setpoint"]===75')
        assert host.locator('.nx-recipe-edit').is_disabled()
        host.get_by_role('button',name='Reconocer',exact=True).click()
        page.wait_for_function('NXApp.S.runtime.alarmRows.some(a=>a.ack)')
        assert page.evaluate('NXApp.S.runtime.transport.service.state.values["Machine.Fault"]') is True
        login(page,'maintenance');host.locator('.nx-arm').click()
        host.locator('.nx-recipe-edit').click()
        page.get_by_role('button',name='Guardar versión',exact=True).click()
        page.wait_for_function('NXApp.S.runtime.recipes.some(r=>r.version===2)')
        page.screenshot(path=str(OUT/'runtime.png'),full_page=True)
        page.locator('[data-action="close-modal"]').click()
        checks += ['operation_roles','confirmed_commands','alarms_outside_active_view','faceplate','numeric_input','recipe_batch_and_version','central_ack']
    if PHASE in ['all','editor']:
        for tab in ['variables','recipes','alarms','roles','connection','projects','help','editor']:
            page.locator('[data-tab="'+tab+'"]').click()
        page.locator('[data-tab="variables"]').click()
        page.locator('#import-vars').click()
        page.locator('#variable-text').fill('Name\tData Type\tComment\nExtra.Label\tSTRING[80]\tPrueba')
        page.locator('#do-import').click()
        assert page.evaluate('NXApp.S.p.variables.find(v=>v.name==="Extra.Label").maxLength')==80
        page.locator('[data-tab="editor"]').click()
        for kind in ['selector','switch','slider','level','symbol','circle','line','user','navigation','audit','banner']:
            page.locator('[data-kind="'+kind+'"]').click()
        page.evaluate('''()=>{for(const o of NXApp.S.p.screens[0].objects){
          if(o.kind==='selector'){o.binding='Machine.Mode';o.writeBinding='Machine.Mode';}
          if(o.kind==='slider'||o.kind==='level'){o.binding='Process.Level';o.writeBinding='Process.Level';}
          if(o.kind==='symbol'){o.binding='Machine.Running';o.writeBinding='';}
        } NXApp.render();}''')
        assert page.evaluate('NXCore.validate(NXApp.S.p)')==[]
        page.locator('[data-kind="text"]').click()
        page.locator('[data-prop="text"]').fill('Texto probado')
        page.locator('[data-prop="text"]').press('Tab')
        assert 'Texto probado' in page.locator('#stage').inner_text()
        page.locator('[data-action="undo"]').click()
        assert 'Texto probado' not in page.locator('#stage').inner_text()
        page.locator('[data-action="redo"]').click()
        assert 'Texto probado' in page.locator('#stage').inner_text()
        # An imported SVG is rasterized, not inserted as executable markup.
        page.locator('#image-file').set_input_files({'name':'logo.svg','mimeType':'image/svg+xml','buffer':b'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"><rect width="64" height="32" fill="blue"/></svg>'})
        page.wait_for_function('NXApp.S.p.assets.length===1')
        assert page.evaluate('NXApp.S.p.assets[0].data.startsWith("data:image/png")')
        checks += ['all_editor_tabs','Sysmac_STRING_length','new_controls','undo_redo','image_import']
        if ORIGIN:
            page.locator('#project-name').fill('Persistencia comprobada')
            page.locator('#project-name').press('Tab')
            page.wait_for_function('document.querySelector("#save-state").textContent.includes("Guardado")')
            page.reload(wait_until='networkidle')
            page.wait_for_function('NXApp.S.p.name==="Persistencia comprobada"')
            assert page.evaluate('NXApp.S.p.assets.length')==1
            checks += ['IndexedDB_real_origin_reload']
        page.screenshot(path=str(OUT/'editor.png'),full_page=True)
    if PHASE in ['all','export']:
        fresh_demo(page)
        for mode in ['single','split']:
            page.locator('[data-action="export"]').click()
            page.locator('#export-mode').select_option(mode)
            with page.expect_download() as info:
                page.locator('#download-export').click()
            archive=OUT/(mode+'.zip');info.value.save_as(str(archive))
            page.locator('[data-action="close-modal"]').click()
            with zipfile.ZipFile(archive) as z:
                assert z.testzip() is None
                files={name:z.read(name) for name in z.namelist()}
            html=files['SD/index.html'].decode()
            exp=browser.new_page(viewport={'width':1400,'height':1000})
            exp.set_default_timeout(8000)
            exp.on('pageerror',lambda e:errors.append(str(e)))
            if mode=='split':
                runtime_path=re.search(r'<script src="([^"]+)"',html).group(1)
                css_path=re.search(r'<link rel="stylesheet" href="([^"]+)"',html).group(1)
                scripts=re.findall(r'<script(?: [^>]*)?>(.*?)</script>',html,re.S)
                shell=re.sub(r'<script[^>]*>.*?</script>','',html,flags=re.S).replace('<link rel="stylesheet" href="'+css_path+'">','<style>'+files['SD/'+css_path].decode()+'</style>')
                exp.set_content(shell)
                exp.add_script_tag(content=files['SD/'+runtime_path].decode())
                resources={name[3:]:value.decode() for name,value in files.items() if name.startswith('SD/') and name.endswith('.json')}
                exp.evaluate('''resources=>{window.requests=[];window.fetch=async path=>{requests.push(path);return new Response(resources[path],{status:resources[path]?200:404});};}''',resources)
                exp.add_script_tag(content=scripts[-1])
            else:
                exp.set_content(html)
            exp.wait_for_function('window.hmiRuntime && hmiRuntime.good',timeout=8000)
            exp.locator('.nx-session-login').click()
            exp.locator('.nx-sim-role[data-role="operator"]').click()
            exp.locator('.nx-arm').click()
            exp.get_by_role('button',name='MARCHA',exact=True).first.click()
            exp.wait_for_function('hmiRuntime.values["Machine.Running"]===true',timeout=8000)
            if mode=='split':
                assert exp.evaluate('requests.length')==2
                exp.get_by_role('button',name='Recetas y alarmas →',exact=True).click()
                exp.wait_for_function('requests.length===3',timeout=8000)
            exp.screenshot(path=str(OUT/('export_'+mode+'.png')),full_page=True)
            exp.evaluate('hmiRuntime.stop()');exp.close()
        checks += ['ZIP_CRC','single_runtime','split_runtime_lazy_views']
    assert errors==[], errors
    report={'status':'PASS','phase':PHASE,'origin':ORIGIN or 'offline DOM fixture','browser_errors':errors,'checks':checks,'not_tested':['NX102 hardware','Omron FB protocol','PLC latency and SD limits']}
    (OUT/('browser-'+PHASE+'.json')).write_text(json.dumps(report,indent=2))
    print(json.dumps(report,indent=2))
    browser.close()
