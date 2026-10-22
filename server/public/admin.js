let token='';
const $=id=>document.getElementById(id),message=text=>{$('message').textContent=text;};
async function api(route,body){const r=await fetch('/api/'+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok){if(r.status===401){token='';show('login');}const error=Error(data.error);error.status=r.status;throw error;}return data;}
function show(id){for(const name of ['setup','login','dashboard','forgot-password','reset-password'])$(name).hidden=name!==id;for(const input of document.querySelectorAll('[data-secret]')){input.value='';input.type='password';}for(const button of document.querySelectorAll('.password-eye')){button.setAttribute('aria-label','Show password');button.setAttribute('aria-pressed','false');}}
for(const input of document.querySelectorAll('input[type="password"]')){
 input.dataset.secret='true';const wrapper=document.createElement('span');wrapper.className='password-field';input.replaceWith(wrapper);wrapper.append(input);
 const eye=document.createElement('button');eye.type='button';eye.className='password-eye';eye.setAttribute('aria-label','Show password');eye.setAttribute('aria-pressed','false');
 eye.innerHTML='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
 eye.onclick=()=>{const shown=input.type==='password';input.type=shown?'text':'password';eye.setAttribute('aria-label',shown?'Hide password':'Show password');eye.setAttribute('aria-pressed',String(shown));};wrapper.append(eye);
}
let resetToken='',setupToken='';
function openLink(){
 resetToken=location.hash.startsWith('#reset=')?location.hash.slice(7):'';
 setupToken=location.hash.startsWith('#setup=')?location.hash.slice(7):'';
 if(resetToken||setupToken){history.replaceState(null,'','/');message('');}
 if(resetToken)show('reset-password');
 if(setupToken){const current=setupToken;show('setup');void api('setup-status').then(s=>{if(!s.setupNeeded&&setupToken===current){setupToken='';show('login');message('Administrator is already configured. Log in with your existing password.');}}).catch(e=>message(e.message));}
}
openLink();window.addEventListener('hashchange',openLink);
$('setup-login').onclick=()=>{setupToken='';show('login');message('Log in with the administrator email or ember-admin and your existing password.');};
$('forgot').onclick=()=>{show('forgot-password');$('reset-email').value=$('identifier').value.includes('@')?$('identifier').value:'';message('');};
$('forgot-login').onclick=$('reset-login').onclick=()=>{resetToken='';show('login');message('');};
$('forgot-form').onsubmit=async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;try{message((await api('forgot-password',{email:$('reset-email').value})).message);}catch(e){message(e.message);}finally{button.disabled=false;}};
$('reset-form').onsubmit=async e=>{e.preventDefault();if($('reset-new-password').value!==$('reset-confirm-password').value){message('Passwords do not match.');return;}const button=e.submitter;button.disabled=true;try{const result=await api('reset-password',{token:resetToken,password:$('reset-new-password').value});resetToken='';show('login');message(result.message);}catch(e){message(e.message);}finally{button.disabled=false;}};
$('setup-form').onsubmit=async e=>{e.preventDefault();try{const r=await api('setup',{token:setupToken,password:$('new-password').value});setupToken='';show('login');message(r.message);}catch(e){if(e.status===409){setupToken='';show('login');}message(e.message);}};
$('login-form').onsubmit=async e=>{e.preventDefault();try{const r=await api('login',{identifier:$('identifier').value,password:$('password').value});$('password').value='';if(r.user.role!=='admin'){await fetch('/api/logout',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+r.token},body:'{}'});throw Error('This website is for the administrator. Use Ember to log in.');}token=r.token;show('dashboard');message('Signed in as '+r.user.email);await refresh();}catch(e){message(e.message);}};
async function refresh(){const {users}=await api('accounts');$('accounts').replaceChildren();for(const u of users){const card=document.createElement('article'),title=document.createElement('h3'),info=document.createElement('p');title.textContent=u.username;info.textContent=`${u.email} · ${u.status}${u.retryAt?' · May request again '+new Date(u.retryAt).toLocaleString():''}`;card.append(title,info);if(u.role!=='admin')for(const [status,label] of [['approved','Approve'],['rejected','Reject for 24 hours'],['revoked','Revoke access']]){const b=document.createElement('button');b.textContent=label;b.disabled=u.status===status;b.onclick=async()=>{if(!confirm(`${label} for ${u.email}?`))return;b.disabled=true;try{await api('decision',{id:u.id,status});await refresh();message('Account access updated.');}catch(e){message(e.message);b.disabled=false;}};card.append(b);}$('accounts').append(card);}}
$('refresh').onclick=()=>refresh().catch(e=>message(e.message));
$('logout').onclick=async()=>{try{await api('logout',{});}finally{token='';show('login');message('Logged out.');}};
setInterval(()=>{if(token)void refresh().catch(e=>message(e.message));},150000);
