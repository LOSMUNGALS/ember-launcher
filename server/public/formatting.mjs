// Shared safe text parser. Both UIs render this tree with text nodes, never HTML.
export const formats=[
 {label:'Bold',prefix:'**',suffix:'**'}, {label:'Italic',prefix:'*',suffix:'*'},
 {label:'Underline',prefix:'__',suffix:'__'}, {label:'Strike',prefix:'~~',suffix:'~~'},
 {label:'Code',prefix:'`',suffix:'`'}, {label:'Heading',prefix:'\n# ',suffix:''},
 {label:'Subheading',prefix:'\n## ',suffix:''}, {label:'Quote',prefix:'\n> ',suffix:''},
 {label:'List',prefix:'\n- ',suffix:''}, {label:'Numbered list',prefix:'\n1. ',suffix:''},
];
export function inlineText(text,depth=0){
 if(depth>8)return [{type:'text',text}];
 const nodes=[],re=/(\*\*([^\n]+?)\*\*|__([^\n]+?)__|~~([^\n]+?)~~|`([^`\n]+)`|\*([^*\n]+?)\*)/g;
 let cursor=0;for(const match of text.matchAll(re)){
  if(match.index>cursor)nodes.push({type:'text',text:text.slice(cursor,match.index)});
  const pair=match[2]!==undefined?['strong',match[2]]:match[3]!==undefined?['u',match[3]]:match[4]!==undefined?['s',match[4]]:match[5]!==undefined?['code',match[5]]:['em',match[6]];
  nodes.push({type:pair[0],children:pair[0]==='code'?[{type:'text',text:pair[1]}]:inlineText(pair[1],depth+1)});cursor=match.index+match[0].length;
 }
 if(cursor<text.length)nodes.push({type:'text',text:text.slice(cursor)});return nodes;
}
export function richText(text){
 const lines=String(text||'').slice(0,20000).split('\n'),blocks=[];
 for(let i=0;i<lines.length;i++){
  const line=lines[i],heading=line.match(/^(#{1,3})\s+(.*)$/),list=line.match(/^(-|\d+\.)\s+(.*)$/);
  if(heading)blocks.push({type:'heading',level:heading[1].length,children:inlineText(heading[2])});
  else if(line.startsWith('> '))blocks.push({type:'quote',children:inlineText(line.slice(2))});
  else if(list){const ordered=list[1]!=='-',items=[inlineText(list[2])];while(i+1<lines.length){const next=lines[i+1].match(/^(-|\d+\.)\s+(.*)$/);if(!next||(next[1]!=='-')!==ordered)break;items.push(inlineText(next[2]));i++;}blocks.push({type:'list',ordered,items});}
  else blocks.push({type:'paragraph',children:inlineText(line||'\u00a0')});
 }
 return blocks;
}
