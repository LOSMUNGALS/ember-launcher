export interface LauncherUpdateState {
 currentVersion:string;
 supported:boolean;
 phase:'unsupported'|'idle'|'checking'|'available'|'downloading'|'downloaded'|'installing'|'error';
 release?:{version:string;title:string;notes:string};
 percent?:number;
 error?:string;
 reason?:string;
}
