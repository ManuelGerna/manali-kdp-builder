import assert from 'node:assert/strict';
import test from 'node:test';
import { validateEditorialImage, editorialImageStyle } from '../editorial-images.ts';
import { planEditorialTextMove, planEditorialSubsectionMove } from '../editorial-hierarchy.ts';
test('Image upload accepts PNG/JPG signatures and rejects spoofed, empty and oversized files',async()=>{
 assert.equal((await validateEditorialImage(new File([new Uint8Array([137,80,78,71,13,10,26,10])],'a.png',{type:'image/png'}))).extension,'png');
 assert.equal((await validateEditorialImage(new File([new Uint8Array([255,216,255,0])],'a.jpg',{type:'image/jpeg'}))).extension,'jpg');
 for(const f of [new File(['bad'],'a.png',{type:'image/png'}),new File([],'a.jpg',{type:'image/jpeg'}),new File([new Uint8Array(3*1024*1024+1)],'a.png',{type:'image/png'})]) await assert.rejects(validateEditorialImage(f));
 assert.deepEqual(editorialImageStyle('bad'),{size:'text',align:'center'});
 assert.deepEqual(editorialImageStyle('{"size":"small","align":"right"}'),{size:'small',align:'right'});
});
test('Mixed image/text movement respects subsection boundaries and group moves carry images',()=>{
 const blocks=['h1','t1','img','h2','t2'].map((id,i)=>({id,block_type:id==='img'?'image':'text',body:'text',title:null,created_at:'',sort_order:i}));
 const map={version:1 as const,revision:0,subsections:['h1','h2'].map((id,i)=>({heading_block_id:id,semantic_id:id,kind:'heading' as const,order:i}))};
 assert.deepEqual(planEditorialTextMove(blocks,'img','up',map),['h1','img','t1','h2','t2']);
 assert.deepEqual(planEditorialTextMove(blocks,'img','down',map),blocks.map(b=>b.id));
 assert.deepEqual(planEditorialSubsectionMove(blocks,'h1','down',map),['h2','t2','h1','t1','img']);
});
