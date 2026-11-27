(function(){
'use strict';
const config=window.WEBHMI_ONLINE_CONFIG;
let session=null,loginDialog,status;
const endpoint=config.supabaseUrl.replace(/\/$/,'');
function headers(){return {apikey:config.publishableKey,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'};}
async function parse(response){let data;try{data=await response.json()}catch{throw new Error('Invalid server response')}if(!response.ok)throw new Error(data.error_description||data.msg||data.error||'Request rejected');return data;}
function lock(message){session=null;if(status)status.textContent=message;if(loginDialog&&!loginDialog.open)loginDialog.showModal();}
async function refresh(){
 if(!session)throw new Error('Sign in to compile');
 if(Date.now()<session.expires_at*1000-60000)return;
 try{const result=await parse(await fetch(endpoint+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token}),signal:AbortSignal.timeout(30000)}));session=result;}
 catch(error){lock('Your session has expired');throw error;}
}
async function request(action,project){
 await refresh();
 const response=await fetch(endpoint+'/functions/v1/'+config.functionName,{method:'POST',headers:headers(),body:JSON.stringify({action,project}),signal:AbortSignal.timeout(30000)});
 if(!response.ok){if(response.status===401||response.status===403)lock('Unauthorized access.');await parse(response);}
 return (action==='compile'||action==='compile-lite')?await response.blob():await parse(response);
}
window.NXOnline=Object.freeze({request,hasSession:()=>Boolean(session)});
document.addEventListener('DOMContentLoaded',()=>{
 loginDialog=document.createElement('dialog');loginDialog.id='onlineLogin';
 loginDialog.innerHTML='<form id="onlineLoginForm"><h2>WebHMI Online</h2><p>Sign in with your account or continue as a guest.</p><label>Email<input name="email" type="email" autocomplete="username" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><p id="onlineLoginStatus" role="status"></p><button type="submit" class="primary">Sign in</button><div class="online-separator"><span>or</span></div><button id="onlineGuestBtn" type="button">Continue as guest</button><p class="hint">Registered accounts require owner approval. As a guest, you do not need an email or password. Compilation still runs in Supabase and is logged. Your project remains in this browser.</p></form>';
 document.body.append(loginDialog);status=document.querySelector('#onlineLoginStatus');
 loginDialog.addEventListener('cancel',e=>e.preventDefault());
 const form=loginDialog.querySelector('form'),guestButton=loginDialog.querySelector('#onlineGuestBtn');
 form.addEventListener('submit',async e=>{
  e.preventDefault();const button=form.querySelector('button');button.disabled=true;status.textContent='Checking access…';
  try{session=await parse(await fetch(endpoint+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({email:form.elements.email.value,password:form.elements.password.value}),signal:AbortSignal.timeout(30000)}));await request('access');form.elements.password.value='';status.textContent='';loginDialog.close();window.dispatchEvent(new Event('webhmi-online-session'));}
  catch(error){lock(error.message)}finally{button.disabled=false}
 });
 guestButton.addEventListener('click',async()=>{
  const submit=form.querySelector('button[type="submit"]');guestButton.disabled=true;submit.disabled=true;status.textContent='Creating guest session…';
  try{
   session=await parse(await fetch(endpoint+'/auth/v1/signup',{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({data:{webhmi_guest:true}}),signal:AbortSignal.timeout(30000)}));
   const access=await request('access');
   if(!access.guest)throw new Error('Supabase did not return a guest session');
   status.textContent='';loginDialog.close();window.dispatchEvent(new Event('webhmi-online-session'));
  }catch(error){lock(error.message)}finally{guestButton.disabled=false;submit.disabled=false}
 });
 const logout=document.createElement('button');logout.textContent='Sign out';
 logout.onclick=async()=>{const old=session;lock('Signed out');window.dispatchEvent(new Event('webhmi-online-session'));if(old)try{await fetch(endpoint+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:config.publishableKey,Authorization:'Bearer '+old.access_token},signal:AbortSignal.timeout(10000)})}catch{}};
 document.querySelector('.top-actions').append(logout);lock('');
});
})();
