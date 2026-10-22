import {useEffect,useState} from 'react';
import {bannerColor} from './artwork-color';
const colors=new Map<string,string>();
export function useArtworkTheme(sources:(string|undefined)[],fallback='#273b40') {
 const key=JSON.stringify(sources.filter(Boolean));
 const [result,setResult]=useState<{key:string;color:string}>();
 useEffect(()=>{
  let canceled=false;
  const images:HTMLImageElement[]=[];
  async function sample(){
   for(const src of JSON.parse(key) as string[]){
    const cached=colors.get(src);if(cached){if(!canceled)setResult({key,color:cached});return;}
    try{
     const img=new Image();images.push(img);img.crossOrigin='anonymous';
     const imageUrl=/^\.\/(bloodborne\.png|god-of-war-iii\.png|13-sentinels\.jpg)$/.test(src)?'ember-art://bundled/'+src.slice(2):src;
     await new Promise<void>((resolve,reject)=>{
      const timer=setTimeout(()=>{img.removeAttribute('src');reject(Error('Artwork timed out'));},8000);
      img.onload=()=>{clearTimeout(timer);resolve();};img.onerror=()=>{clearTimeout(timer);reject(Error('Artwork unavailable'));};img.src=imageUrl;
     });
     if(canceled)return;
     const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;
     const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)continue;
     context.drawImage(img,0,0,32,32);const rgba=context.getImageData(0,0,32,32).data;
     const bgra=new Uint8Array(rgba.length);
     for(let i=0;i<rgba.length;i+=4){bgra[i]=rgba[i+2];bgra[i+1]=rgba[i+1];bgra[i+2]=rgba[i];bgra[i+3]=rgba[i+3];}
     const color=bannerColor(bgra);if(colors.size>=512)colors.delete(colors.keys().next().value!);colors.set(src,color);
     if(!canceled)setResult({key,color});return;
    }catch{/* Try the next artwork source; unreadable images keep the neutral theme. */}
   }
  }
  void sample();return()=>{canceled=true;for(const img of images){img.onload=null;img.onerror=null;img.removeAttribute('src');}};
 },[key]);
 return result?.key===key?result.color:fallback;
}
