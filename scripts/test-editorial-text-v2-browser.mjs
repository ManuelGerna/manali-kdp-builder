// Run against review-editorial-text-v2.mjs only. No DB, credentials or real book.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.EDITORIAL_PLAYWRIGHT_PACKAGE ?? 'playwright');
const baseUrl = 'http://127.0.0.1:3217';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1100, height: 900 } });
await context.route('**/*', route => new URL(route.request().url()).origin === baseUrl ? route.continue() : route.abort());
const page = await context.newPage(); const errors = []; const checks = [];
page.setDefaultTimeout(15000);
page.on('pageerror', error => errors.push(error.message));
const check = (name, fn) => Promise.resolve().then(fn).then(() => { checks.push(name); console.log(`PASS ${name}`); });
try {
  await page.goto(baseUrl);
  const surface = page.locator('.editorial-text-v2-editor');
  const runs = surface.locator('.tiptap');
  await runs.first().waitFor();
  const first = runs.nth(0), second = runs.nth(1), save = surface.getByRole('button', { name: 'Salva', exact: true });
  const group = async () => JSON.parse(await surface.locator('input[name="group"]').inputValue());
  const start = await group();
  await check('one save, continuous paragraphs, immutable image and exact initial CRLF', async () => {
    assert.equal(await runs.count(), 2); assert.equal(await save.count(), 1); assert.ok(await save.isDisabled());
    assert.equal(start.nodes[0].doc.content.length, 2); assert.equal(start.nodes[0].doc.content[0].content[1].attrs.ending, '\r\n');
    assert.equal(await surface.locator('textarea').count(), 0); assert.equal(await surface.locator('img').count(), 1);
    assert.equal(await surface.locator('img').evaluate(img => img.closest('[contenteditable="true"]')), null);
  });
  await first.locator('p').last().click(); await first.press('End'); await first.press('Enter'); await page.keyboard.insertText('Nuovo paragrafo');
  await check('Enter creates one paragraph with CSS spacing', async () => {
    assert.equal((await group()).nodes[0].doc.content.length, 3);
    assert.equal(await first.locator('p').count(), 3);
    assert.ok(await first.locator('p').nth(1).evaluate(p => parseFloat(getComputedStyle(p).marginTop)) > 0);
  });
  await first.press('Shift+Enter'); await page.keyboard.insertText('A capo semplice');
  await check('Shift+Enter adds a literal break without a paragraph or extra spaces', async () => {
    const doc = (await group()).nodes[0].doc; assert.equal(doc.content.length, 3);
    assert.deepEqual(doc.content[2].content.map(n => n.type === 'text' ? n.text : n.attrs.ending), ['Nuovo paragrafo', '\n', 'A capo semplice']);
  });
  const beforeUndo = await group();
  await surface.getByRole('button', { name: 'Annulla', exact: true }).click();
  const undone = await group();
  await surface.getByRole('button', { name: 'Ripristina', exact: true }).click();
  await check('undo and redo preserve exact document text and breaks', async () => {
    assert.notDeepEqual(undone.nodes[0].doc, beforeUndo.nodes[0].doc); assert.deepEqual(await group(), beforeUndo);
  });
  await first.locator('p').last().click(); await first.press('End'); await first.press('Control+b');
  await first.press('Shift+Enter'); await page.keyboard.insertText('Titolo interno'); await first.press('Control+b');
  await check('line breaks after bold labels stay schema-valid', async () => {
    assert.ok((await group()).nodes[0].doc.content.at(-1).content.some(n => n.type === 'text' && n.text.includes('Titolo interno')));
    assert.deepEqual(errors, []);
  });
  await first.evaluate(root => {
    const paragraphs = root.querySelectorAll('p'); const range = document.createRange();
    range.setStart(paragraphs[0].firstChild, 0); range.setEnd(paragraphs[1].lastChild, paragraphs[1].lastChild.textContent.length);
    const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); root.focus();
  });
  await page.keyboard.insertText('Riscritto');
  await check('selection and rewriting cross old V1 paragraph boundaries', async () => {
    const current = await group(); assert.equal(current.nodes[0].doc.content.length, 2);
    assert.equal(current.nodes[0].doc.content[0].content[0].text, 'Riscritto'); assert.deepEqual(current.source, start.source);
  });
  const beforeResize = await group();
  await page.setViewportSize({ width: 390, height: 850 });
  await check('automatic line wrapping never inserts data or spacing', async () => assert.deepEqual(await group(), beforeResize));
  await second.click(); await second.press('Control+Home'); await second.press('Backspace');
  await check('backspace at an image boundary cannot move or delete the image', async () => {
    assert.equal(await surface.locator('img').count(), 1); assert.deepEqual((await group()).nodes.filter(n => n.kind === 'block'), start.nodes.filter(n => n.kind === 'block'));
    assert.equal(await second.textContent(), 'Dopo immagine');
  });
  const unsaved = await group(); await page.reload(); await runs.first().waitFor();
  await page.waitForFunction(expected => document.querySelector('input[name="group"]')?.value === expected, JSON.stringify(unsaved));
  await check('unsaved draft survives a real browser reload', async () => { assert.deepEqual(await group(), unsaved); assert.ok(await save.isEnabled()); });
  await page.getByRole('button', { name: 'Simula conflitto', exact: true }).click(); await save.click();
  await page.getByRole('alert').filter({ hasText: 'Conflitto simulato' }).waitFor();
  await check('a rejected save keeps the complete draft available', async () => assert.deepEqual(await group(), unsaved));
  await page.getByRole('button', { name: 'Disattiva conflitto', exact: true }).click(); await save.click();
  await page.getByRole('status').filter({ hasText: 'Testo salvato.' }).waitFor();
  await page.waitForFunction(() => document.querySelector('input[name="revision"]')?.value === '1');
  await check('one save acknowledges all segments and clears dirty state', async () => { assert.ok(await save.isDisabled()); assert.deepEqual(await group(), unsaved); });
  const empty = page.locator('[aria-label="Gruppo vuoto"] .tiptap');
  await empty.click(); await page.keyboard.insertText('Prima scrittura'); await empty.press('Enter'); await page.keyboard.insertText('Secondo paragrafo');
  await check('a truly empty introduction accepts first typing and new paragraphs', async () => {
    assert.equal(await empty.locator('p').count(), 2); assert.equal(await empty.locator('p').nth(0).textContent(), 'Prima scrittura');
  });
  assert.deepEqual(errors, []);
  const dir = path.join(process.cwd(), 'node_modules/.cache/editorial-text-v2'); fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, 'browser-review.png'), fullPage: true });
  fs.writeFileSync(path.join(dir, 'browser-report.json'), JSON.stringify({ checks, errors, passed: checks.length }, null, 2) + '\n');
} finally { await context.close(); await browser.close(); }
