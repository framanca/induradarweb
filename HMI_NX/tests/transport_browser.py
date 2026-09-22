import json,os
from pathlib import Path
import tempfile
from playwright.sync_api import sync_playwright
base=str(Path(__file__).resolve().parents[1]);result_dir=tempfile.mkdtemp(prefix='hmi-nx-transport-')
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 page=b.new_page();page.set_content('<html><body><div id="hmi"></div></body></html>')
 for f in ['core.js','runtime.js']:page.add_script_tag(content=open(base+'/'+f).read())
 page.evaluate('''() => {
 const p=NXCore.demoProject();p.connection={profile:'nx-http-v1',baseUrl:'https://adapter.test',sameOrigin:false,pollMs:100,timeoutMs:400,allowWrites:true};
 window.mock={values:NXRuntime.initial(p),reads:0,writes:0,inflight:0,maxInflight:0,fail:false,missing:false,badAck:false,ids:[]};
 window.fetch=async(url,options)=>{
 const payload=JSON.parse(options.body);
 if(url.endsWith('/read')){
 mock.reads++;mock.inflight++;mock.maxInflight=Math.max(mock.maxInflight,mock.inflight);await new Promise(r=>setTimeout(r,150));mock.inflight--;
 if(mock.fail)throw new Error('cable desconectado');
 return new Response(JSON.stringify({values:mock.missing?{}:mock.values}),{status:200});
 }
 mock.writes++;mock.ids.push(payload.commandId);Object.assign(mock.values,payload.values);
 return new Response(JSON.stringify({commandId:payload.commandId,accepted:true,applied:!mock.badAck}),{status:200});
 };
 window.rt=new NXRuntime.Runtime(p,document.getElementById('hmi'));
 }''')
 page.wait_for_function('rt.good')
 assert page.evaluate('rt.armed') is False
 page.evaluate('rt.write({"Machine.Running":true})')
 assert page.evaluate('mock.writes')==0
 page.locator('.nx-arm').click()
 page.evaluate('rt.write({"Machine.Running":true})')
 assert page.evaluate('mock.writes')==1
 page.wait_for_function('rt.values["Machine.Running"]===true')
 page.evaluate('rt.write({"Process.Setpoint":1000})')
 assert page.evaluate('mock.writes')==1
 assert 'no confirmada' in page.locator('.nx-status').inner_text()
 page.locator('.nx-arm').click()
 page.evaluate('mock.badAck=true')
 page.evaluate('rt.write({"Process.Setpoint":70,"Product.Name":"Test"})')
 assert page.evaluate('mock.writes')==2
 assert page.evaluate('rt.armed') is False
 page.wait_for_timeout(350)
 assert page.evaluate('mock.writes')==2
 assert 'Falta confirmación' in page.locator('.nx-status').inner_text()
 assert page.evaluate('mock.maxInflight')==1
 page.evaluate('mock.fail=true')
 page.wait_for_function('!rt.good')
 assert page.evaluate('rt.armed') is False
 assert 'Sin conexión' in page.locator('.nx-status').inner_text()
 assert page.locator('.nx-button button').first.is_disabled()
 page.evaluate('mock.fail=false;mock.missing=true')
 page.wait_for_timeout(1300)
 assert page.evaluate('rt.good') is False
 assert 'Falta la variable' in page.locator('.nx-status').inner_text()
 page.evaluate('rt.stop()');n=page.evaluate('mock.reads');page.wait_for_timeout(1200);assert page.evaluate('mock.reads')==n
 result={'status':'PASS','type':'mocked HTTP transport in browser; not actual NX102','checks':['read_batch','no_overlapping_reads','writes_initially_disarmed','range_validation','command_ack','batch_ack_failure','no_write_retry','latched_command_error','connection_loss','stale_disarms','missing_tag_rejected','stop_cancels_scheduler']}
 print(json.dumps(result,indent=2));open(result_dir+'/transport-test-results.json','w').write(json.dumps(result,indent=2));b.close()
