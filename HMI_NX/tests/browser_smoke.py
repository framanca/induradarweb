import os,json,zipfile,re
from playwright.sync_api import sync_playwright
from pathlib import Path
import tempfile
src=str(Path(__file__).resolve().parents[1]);base=tempfile.mkdtemp(prefix='hmi-nx-browser-')
def load(page):
    html=open(src+'/index.html').read()
    html=re.sub(r'<script[^>]+src="[^"]+"[^>]*></script>','',html)
    html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+open(src+'/style.css').read()+'</style>')
    page.set_content(html)
    for name in ['core.js','runtime.js','panels.js','app.js']:
        page.add_script_tag(content=open(src+'/'+name).read())
    # Network-free fixture for the bundler; no browser policy changes.
    resources={x:open(src+'/'+x).read() for x in ['style.css','core.js','runtime.js']}
    page.evaluate('(resources)=>window.fetch=async path=>new Response(resources[path],{status:resources[path]?200:404})',resources)
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1600,'height':1000},device_scale_factor=1)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    load(page)
    page.wait_for_selector('#stage .nx-object')
    assert page.locator('#stage .nx-object').count()==10
    page.screenshot(path=base+'/editor.png',full_page=True)
    page.locator('[data-action="preview"]').click()
    page.wait_for_selector('#preview-host .nx-runtime')
    host=page.locator('#preview-host')
    host.get_by_role('button',name='MARCHA',exact=True).click()
    assert page.evaluate('NXApp.S.runtime.values["Machine.Running"]') is True
    host.locator('.nx-entry').first.fill('63');host.locator('.nx-apply').first.click()
    assert page.evaluate('NXApp.S.runtime.values["Process.Setpoint"]')==63
    host.get_by_role('button',name='Recetas y alarmas →',exact=True).click()
    host.locator('.nx-recipe-body select').select_option(index=1)
    host.get_by_role('button',name='Aplicar lote de receta',exact=True).click()
    assert page.evaluate('NXApp.S.runtime.values["Process.Setpoint"]')==75
    host.get_by_role('button',name='Activar alarma',exact=True).click()
    host.locator('.nx-alarm-row.high').wait_for()
    host.get_by_role('button',name='Reconocer',exact=True).click()
    assert page.evaluate('NXApp.S.runtime.events[0].ack') is True
    page.screenshot(path=base+'/runtime.png',full_page=True)
    page.locator('[data-action="close-modal"]').click()
    page.locator('[data-action="export"]').click()
    with page.expect_download() as info:page.locator('#download-export').click()
    info.value.save_as(base+'/demo_export.zip')
    with zipfile.ZipFile(base+'/demo_export.zip') as z:
        assert z.testzip() is None
        assert 'SD/index.html' in z.namelist()
        html=z.read('SD/index.html').decode()
        assert 'supabase' not in html.lower()
        assert '<script src=' not in html
        os.makedirs(base+'/exported',exist_ok=True)
        open(base+'/exported/index.html','w').write(html)
    page.locator('[data-action="close-modal"]').click()
    page.locator('[data-tab="variables"]').click()
    assert page.locator('[data-var-row]').count()==6
    page.locator('#import-vars').click()
    page.locator('#variable-text').fill('Name\tData Type\tComment\nExtra.Value\tREAL\tTest')
    page.locator('#do-import').click()
    assert page.locator('[data-var-row]').count()==7
    for tab in ['recipes','alarms','connection','projects','help','editor']:
        page.locator(f'[data-tab="{tab}"]').click();page.wait_for_timeout(60)
    page.locator('[data-kind="text"]').click()
    assert page.locator('#stage .nx-object').count()==11
    page.locator('[data-prop="text"]').fill('Texto probado');page.locator('[data-prop="text"]').press('Tab')
    assert 'Texto probado' in page.locator('#stage').inner_text()
    page.locator('[data-action="undo"]').click();assert 'Texto probado' not in page.locator('#stage').inner_text()
    page.locator('[data-action="redo"]').click();assert 'Texto probado' in page.locator('#stage').inner_text()
    exp=browser.new_page(viewport={'width':1280,'height':900})
    exp.on('pageerror',lambda e:errors.append(str(e)))
    exp.set_content(html)
    exp.wait_for_selector('.nx-runtime')
    exp.get_by_role('button',name='MARCHA',exact=True).click()
    exp.get_by_role('button',name='Recetas y alarmas →',exact=True).click()
    assert exp.locator('.nx-recipe-apply').count()==1
    exp.screenshot(path=base+'/exported_runtime.png',full_page=True)
    assert errors==[],errors
    result={'status':'PASS','browser_errors':errors,'mode':'Offline DOM browser fixture; no actual PLC or hosted network','not_tested':['IndexedDB persistence across origin reload (browser policy denies navigation)','NX102 hardware','official Omron protocol'], 'checks':['designer','simulation_write','numeric_write','recipe_batch','alarm_ack','navigation','zip_download','self_contained_export','variables_import','all_panels','undo_redo','exported_runtime']}
    print(json.dumps(result,indent=2));open(base+'/browser-test-results.json','w').write(json.dumps(result,indent=2))
    browser.close()
