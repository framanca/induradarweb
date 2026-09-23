"""Offline DOM/browser integration. Does not bypass origin policy or claim PLC testing."""
import os, re, json, zipfile, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
src=Path(__file__).resolve().parents[1]
out=Path(os.environ.get('HMI_TEST_OUTPUT',tempfile.mkdtemp(prefix='hmi-nx-browser-')));out.mkdir(parents=True,exist_ok=True)
modules=['core','model','service','data','widgets','transport','runtime','exporter','panels','app']
def load(page):
    html=(src/'index.html').read_text();html=re.sub(r'<script[^>]+src="[^"]+"[^>]*></script>','',html)
    html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+(src/'style.css').read_text()+'</style>')
    page.set_content(html)
    for f in modules:page.add_script_tag(content=(src/(f+'.js')).read_text())
    resources={f:(src/f).read_text() for f in ['style.css']+[f+'.js' for f in modules]}
    page.evaluate('(resources)=>window.fetch=async path=>new Response(resources[path],{status:resources[path]?200:404})',resources)

def sim_login(page,role):
    page.locator('#preview-host .nx-session-login').click()
    page.locator('.nx-sim-role[data-role="'+role+'"]').click()
    page.wait_for_function('NXApp.S.runtime.session && NXApp.S.runtime.good')

with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1740,'height':1080});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('dialog',lambda d:d.accept());page.set_default_timeout(6000)
    load(page);page.wait_for_selector('#stage .nx-object')
    assert page.locator('#stage .nx-object').count()==12
    phase=os.environ.get('HMI_TEST_PHASE','all')
    if phase in ['all','runtime']:
        page.locator('[data-action="preview"]').click();page.wait_for_function('NXApp.S.runtime && NXApp.S.runtime.good')
        host=page.locator('#preview-host');assert host.get_by_role('button',name='MARCHA',exact=True).is_disabled()
        sim_login(page,'observer');host.locator('.nx-arm').click();assert host.get_by_role('button',name='MARCHA',exact=True).is_disabled()
        sim_login(page,'operator');host.locator('.nx-arm').click();host.get_by_role('button',name='MARCHA',exact=True).click()
        page.wait_for_function('NXApp.S.runtime.values["Machine.Running"]===true')
        # The fault source is not polled by this view, yet is captured by the service.
        page.evaluate('NXApp.S.runtime.setSim("Machine.Fault",true)')
        page.wait_for_function('NXApp.S.runtime.alarmRows.some(a=>a.active)')
        assert page.evaluate('!NXApp.S.runtime.readStats.lastNames.includes("Machine.Fault")')
        host.get_by_role('button',name='Detalle de motor',exact=True).click();host.locator('.nx-popup').wait_for()
        page.screenshot(path=str(out/'faceplate.png'),full_page=True)
        host.locator('.nx-popup').get_by_role('button',name='Cerrar',exact=True).click();assert host.locator('.nx-popup').count()==0
        entry=host.locator('.nx-entry').first;entry.fill('63');host.locator('.nx-apply').first.click()
        page.wait_for_function('NXApp.S.runtime.values["Process.Setpoint"]===63')
        host.get_by_role('button',name='Recetas y alarmas →',exact=True).click()
        host.locator('.nx-recipe-select').wait_for();host.locator('.nx-recipe-select').select_option(index=1)
        host.get_by_role('button',name='Aplicar lote',exact=True).click()
        page.wait_for_function('NXApp.S.runtime.values["Process.Setpoint"]===75')
        assert host.locator('.nx-recipe-edit').is_disabled()
        host.get_by_role('button',name='Reconocer',exact=True).click();page.wait_for_function('NXApp.S.runtime.alarmRows.some(a=>a.ack)')
        assert page.evaluate('NXApp.S.runtime.transport.service.state.values["Machine.Fault"]') is True
        sim_login(page,'maintenance');host.locator('.nx-arm').click();host.locator('.nx-recipe-edit').click()
        page.get_by_role('button',name='Guardar versión',exact=True).click()
        page.wait_for_function('NXApp.S.runtime.recipes.some(r=>r.version===2)',timeout=6000)
        page.screenshot(path=str(out/'runtime.png'),full_page=True)
        page.locator('[data-action="close-modal"]').click()
        print('RUNTIME OK',flush=True)
    if phase=='runtime':
        assert errors==[],errors
        print(json.dumps({'status':'PASS','phase':'runtime','browser_errors':errors}));browser.close();raise SystemExit(0)
    if phase in ['all','editor']:
        # Every configuration page mounts without JS errors.
        for tab in ['variables','recipes','alarms','roles','connection','projects','help','editor']:
            print('TAB',tab,flush=True);page.locator('[data-tab="'+tab+'"]').click();page.wait_for_timeout(80)
        page.locator('[data-tab="variables"]').click();page.locator('#import-vars').click()
        page.locator('#variable-text').fill('Name\tData Type\tComment\nExtra.Label\tSTRING[80]\tPrueba')
        page.locator('#do-import').click()
        assert page.evaluate('NXApp.S.p.variables.find(v=>v.name==="Extra.Label").maxLength')==80
        page.locator('[data-tab="editor"]').click()
        print('TABS OK',flush=True)
        for kind in ['selector','switch','slider','level','symbol','circle','line','user','navigation','audit','banner']:
            page.locator('[data-kind="'+kind+'"]').click()
        print('CONTROLS OK',flush=True)
        # Configure/validate all objects through the shared state (editor UI checked separately).
        page.evaluate('''()=>{for(const o of NXApp.S.p.screens[0].objects){
        if(o.kind==='selector'){o.binding='Machine.Mode';o.writeBinding='Machine.Mode';}
        if(o.kind==='slider'||o.kind==='level'){o.binding='Process.Level';o.writeBinding='Process.Level';}
        if(o.kind==='symbol'){o.binding='Machine.Running';o.writeBinding='';}
        } NXApp.render();}''')
        assert page.evaluate('NXCore.validate(NXApp.S.p)')==[]
        page.locator('[data-kind="text"]').click();page.locator('[data-prop="text"]').fill('Prueba editable');page.locator('[data-prop="text"]').press('Tab')
        assert 'Prueba editable' in page.locator('#stage').inner_text()
        page.locator('[data-action="undo"]').click();assert 'Prueba editable' not in page.locator('#stage').inner_text()
        page.locator('[data-action="redo"]').click();assert 'Prueba editable' in page.locator('#stage').inner_text()
        # Add one raster resource; separately exported bytes are exercised by Node tests.
        page.locator('#image-file').set_input_files({'name':'logo.svg','mimeType':'image/svg+xml','buffer':b'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"><rect width="64" height="32" fill="blue"/></svg>'})
        page.wait_for_function('NXApp.S.p.assets.length===1')
        assert page.evaluate('NXApp.S.p.assets[0].data.startsWith("data:image/png")')
    if phase=='editor':
        page.screenshot(path=str(out/'editor.png'),full_page=True)
        assert errors==[],errors
        print(json.dumps({'status':'PASS','phase':'editor','browser_errors':errors}));browser.close();raise SystemExit(0)
    page.evaluate('()=>{NXApp.S.p=NXCore.demoProject();NXApp.S.screen=NXApp.S.p.screens[0].id;NXApp.S.selected=null;NXApp.S.selection=[];NXApp.S.tab="editor";NXApp.render();}')
    # Export both modes; each ZIP must pass CRC and execute its runtime offline.
    print('IMAGE OK',flush=True)
    for mode in ['single','split']:
        page.locator('[data-action="export"]').click();page.locator('#export-mode').select_option(mode)
        with page.expect_download() as info:page.locator('#download-export').click()
        print('EXPORTED',mode,flush=True)
        archive=out/(mode+'.zip');info.value.save_as(str(archive));page.locator('[data-action="close-modal"]').click()
        with zipfile.ZipFile(archive) as z:
            assert z.testzip() is None
            files={name:z.read(name) for name in z.namelist()}
        html=files['SD/index.html'].decode();exp=browser.new_page(viewport={'width':1400,'height':1000});exp.on('pageerror',lambda e:errors.append(str(e)))
        if mode=='split':
            runtime_path=re.search(r'<script src="([^"]+)"',html).group(1);css_path=re.search(r'<link rel="stylesheet" href="([^"]+)"',html).group(1)
            scripts=re.findall(r'<script(?: [^>]*)?>(.*?)</script>',html,re.S)
            shell=re.sub(r'<script[^>]*>.*?</script>','',html,flags=re.S).replace('<link rel="stylesheet" href="'+css_path+'">','<style>'+files['SD/'+css_path].decode()+'</style>')
            exp.set_content(shell);exp.add_script_tag(content=files['SD/'+runtime_path].decode())
            resources={name[3:]:value.decode() for name,value in files.items() if name.startswith('SD/') and name.endswith('.json')}
            exp.evaluate('''resources=>{window.requests=[];window.fetch=async path=>{requests.push(path);return new Response(resources[path],{status:resources[path]?200:404});};}''',resources)
            exp.add_script_tag(content=scripts[-1])
        else:exp.set_content(html)
        exp.wait_for_function('window.hmiRuntime && hmiRuntime.good',timeout=6000)
        exp.locator('.nx-session-login').click();exp.locator('.nx-sim-role[data-role="operator"]').click();exp.locator('.nx-arm').click()
        exp.get_by_role('button',name='MARCHA',exact=True).first.click();exp.wait_for_function('hmiRuntime.values["Machine.Running"]===true',timeout=6000)
        if mode=='split':
            assert exp.evaluate('requests.length')==2 # active screen + master; not all views
            exp.get_by_role('button',name='Recetas y alarmas →',exact=True).click();exp.wait_for_function('requests.length===3',timeout=6000)
        exp.screenshot(path=str(out/('export_'+mode+'.png')),full_page=True);exp.evaluate('hmiRuntime.stop()');exp.close()
    page.screenshot(path=str(out/'editor.png'),full_page=True)
    assert errors==[],errors
    print(json.dumps({'status':'PASS','browser_errors':errors,'checks':['operation_roles','confirmed_commands','alarms_outside_active_screen','faceplate','numeric_input','recipe_batch','recipe_edit_role','central_ack','all_editor_tabs','sysmac_string_length','new_controls','undo_redo','SVG_rasterization','single_export_runtime','split_export_lazy_views'],'not_tested':['NX102 hardware','Omron library protocol','real-origin IndexedDB reload','actual browser LAN traffic']},indent=2))
    browser.close()
