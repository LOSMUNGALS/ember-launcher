import React,{useState,useEffect,useCallback,useRef} from 'react';
import {PasswordInput} from './PasswordInput';
export type AccountUser={id:number;username:string;displayName?:string;email:string;role:'user'|'admin'};
export function AccountGate({children}:{children:(user:AccountUser,logout:()=>void)=>React.ReactNode}){
 const [user,setUser]=useState<AccountUser|null>(null),[loaded,setLoaded]=useState(false),[create,setCreate]=useState(false),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[url,setUrl]=useState(''),[identifier,setIdentifier]=useState(''),[username,setUsername]=useState(''),[password,setPassword]=useState('');
 const [forgot,setForgot]=useState(false);
 const checking=useRef<Promise<void>|undefined>(undefined);
 const refresh=useCallback(()=>{if(checking.current)return checking.current;checking.current=(async()=>{try{const s=await window.ember2.call('accountStatus');setUser(s.user);setUrl(s.url);}catch(e){setUser(null);setMessage(String(e));}finally{setLoaded(true);}})().finally(()=>{checking.current=undefined;});return checking.current;},[]);
 useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),30000),off=window.ember2.subscribe(()=>void refresh());return()=>{clearInterval(timer);off();};},[refresh]);
 const logout=()=>{setUser(null);void window.ember2.call('accountLogout').then(refresh);};
 if(user)return <>{children(user,logout)}</>;
 return <main className="account-screen"><div className="account-brand"><img src="./launcher.png" alt="Ember logo"/><h1>ember</h1></div><section className="account-card"><p className="eyebrow">YOUR GAMES. YOUR SPACE.</p><h2>{forgot?'Reset your password':create?'Request an account':'Welcome back'}</h2><p>{forgot?'Enter your account email and we’ll send a link to choose a new password.':create?'An administrator approves each new account.':'Log in to open your Ember library.'}</p>
 <form onSubmit={async e=>{e.preventDefault();setBusy(true);setMessage('');try{if(forgot){const r=await window.ember2.call('accountForgotPassword',{email:identifier});setMessage(r.message);}else if(create){const r=await window.ember2.call('accountRegister',{username,email:identifier,password});setMessage(r.message);setCreate(false);}else{const s=await window.ember2.call('accountLogin',{identifier,password});setUser(s.user);}setPassword('');}catch(e){setMessage(String(e).replace(/^Error:.*?Error: /,''));}finally{setBusy(false);}}}>
 {create&&<label>Username<input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" required pattern="[a-zA-Z0-9_-]{3,32}"/></label>}
 <label>{create||forgot?'Email':'Username or email'}<input value={identifier} onChange={e=>setIdentifier(e.target.value)} type={create||forgot?'email':'text'} autoComplete={create||forgot?'email':'username'} required/></label>
 {!forgot&&<label>Password<PasswordInput key={create?'create':'login'} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={create?'new-password':'current-password'} minLength={create?12:undefined} maxLength={128} required/></label>}
 <button className="primary" disabled={busy||!loaded}>{busy?'Please wait…':forgot?'Send reset link':create?'Create Account':'Log In'}</button></form>
 {!create&&!forgot&&<button className="forgot-password" disabled={busy} onClick={()=>{setForgot(true);setMessage('');setPassword('');}}>Forgot password?</button>}
 <button className="account-switch" disabled={busy} onClick={()=>{if(forgot){setForgot(false);setCreate(false);}else setCreate(!create);setMessage('');setPassword('');}}>{forgot?'Back to Log In':create?'Already requested an account? Log In':'New to Ember? Create Account'}</button>
 {message&&<p role="status" className="account-message">{message}</p>}
 <details><summary>Account service connection</summary><p>Use the address supplied by your administrator. On the server computer, start the account service before logging in.</p><label>Service address<input aria-label="Service address" value={url} onChange={e=>setUrl(e.target.value)}/></label><button disabled={busy} onClick={async()=>{try{await window.ember2.call('accountConfigure',{url});setMessage('Account service address saved.');}catch(e){setMessage(String(e));}}}>Save address</button></details>
 </section></main>;
}
