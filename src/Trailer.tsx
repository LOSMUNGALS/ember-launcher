import React, {useEffect, useRef, useState} from 'react';
import Hls from 'hls.js';
export function Trailer({src,poster}:{src:string;poster?:string}) {
 const video=useRef<HTMLVideoElement>(null);
 const [failed,setFailed]=useState(false);
 useEffect(()=>{
  const element=video.current;if(!element)return;setFailed(false);
  if(/\.m3u8(?:\?|$)/.test(src)&&Hls.isSupported()){
   const player=new Hls({enableWorker:false,autoStartLoad:false});
   player.loadSource(src);player.attachMedia(element);
   const play=()=>player.startLoad();element.addEventListener('play',play);
   player.on(Hls.Events.ERROR,(_,data)=>{if(data.fatal)setFailed(true);});
   return()=>{element.removeEventListener('play',play);player.destroy();};
  }
  element.src=src;
  return()=>{element.removeAttribute('src');element.load();};
 },[src]);
 return <><video ref={video} className="game-trailer" controls preload="none" poster={poster} onError={()=>setFailed(true)}/>{failed&&<p>Trailer unavailable right now. You can watch it on the game's store page.</p>}</>;
}
