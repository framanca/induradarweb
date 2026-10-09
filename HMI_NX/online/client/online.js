(function(){
'use strict';
const config=window.WEBHMI_ONLINE_CONFIG;
let session=null,loginDialog,status;
const endpoint=config.supabaseUrl.replace(/\/$/,'');
function headers(){return {apikey:config.publishableKey,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'};}
async function parse(response){let data;try{data=await response.json()}catch{throw new Error('Respuesta no válida del servidor')}if(!response.ok)throw new Error(data.error_description||data.msg||data.error||'Solicitud rechazada');return data;}
function lock(message){session=null;if(status)status.textContent=message;if(loginDialog&&!loginDialog.open)loginDialog.showModal();}
async function refresh(){
 if(!session)throw new Error('Inicia sesión para compilar');
 if(Date.now()<session.expires_at*1000-60000)return;
 try{const result=await parse(await fetch(endpoint+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token}),signal:AbortSignal.timeout(30000)}));session=result;}
 catch(error){lock('La sesión ha caducado');throw error;}
}
async function request(action,project){
 await refresh();
 const response=await fetch(endpoint+'/functions/v1/'+config.functionName,{method:'POST',headers:headers(),body:JSON.stringify({action,project}),signal:AbortSignal.timeout(30000)});
 if(!response.ok){if(response.status===401||response.status===403)lock('Acceso no autorizado.');await parse(response);}
 return action==='compile'?await response.blob():await parse(response);
}
window.NXOnline=Object.freeze({request});
document.addEventListener('DOMContentLoaded',()=>{
 loginDialog=document.createElement('dialog');loginDialog.id='onlineLogin';
 loginDialog.innerHTML='<form id="onlineLoginForm"><h2>WebHMI Online</h2><p>Accede con una cuenta autorizada para compilar.</p><label>Correo<input name="email" type="email" autocomplete="username" required></label><label>Contraseña<input name="password" type="password" autocomplete="current-password" required></label><p id="onlineLoginStatus" role="status"></p><button type="submit" class="primary">Entrar</button><p class="hint">Las cuentas las autoriza el propietario. Tu proyecto se conserva en este navegador; se envía a Supabase al previsualizar o exportar.</p></form>';
 document.body.append(loginDialog);status=document.querySelector('#onlineLoginStatus');
 loginDialog.addEventListener('cancel',e=>e.preventDefault());
 const form=loginDialog.querySelector('form');
 form.addEventListener('submit',async e=>{
  e.preventDefault();const button=form.querySelector('button');button.disabled=true;status.textContent='Comprobando acceso…';
  try{session=await parse(await fetch(endpoint+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({email:form.elements.email.value,password:form.elements.password.value}),signal:AbortSignal.timeout(30000)}));await request('access');form.elements.password.value='';status.textContent='';loginDialog.close();}
  catch(error){lock(error.message)}finally{button.disabled=false}
 });
 const logout=document.createElement('button');logout.textContent='Salir';
 logout.onclick=async()=>{const old=session;lock('Sesión cerrada');if(old)try{await fetch(endpoint+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:config.publishableKey,Authorization:'Bearer '+old.access_token},signal:AbortSignal.timeout(10000)})}catch{}};
 document.querySelector('.top-actions').append(logout);lock('');
});
})();
