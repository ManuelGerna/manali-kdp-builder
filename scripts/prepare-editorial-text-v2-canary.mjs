// Read-only preparation. Reads a local SELECT snapshot; never connects to a DB.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { EDITORIAL_TEXT_V2_CANARY as target } from '../src/lib/kdp/editorial-text-v2-gate.ts';
import { readEditorialSectionText, restoreEditorialGroupV1, canonicalJson } from '../src/lib/kdp/editorial-text-v2.ts';
import { orderEditorialBlocks } from '../src/lib/kdp/editorial-hierarchy.ts';
import { auditEditorialTextV2 } from './simulate-editorial-text-v2.mjs';

const input = process.argv[2], output = process.argv[3];
if (!input || !output) throw new Error('Pass a local production SELECT snapshot and a private backup directory.');
const snapshot = JSON.parse(fs.readFileSync(input, 'utf8'));
assert.equal(snapshot.project_id, 'sppsgnhnloumfdldosbe'); assert.equal(snapshot.book_id, target.bookId);
assert.equal(snapshot.book.id, target.bookId); assert.equal(snapshot.book.title, 'ARIETE');
assert.equal(snapshot.converted_sections, 0, 'A conversion is already present: stop and review it.');
const wholeBook = auditEditorialTextV2(snapshot);
const section = snapshot.sections.find(s => s.id === target.sectionId); assert.ok(section);
const rows = orderEditorialBlocks(snapshot.blocks.filter(b => b.section_id === section.id));
const read = readEditorialSectionText(section, rows);
const subsection = read.subsections.find(s => s.marker.id === target.subsectionId); assert.ok(subsection);
assert.equal(subsection.marker.title.trim(), 'COME AMI DAVVERO'); assert.equal(subsection.blocks.length, 34);
assert.equal(subsection.text.format, 'v1'); assert.equal(subsection.marker.body, null);
const group = subsection.text.group;
assert.deepEqual(restoreEditorialGroupV1(group).blocks, subsection.blocks);
assert.equal(group.nodes.length, 1); assert.equal(group.nodes[0].kind, 'text'); assert.equal(group.nodes[0].doc.content.length, 34);
const hash = value => createHash('sha256').update(canonicalJson(value)).digest('hex');
const archive = { version: 1, project_id: snapshot.project_id, read_at: snapshot.read_at, target, marker: subsection.marker,
  section, section_order: rows.map(b => b.id), blocks: subsection.blocks,
  source_sha256: hash(subsection.blocks), section_sha256: hash(section), whole_book_sha256: hash(snapshot) };
const plan = { version: 2, status: 'PREPARED_NOT_ACTIVATED', target, expected_revision: section.settings.editorial_builder_v1.revision,
  expected_order: rows.map(b => b.id), original_blocks_sha256: archive.source_sha256, group };
fs.mkdirSync(output, { recursive: true });
// Exclusive creation protects recovery artifacts from accidental replacement.
fs.writeFileSync(path.join(output, 'come-ami-davvero-original-34.json'), JSON.stringify(archive, null, 2) + '\n', { flag: 'wx' });
fs.writeFileSync(path.join(output, 'come-ami-davvero-v2-plan.json'), JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
const report = { status: plan.status, read_at: snapshot.read_at, project_id: snapshot.project_id, target,
  sections: wholeBook.sections, subsections: wholeBook.subsections, blocks: wholeBook.blocks, converted_comparison: '34/34',
  loss: 0, duplicates: 0, mismatches: 0, source_sha256: archive.source_sha256, expected_revision: plan.expected_revision };
fs.writeFileSync(path.join(output, 'preactivation-report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report, null, 2));
