// Input is a read-only snapshot. This program has no credentials or DB client.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { getSchema } from '@tiptap/core';
import { editorialTextV2Extensions } from '../src/lib/kdp/editorial-text-v2-schema.ts';
import { convertEditorialSectionV2, readEditorialSectionText, restoreEditorialGroupV1, sameEditorialJson, paragraphLiteralText, editorialSectionTextProjection } from '../src/lib/kdp/editorial-text-v2.ts';
import { orderEditorialBlocks } from '../src/lib/kdp/editorial-hierarchy.ts';

export function auditEditorialTextV2(snapshot) {
  const schema = getSchema(editorialTextV2Extensions());
  const before = JSON.stringify(snapshot);
  const covered = [], sectionReports = [];
  let fields = 0, characters = 0, subsections = 0, targetBlocks = 0;
  for (const section of snapshot.sections) {
    const rows = orderEditorialBlocks(snapshot.blocks.filter(b => b.section_id === section.id));
    const store = convertEditorialSectionV2(section, rows);
    const converted = { ...section, settings: { ...section.settings, editorial_text_v2: store } };
    const read = readEditorialSectionText(converted, rows);
    const reconstructed = [];
    for (const [index, item] of [read.opening, ...read.subsections.map(s => s.text)].entries()) {
      const source = restoreEditorialGroupV1(item.group);
      if (index) { const marker = read.subsections[index - 1].marker; covered.push(marker.id); reconstructed.push(marker); }
      covered.push(...source.blocks.map(b => b.id)); reconstructed.push(...source.blocks);
      for (const node of item.group.nodes) if (node.kind === 'text') {
        const actual = schema.nodeFromJSON(node.doc); actual.check();
        const json = actual.toJSON(); json.content ??= [];
        assert.ok(sameEditorialJson(json, node.doc), 'Tiptap JSON roundtrip');
        for (const p of node.doc.content) {
          const raw = p.attrs.sourceId === source.section_body?.id ? source.section_body.value : p.attrs.sourceId === source.marker_body?.id ? source.marker_body.value
            : source.blocks.find(b => b.id === p.attrs.sourceId)[p.attrs.field];
          assert.equal(paragraphLiteralText(p), raw, 'Exact field/terminator comparison');
          fields++; characters += raw.length;
        }
      }
    }
    assert.deepEqual(reconstructed, rows, 'All rows, metadata, UUIDs and order reconstruct exactly');
    const projection = editorialSectionTextProjection(converted, rows);
    const projected = projection.blocks.filter(b => b.editorial_text_v2).map(b => b.body);
    const expected = [read.opening, ...read.subsections.map(s => s.text)].flatMap(item => item.group.nodes.flatMap(n => n.kind === 'text' ? n.doc.content.filter(p => p.attrs.visibility === 'print').map(paragraphLiteralText) : []));
    assert.deepEqual(projected, expected, 'Export projection contains exactly the converted paragraphs');
    const target = read.subsections.find(s => s.marker.title?.trim() === 'COME AMI DAVVERO');
    if (target) targetBlocks = target.blocks.length;
    subsections += read.subsections.length;
    sectionReports.push({ id: section.id, subsections: read.subsections.length, blocks: rows.length, identical: true });
  }
  assert.equal(new Set(covered).size, covered.length, 'No duplicated UUID');
  assert.deepEqual([...covered].sort(), snapshot.blocks.map(b => b.id).sort(), 'No missing or extraneous UUID');
  assert.equal(JSON.stringify(snapshot), before, 'Source snapshot was never mutated');
  assert.equal(snapshot.sections.length, 15); assert.equal(subsections, 53); assert.equal(covered.length, 1167); assert.equal(targetBlocks, 34);
  return { readAt: snapshot.read_at, sections: 15, subsections, blocks: covered.length, comeAmiDavveroBlocks: targetBlocks,
    comparedFields: fields, comparedUtf16Units: characters, missing: 0, duplicated: 0, mismatches: 0,
    snapshotSha256: createHash('sha256').update(before).digest('hex'), sectionsVerified: sectionReports };
}
if (process.argv[1]?.endsWith('simulate-editorial-text-v2.mjs')) {
  if (!process.argv[2]) throw new Error('Pass a local snapshot JSON; this script cannot read production.');
  const report = auditEditorialTextV2(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')));
  if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
