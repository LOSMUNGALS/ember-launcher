import {defaultSources,refreshSource} from '../desktop/sources';
async function main(){
for(const source of defaultSources()) {
 const result=await refreshSource(source);
 console.log(JSON.stringify({name:result.name,entries:result.packages.length,transport:result.packages.reduce((r:Record<string,number>,p)=>{const key=p.transport||'direct';r[key]=(r[key]||0)+1;return r;},{}),resolvedUrl:result.resolvedUrl,error:result.error}));
 if(!result.packages.length) process.exitCode=1;
}

}
void main().catch(e=>{console.error(e);process.exitCode=1});