from playwright.sync_api import sync_playwright
from pathlib import Path
import re
root=Path(__file__).resolve().parents[1]
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True,args=['--no-sandbox'],executable_path='/usr/bin/chromium')
    p=b.new_page(viewport={'width':1600,'height':1000})
    errors=[];p.on('pageerror',lambda e: errors.append(str(e)))
    html=(root/'index.html').read_text()
    html=re.sub(r'<script[^>]+src="[^"]+"[^>]*></script>','',html)
    html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+(root/'style.css').read_text()+'</style>')
    p.set_content(html)
    
    for f in ['model.js','runtime.js','st.js','zip.js','app.js']:
        p.add_script_tag(content=(root/f).read_text())
    p.wait_for_selector('#canvas .widget')
    assert p.locator('#varList .var-row').count()==4
    p.get_by_role('button',name='Texto',exact=True).click()
    assert p.locator('#canvas .widget').count()==7
    p.locator('#previewBtn').click();p.wait_for_selector('#previewDialog[open]')
    p.locator('#closePreview').click()
    assert not errors, errors
    b.close()
print('browser smoke PASS')
