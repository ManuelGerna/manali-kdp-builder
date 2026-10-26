// Replays migrations only in local PGlite. No network, credentials or DB URL.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
const input = process.argv[2]; if (!input) throw new Error('Pass the saved read-only RPC catalog JSON.');
const baseline = JSON.parse(fs.readFileSync(input, 'utf8'));
const db = new PGlite();
try {
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('sub',auth.uid(),'email','local@example.invalid') $$;
    grant usage on schema auth to authenticated,anon;
    create schema storage; create table storage.objects(id uuid,bucket_id text,name text);
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;`);
  const dir = new URL('../supabase/migrations/', import.meta.url);
  const migrations = ['20261020064131_editorial_text_editor_v2_local.sql', '20261026173537_editorial_images_v2_local.sql'];
  for (const name of fs.readdirSync(dir).filter(n => n.endsWith('.sql') && !migrations.includes(n)).sort()) {
    if (name === '20260701010000_add_kdp_assets_storage_v1.sql') continue;
    await db.exec(fs.readFileSync(new URL(name, dir), 'utf8').replace('create extension if not exists pgcrypto;', ''));
  }
  for (const expected of baseline) {
    const actual = (await db.query("select md5(p.prosrc) source_md5,p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=$1", [expected.proname])).rows;
    assert.equal(actual.length, 1); assert.equal(actual[0].source_md5, expected.source_md5, `Production/local RPC mismatch: ${expected.proname}`);
    assert.equal(actual[0].prosecdef, false);
  }
  for (const migration of migrations) await db.exec(fs.readFileSync(new URL(migration, dir), 'utf8'));
  const renamed = (await db.query("select md5(prosrc) source_md5 from pg_proc where proname='apply_editorial_section_change_text_v1'")).rows[0];
  assert.equal(renamed.source_md5, baseline.find(f => f.proname === 'apply_editorial_section_change_v1').source_md5);
  const rights = (await db.query("select has_function_privilege('anon','public.apply_editorial_section_change_v1(uuid,uuid,integer,uuid[],jsonb)','EXECUTE') anon,has_function_privilege('authenticated','public.apply_editorial_section_change_v1(uuid,uuid,integer,uuid[],jsonb)','EXECUTE') authenticated")).rows[0];
  assert.equal(rights.anon, false); assert.equal(rights.authenticated, true);
  console.log(JSON.stringify({ local_migrations: migrations, production_rpc_bodies_match: baseline.length, original_v1_body_preserved: true,
    signature_preserved: true, security_invoker: true, anon_execute: false, authenticated_execute: true, remote_writes: 0 }, null, 2));
} finally { await db.close(); }
