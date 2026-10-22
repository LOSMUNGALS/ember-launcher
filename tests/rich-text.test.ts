import test from 'node:test';
import assert from 'node:assert/strict';
import {richText} from '../server/public/formatting.mjs';
test('shared release formatting supports headings, emphasis and lists without producing HTML nodes',()=>{
 const blocks=richText('# Heading\n## Subheading\n**Bold** and *italic* and __underline__ and ~~strike~~ and `code`\n- One\n- Two\n1. First\n2. Second\n> Quote\n<script>alert(1)</script>');
 assert.equal(blocks[0].type,'heading');assert.equal(blocks[1].type,'heading');
 const json=JSON.stringify(blocks);for(const type of ['strong','em','u','s','code','list','quote'])assert.ok(json.includes('"type":"'+type+'"'));
 assert.ok(blocks.some(b=>b.type==='list'&&b.ordered&&b.items.length===2));
 assert.deepEqual(blocks.at(-1),{type:'paragraph',children:[{type:'text',text:'<script>alert(1)</script>'}]});
 assert.equal(richText('**outer *italic* text**')[0].type,'paragraph');
});
