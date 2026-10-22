import React,{useState,useEffect,useCallback,useRef} from 'react';
export type AccountUser={id:number;username:string;email:string;role:'user'|'admin'};
export function AccountGate({children}:{children:(user:AccountUser,logout:()=>void)=>React.ReactNode}){
 const [user,setUser]=useState<AccountUser|null>(null),[loaded,setLoaded]=useState(false),[create,setCreate]=useState(false),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[url,setUrl]=useState(''),[identifier,setIdentifier]=useState(''),[username,setUsername]=useState(''),[password,setPassword]=useState('');
 const checking=useRef<Promise<void>|undefined>(undefined);
 const refresh=useCallback(()=>{if(checking.current)return checking.current;checking.current=(async()=>{try{const s=await window.ember2.call('accountStatus');setUser(s.user);setUrl(s.url);}catch(e){setUser(null);setMessage(String(e));}finally{setLoaded(true);}})().finally(()=>{checking.current=undefined;});return checking.current;},[]);
 useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),30000),off=window.ember2.subscribe(()=>void refresh());return()=>{clearInterval(timer);off();};},[refresh]);
 const logout=()=>{setUser(null);void window.ember2.call('accountLogout').then(refresh);};
 if(user)return <>{children(user,logout)}</>;
 return <main className="account-screen"><div className="account-brand"><img src="./launcher.png" alt="Ember logo"/><h1>ember</h1></div><section className="account-card"><p className="eyebrow">YOUR GAMES. YOUR SPACE.</p><h2>{create?'Request an account':'Welcome back'}</h2><p>{create?'An administrator approves each new account.':'Log in to open your Ember library.'}</p>
 <form onSubmit={async e=>{e.preventDefault();setBusy(true);setMessage('');try{if(create){const r=await window.ember2.call('accountRegister',{username,email:identifier,password});setMessage(r.message);setCreate(false);}else{const s=await window.ember2.call('accountLogin',{identifier,password});setUser(s.user);}setPassword('');}catch(e){setMessage(String(e).replace(/^Error:.*?Error: /,''));}finally{setBusy(false);}}}>
 {create&&<label>Username<input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" required pattern="[a-zA-Z0-9_-]{3,32}"/></label>}
 <label>{create?'Email':'Username or email'}<input value={identifier} onChange={e=>setIdentifier(e.target.value)} type={create?'email':'text'} autoComplete={create?'email':'username'} required/></label>
 <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={create?'new-password':'current-password'} minLength={create?12:undefined} maxLength={128} required/></label>
 <button className="primary" disabled={busy||!loaded}>{busy?'Please wait…':create?'Create Account':'Log In'}</button></form>
 <button className="account-switch" disabled={busy} onClick={()=>{setCreate(!create);setMessage('');setPassword('');}}>{create?'Already requested an account? Log In':'New to Ember? Create Account'}</button>
 {message&&<p role="status" className="account-message">{message}</p>}
 <details><summary>Account service connection</summary><p>Use the address supplied by your administrator. On the server computer, start the account service before logging in.</p><label>Service address<input aria-label="Service address" value={url} onChange={e=>setUrl(e.target.value)}/></label><button disabled={busy} onClick={async()=>{try{await window.ember2.call('accountConfigure',{url});setMessage('Account service address saved.');}catch(e){setMessage(String(e));}}}>Save address</button></details>
 </section></main>;
}
