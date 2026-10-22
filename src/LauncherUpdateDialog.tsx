import React,{useEffect,useRef,useState} from 'react';
import type {LauncherUpdateState} from './launcher-update-types';
import {RichText} from './RichText';
export function LauncherUpdateDialog({state,onClose}:{state:LauncherUpdateState;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),[error,setError]=useState(''),[submitting,setSubmitting]=useState(false);
 useEffect(()=>{dialog.current?.showModal();},[]);
 const busy=submitting||['downloading','downloaded','installing'].includes(state.phase);
 return <dialog ref={dialog} className="launcher-update-dialog" aria-label="Ember launcher update" onCancel={e=>{if(busy)e.preventDefault();else onClose();}}>
  <header><h2>Update - {state.release?.title||'New games, new features, and bugs squashed.'}</h2><button type="button" aria-label="Close launcher update" disabled={busy} onClick={onClose}>✕</button></header>
  <p>Version number: <strong>{state.release?.version||state.currentVersion}</strong></p>
  <div className="launcher-release-notes"><RichText text={state.release?.notes||'New games, new features, and bug fixes for Ember.'}/></div>
  <p>Ember will pause game downloads, download and verify this update, then close, install it, and reopen automatically. Your library and download records are kept.</p>
  <p className="muted">Resume downloads after reopening Ember. File-host downloads may require Retry from the host page.</p>
  {!state.supported&&<p>{state.reason}</p>}
  {(state.error||error)&&<p role="alert">{state.error||error}</p>}
  {busy&&<div role="status"><p>{state.phase==='installing'?'Installing update and restarting Ember…':'Preparing launcher update…'}</p><progress max={100} value={state.phase==='downloading'?state.percent:undefined}/>{state.phase==='downloading'&&<span> {Math.round(state.percent||0)}%</span>}</div>}
  <button className="primary" disabled={busy||!state.supported||!state.release} onClick={async()=>{setSubmitting(true);setError('');try{await window.ember2.call('installLauncherUpdate');}catch(e){setError(String(e));}finally{setSubmitting(false);}}}>{busy?'Updating Ember…':'Update Ember'}</button>
 </dialog>;
}
