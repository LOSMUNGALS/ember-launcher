import React from 'react';
import {richText,type Inline} from '../server/public/formatting.mjs';
function inline(nodes:Inline[]):React.ReactNode[]{return nodes.map((node,i)=>node.type==='text'?node.text:React.createElement(node.type,{key:i},inline(node.children)));}
export function RichText({text}:{text:string}){return <div className="update-body">{richText(text).map((block,i)=>block.type==='list'?React.createElement(block.ordered?'ol':'ul',{key:i},block.items.map((item,n)=><li key={n}>{inline(item)}</li>)):React.createElement(block.type==='heading'?`h${Math.min(4,block.level+1)}`:block.type==='quote'?'blockquote':'p',{key:i},inline(block.children)))}</div>;}
