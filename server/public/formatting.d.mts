export type Inline={type:'text';text:string}|{type:'strong'|'u'|'s'|'code'|'em';children:Inline[]};
export type Block={type:'heading';level:number;children:Inline[]}|{type:'paragraph'|'quote';children:Inline[]}|{type:'list';ordered:boolean;items:Inline[][]};
export const formats:{label:string;prefix:string;suffix:string}[];
export function inlineText(text:string,depth?:number):Inline[];
export function richText(text:string):Block[];
