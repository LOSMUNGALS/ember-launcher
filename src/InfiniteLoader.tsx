import React,{useEffect,useRef,useState} from 'react';
export function InfiniteLoader({hasMore,loading,onLoad}:{hasMore:boolean;loading:boolean;onLoad:()=>Promise<unknown>}){
 const node=useRef<HTMLDivElement>(null),busy=useRef(false);
 const [failure,setFailure]=useState(false);
 const [cycle,setCycle]=useState(0);
 useEffect(()=>{
  if(!hasMore||loading||failure)return;
  const observer=new IntersectionObserver(entries=>{if(!entries.some(e=>e.isIntersecting)||busy.current)return;busy.current=true;void onLoad().catch(()=>setFailure(true)).finally(()=>{busy.current=false;setCycle(n=>n+1);});},{rootMargin:'250px'});
  if(node.current)observer.observe(node.current);return()=>observer.disconnect();
 },[hasMore,loading,onLoad,failure,cycle]);
 return hasMore||loading?<div ref={node} className="infinite-loader" role="status" aria-label="Loading more games">{failure?<button onClick={()=>setFailure(false)}>Retry loading</button>:<><i/><i/><i/></>}</div>:null;
}
