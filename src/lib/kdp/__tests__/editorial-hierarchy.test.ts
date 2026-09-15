import assert from "node:assert/strict";
import test from "node:test";
import { bootstrapEditorialMaps, buildEditorialBlockHierarchy, getEditorialSectionTitle, readEditorialMap, planEditorialSubsectionMove, planEditorialTextPlacement, isEditorialSubsectionMarker } from "../editorial-hierarchy.ts";
import { readCompleteCollection } from "../complete-collection.ts";
import { resolveBookContentMode } from "../editorial-book-mode.ts";
import { ariesFixture, attachMaps } from "../__fixtures__/editorial-fixture.ts";

test("Ariete: canonical bootstrap produces 15 parts, 8 chapters, 6 main parts, 1 introduction and 53 subsections", () => {
  const f=ariesFixture(); const maps=bootstrapEditorialMaps(f.sections,f.blocks,f.project);
  assert.equal(f.sections.length,15); assert.equal(f.blocks.length,1167);
  assert.equal(f.sections.filter(s=>s.section_type==="chapter").length,8);
  assert.equal(f.sections.filter(s=>s.section_type==="chapter_text").length,6);
  assert.equal(f.sections.filter(s=>s.section_type==="introduction").length,1);
  assert.equal([...maps.values()].reduce((n,m)=>n+m.subsections.length,0),53);
  for(const [title,count] of [["MANIFESTAZIONE",8],["PIETRE NATURALI",3],["I CODICI ENERGETICI DELL’ARIETE",2]] as const) {
    const s=f.sections.find(s=>s.title===title)!; assert.equal(maps.get(s.id)!.subsections.length,count);
  }
});

test("Minor labels stay inside their canonical group, never opening a subsection", () => {
  const f=ariesFixture(); const maps=bootstrapEditorialMaps(f.sections,f.blocks,f.project);
  for(const title of ["Rito","Frasi di manifestazione","Potere sul corpo","Energia da ricordare"]) {
    const labels=f.blocks.filter(b=>b.title?.trim()===title); assert.ok(labels.length>0);
    for(const b of labels) { const map=maps.get(b.section_id)!; assert.equal(isEditorialSubsectionMarker(b,map),false);
      const h=buildEditorialBlockHierarchy(f.blocks.filter(x=>x.section_id===b.section_id),map);
      assert.ok(h.subsections.some(s=>s.blocks.some(x=>x.id===b.id)));
    }
  }
});

test("Bootstrap mismatch fails without mutating any settings", () => {
  const f=ariesFixture(); const original=structuredClone(f.sections); f.blocks.at(-1)!.body="modified";
  assert.throws(()=>bootstrapEditorialMaps(f.sections,f.blocks,f.project),/Confronto/); assert.deepEqual(f.sections,original);
});

test("Existing valid maps are idempotent and survive title changes", () => {
  const f=ariesFixture(); const maps=bootstrapEditorialMaps(f.sections,f.blocks,f.project);
  const sections=attachMaps(f.sections,maps); const m=maps.get(sections[1].id)!;
  f.blocks.find(b=>b.id===m.subsections[0].heading_block_id)!.title="Titolo rinominato";
  assert.deepEqual(bootstrapEditorialMaps(sections,f.blocks,f.project),maps);
  assert.equal(buildEditorialBlockHierarchy(f.blocks.filter(b=>b.section_id===sections[1].id),m).subsections[0].marker.title,"Titolo rinominato");
});

test("Complete-order plans move groups and text without elementary move loops", () => {
  const f=ariesFixture();const maps=bootstrapEditorialMaps(f.sections,f.blocks,f.project);const s=f.sections[1];
  const rows=f.blocks.filter(b=>b.section_id===s.id);const m=maps.get(s.id)!;const h=buildEditorialBlockHierarchy(rows,m);
  const order=planEditorialSubsectionMove(rows,h.subsections[1].marker.id,"up",m);
  assert.equal(order.length,rows.length);assert.equal(new Set(order).size,rows.length);
  assert.deepEqual(order.slice(h.openingBlocks.length,h.openingBlocks.length+h.subsections[1].blocks.length+1),[h.subsections[1].marker,...h.subsections[1].blocks].map(b=>b.id));
  const moved=planEditorialTextPlacement(rows,h.subsections[0].blocks[0].id,h.subsections[1].marker.id,m);
  assert.equal(moved.length,rows.length);assert.equal(new Set(moved).size,rows.length);
});

test("Invalid/stale maps fail closed; title-only text is not a manual heading", () => {
 const f=ariesFixture();const maps=bootstrapEditorialMaps(f.sections,f.blocks,f.project);const s=attachMaps(f.sections,maps)[1];
 assert.throws(()=>readEditorialMap(s.settings,[]),/mappa/);
 assert.equal(isEditorialSubsectionMarker(f.blocks.find(b=>b.title==="Rito")!),false);
});

test("Introduction label is UI-only and never rewrites source title", () => {
 const s={title:null,section_type:"introduction"};assert.equal(getEditorialSectionTitle(s,null),"Introduzione");assert.equal(s.title,null);
});

test("Semantic heading UUIDs belong to their section; a foreign heading fails validation", () => {
 const f = ariesFixture();
 const maps = bootstrapEditorialMaps(f.sections, f.blocks, f.project);
 const sections = attachMaps(f.sections, maps);
 for (const section of sections) {
  const rows = f.blocks.filter(b => b.section_id === section.id);
  const map = readEditorialMap(section.settings, rows);
  const hierarchy = buildEditorialBlockHierarchy(rows, map);
  const all = [...hierarchy.openingBlocks, ...hierarchy.subsections.flatMap(s => [s.marker, ...s.blocks])];
  assert.deepEqual(all.map(b => b.id), rows.map(b => b.id));
  assert.equal(new Set(all.map(b => b.id)).size, rows.length);
  for (const marker of map.subsections) {
   assert.equal(f.blocks.find(b => b.id === marker.heading_block_id)?.section_id, section.id);
  }
 }
 const wrongMap = structuredClone(maps.get(sections[10].id)!);
 wrongMap.subsections[0].heading_block_id = maps.get(sections[9].id)!.subsections[0].heading_block_id;
 assert.throws(() => readEditorialMap({ editorial_builder_v1: wrongMap },
  f.blocks.filter(b => b.section_id === sections[10].id)), /mappa/);
});

test("Complete collection loads 1167 records even with an API cap smaller than requested", async () => {
 const rows=ariesFixture().blocks;const requests:number[]=[];
 const result=await readCompleteCollection(async (from,to)=>{requests.push(from);return {data:rows.slice(from,Math.min(to+1,from+200)),count:rows.length,error:null};});
 assert.deepEqual(result,rows);assert.deepEqual(requests,[0,200,400,600,800,1000]);
});

test("Incomplete pagination or changing dataset is an error, not a partial book", async () => {
 await assert.rejects(readCompleteCollection(async()=>({data:[],count:1167,error:null})),/incompleto/);
 let call=0;await assert.rejects(readCompleteCollection(async()=>({data:[{id:"same"}],count:++call===1?2:3,error:null})),/cambiato/);
});

test("Structured and legacy books never select Editorial Builder", () => {
 assert.equal(resolveBookContentMode(["editorial_draft_v1"],0),"editorial");
 assert.equal(resolveBookContentMode(["generic_draft_v0"],110),"pages");
 assert.equal(resolveBookContentMode(["editorial_draft_v1"],110),"pages");
 assert.equal(resolveBookContentMode(["legacy_structured_draft"],0),"legacy");
 assert.equal(resolveBookContentMode([],0),"legacy");
});
