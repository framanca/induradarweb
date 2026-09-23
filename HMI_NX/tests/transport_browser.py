"""HTTP responses are in-browser fixtures. Not a hardware or LAN test."""
import os,json,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
src=Path(__file__).resolve().parents[1]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 page=b.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.set_content('<html><body><div id="hmi"></div></body></html>')
 for name in ['core','model','service','data','widgets','transport','runtime']:page.add_script_tag(content=(src/(name+'.js')).read_text())
 page.evaluate('''()=>{
 const p=NXCore.demoProject();p.connection={...p.connection,profile:'nx-http-v2',baseUrl:'https://fixture.invalid',sameOrigin:false,allowWrites:true,timeoutMs:300,pollMs:100};
 window.mock={now:Date.now(),inflight:0,max:0,reads:0,writes:0,fail:false,dropAck:false,hang:false};
 window.engine=new NXService.MachineService(p,{clock:()=>mock.now,mode:'reference-bench'});
 window.fetch=async(url,opts)=>{mock.inflight++;mock.max=Math.max(mock.max,mock.inflight);try{
 if(mock.hang)await new Promise((resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(new DOMException('abort','AbortError')),{once:true}));
 await new Promise(r=>setTimeout(r,15));if(mock.fail)throw new Error('sin red');const route=url.split('/api/hmi/')[1],data=opts.body?JSON.parse(opts.body):{},token=(opts.headers.Authorization||'').replace('Bearer ','');let result;
 try{if(route==='capabilities')result=engine.capabilities();else if(route==='session/login')result=engine.newSession({id:'test',name:'test',role:'operator'});else if(route==='session/touch')result=engine.touch(token);else if(route==='session/logout')result=engine.logout(token);else if(route==='read'){mock.reads++;result=engine.read(token,data.names);}else if(route==='events')result=engine.events(token,data);else if(route==='recipes')result=engine.recipes(token);else if(route==='command'){mock.writes++;result=engine.command(token,data);if(mock.dropAck){mock.dropAck=false;throw new Error('ACK perdido');}}else if(route==='command/result')result=engine.result(token,data.commandId);else throw new Error('ruta desconocida');}
 catch(e){if(!e.status)throw e;return new Response(JSON.stringify({...e.response,message:e.message,code:e.code}),{status:e.status});}
 return new Response(JSON.stringify(result));}finally{mock.inflight--;}};
 window.rt=new NXRuntime.Runtime(p,document.getElementById('hmi'),{simulate:false});
 }''')
 page.wait_for_function('rt.good',timeout=6000)
 assert page.evaluate('rt.session') is None
 page.evaluate('''async()=>{const s=await rt.transport.login('fixture','not-a-real-password');rt.setSession(s);rt.armed=true;rt.paint();}''')
 page.wait_for_function('rt.good && rt.quality("Machine.Running")',timeout=6000)
 page.evaluate('''async()=>{const o=rt.nodes.find(x=>x.o.kind==='button'&&x.o.action==='write').o;mock.dropAck=true;await rt.send(o,'write',{value:true});}''')
 assert page.evaluate('mock.writes')==1
 assert page.evaluate('!!rt.unconfirmed && !rt.armed')
 page.wait_for_timeout(450);assert page.evaluate('mock.writes')==1
 page.evaluate('rt.resolveCommand()');assert page.evaluate('rt.unconfirmed') is None
 assert page.evaluate('engine.state.values["Machine.Running"]') is True
 page.evaluate('mock.fail=true');page.wait_for_function('!rt.good',timeout=6000)
 assert page.evaluate('!rt.armed')
 page.evaluate('mock.fail=false');page.wait_for_function('rt.good',timeout=6000)
 assert page.evaluate('mock.max')==1
 # Abort produces a rejected promise, never a stuck queue (DOMException fields are readonly).
 page.evaluate('rt.stop()')
 result=page.evaluate('''async()=>{const p=NXCore.demoProject();p.connection.baseUrl='https://fixture.invalid';p.connection.sameOrigin=false;p.connection.timeoutMs=300;const t=new NXTransport.HttpTransport(p);mock.hang=true;try{await t.capabilities();return 'unexpected';}catch(e){return e.code;}finally{t.stop();mock.hang=false;}}''')
 assert result=='TIMEOUT'
 # Insecure non-loopback sessions are blocked before any credential request.
 result=page.evaluate('''async()=>{const p=NXCore.demoProject();p.connection.sameOrigin=false;p.connection.baseUrl='http://192.168.250.1:81';const t=new NXTransport.HttpTransport(p);try{await t.login('user','never-sent-value');return 'unexpected';}catch(e){return e.message;}finally{t.stop();}}''')
 assert 'HTTPS' in result
 assert errors==[],errors
 print(json.dumps({'status':'PASS','mode':'offline HTTP fixtures','checks':['capability_handshake','operation_session','no_overlapping_HTTP','lost_ACK_no_retry','explicit_result_query','network_loss_disarms','recovery','abort_timeout_rejects','insecure_login_blocked'],'browser_errors':errors},indent=2));b.close()
