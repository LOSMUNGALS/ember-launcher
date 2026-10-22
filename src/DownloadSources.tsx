import React, {useEffect,useRef,useState,useMemo} from "react";
import type {PackageSource, GamePackage} from "./v2types";
import {downloadOptions} from "./package-matching";
export function SourcePicker({sources,appId,title,platform,onClose,onChoose,onManage,onRefresh}: {sources:PackageSource[];appId?:string;title:string;platform:string;onClose:()=>void;onChoose:(s:PackageSource,p:GamePackage)=>Promise<void>;onManage:()=>void;onRefresh:()=>Promise<void>}) {
 const dialog=useRef<HTMLDialogElement>(null);
 const [search,setSearch]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{dialog.current?.showModal()},[]);
 const options=useMemo(()=>downloadOptions(sources,appId,title,platform),[sources,appId,title,platform]);
 const rows=options.filter(({p})=>p.title.toLowerCase().includes(search.toLowerCase()));
 const act=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');try{await fn()}catch(e){setError(String(e))}finally{setBusy(false)}};
 return <dialog ref={dialog} className="download-picker" onCancel={onClose} aria-label="Choose Download Source">
  <div className="section-heading"><div><span className="eyebrow">DOWNLOAD</span><h2>{title}</h2></div><button aria-label="Close download sources" onClick={onClose}>✕</button></div>
  <input autoFocus placeholder="Search releases…" aria-label="Search download releases" value={search} onChange={e=>setSearch(e.target.value)} />
  <div className="actions"><span>{rows.length} options</span><button disabled={busy} onClick={()=>void act(onRefresh)}>Sync sources</button><button onClick={onManage}>Manage sources</button></div>
  {error&&<p role="alert">{error}</p>}
  <div className="download-options">{rows.slice(0,200).map(({s,p})=><button className="download-option" disabled={busy} key={s.id+p.id} onClick={()=>void act(()=>onChoose(s,p))}>
    <strong>{p.title}</strong><span>{s.name} · {p.sizeLabel || (p.bytes ? (p.bytes/1024**3).toFixed(1)+' GB' : 'Size unknown')}{p.uploadDate&&Number.isFinite(Date.parse(p.uploadDate))?' · '+new Date(p.uploadDate).toLocaleDateString():''}</span>
    <small>{p.transport==='torrent'?'Magnet · download in Ember':p.transport==='host'?'File host · '+new URL(p.url).hostname+' · browser step required':'Direct download · SHA-256 verified'}</small>
  </button>)}</div>
  {!rows.length&&<p className="empty">No matching downloads from enabled sources on this platform. Sync sources or add another JSON feed in Settings.</p>}

 </dialog>;
}
export function SourceSettings({sources,call}: {sources:PackageSource[];call:(action:any,p?:any)=>Promise<any>}) {
 const [url,setUrl]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const run=async(action:string,p?:any)=>{setBusy(true);setError('');try{await call(action,p)}catch(e){setError(String(e))}finally{setBusy(false)}};
 return <section className="settings-panel"><h2>Download sources</h2><p>Search enabled JSON feeds for releases. Import full JSON catalogs to use them even when their websites block automatic refresh.</p>
 <div className="actions"><button disabled={busy} onClick={()=>void run('importSourceFile')}>Import JSON files</button><button disabled={busy} onClick={()=>void run('syncSources')}>{busy?'Synchronizing…':'Sync all sources'}</button></div>
 <form className="inline-form" onSubmit={e=>{e.preventDefault();void run('addSource',{url}).then(()=>setUrl(''))}}><input aria-label="New source URL" type="url" required placeholder="https://example.com/source.json" value={url} onChange={e=>setUrl(e.target.value)} /><button disabled={busy}>Add source</button></form>
 {error&&<p role="alert">{error}</p>}{sources.map(s=><article className="source-package" key={s.id}><h3>{s.name} <span className="pill">{s.enabled?'Enabled':'Disabled'}</span></h3><p>{s.snapshotOrigin || (s.localSnapshot ? 'Local catalog' : s.updated ? 'Online catalog' : 'Not loaded')} · {s.packages.length.toLocaleString()} download options · {s.updated?new Date(s.updated).toLocaleString():'Not refreshed'}</p>
 <form className="inline-form" key={s.url} onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);void run('source',{id:s.id,action:'update',url:String(data.get('url'))})}}><input name="url" aria-label={`${s.name} source URL`} type="url" required defaultValue={s.url}/><button disabled={busy}>Update URL</button></form>
 {s.resolvedUrl&&s.resolvedUrl!==s.url&&<small>Loaded mirror: {s.resolvedUrl}</small>}{s.error&&<details><summary>Refresh unavailable · using loaded catalog</summary><p className="muted">{s.error}</p></details>}
 <div className="actions">{['toggle','refresh','remove'].map(action=><button key={action} disabled={busy} onClick={()=>void run('source',{id:s.id,action})}>{action==='toggle'?(s.enabled?'Disable':'Enable'):action==='refresh'?'Refresh':'Remove'}</button>)}</div></article>)}
 </section>;
}



