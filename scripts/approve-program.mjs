#!/usr/bin/env node
/**
 * Move a reviewed draft into the registry the app actually loads.
 *
 * This is the step where a person takes responsibility. A draft in research/
 * hurts nobody; the moment an entry lands in public/data/programs.json a
 * connector will read it out loud to someone, so this script refuses to run
 * unless a human says, in the command itself, that they read it.
 *
 * Before it writes anything it re-fetches the source page and re-checks every
 * quote. The research script already did that, but a draft is a file on disk
 * that anyone can edit, and the page itself can change between drafting and
 * approving. Verification that only happens once is verification you cannot
 * rely on later.
 *
 * Usage:
 *   node scripts/approve-program.mjs research/JSCC-DATA.json --i-reviewed-this \
 *     [--funding WIOA-CAREERCENTER,ACCS-PATHWAYS] [--academy "IT Academy"]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { verifyQuotes } from './lib/verify-quotes.mjs';
import { readingGrade } from '../src/lib/hallway.ts';

const REGISTRY = 'public/data/programs.json';

const [, , draftPath, ...flags] = process.argv;
const flagValue = (name) => {
  const at = flags.indexOf(name);
  return at >= 0 ? flags[at + 1] : null;
};

if (!draftPath) {
  console.error('Usage: node scripts/approve-program.mjs <draft.json> --i-reviewed-this');
  process.exit(2);
}

const draft = JSON.parse(readFileSync(draftPath, 'utf8'));

const stop = (message) => {
  console.error(`\nREFUSED: ${message}`);
  process.exit(1);
};

if (draft.review_status !== 'quotes_verified_pending_human_review') {
  stop(`this draft is marked "${draft.review_status}". Only a quote-verified draft can be approved.`);
}
if ((draft.unverified_quotes ?? []).length > 0) {
  stop(`this draft carries ${draft.unverified_quotes.length} unverifiable quote(s).`);
}

const blocking = (draft.data_quality_flags ?? []).filter((f) => f.severity === 'do_not_rely');
if (blocking.length > 0) {
  console.log('\nThis draft carries a do_not_rely flag:\n');
  for (const flag of blocking) console.log(`  [${flag.field}] ${flag.note}\n`);
  console.log('That is not a reason to discard it. The registry shows unreliable programs on');
  console.log('purpose, so a connector knows which ones not to vouch for. It IS a reason to');
  console.log('read the flag before approving.\n');
}

if (!flags.includes('--i-reviewed-this')) {
  console.log(`\n${draft.id}: ${draft.program_name}`);
  console.log(`  ${draft.program_url}`);
  console.log(`  cost: ${draft.cost_usd ?? 'not published'} | cohorts: ${(draft.cohorts ?? []).length} | flags: ${(draft.data_quality_flags ?? []).length}`);
  console.log(`  plain words: ${draft.plain ? 'drafted' : 'none, this program will refuse to produce a script'}`);
  stop('nobody has said they reviewed this. Read the draft, then re-run with --i-reviewed-this.');
}

// Re-verify against the page as it is right now, not as it was when drafted.
console.log(`Re-fetching ${draft.program_url} to re-check every quote.`);
const response = await fetch(draft.program_url, {
  headers: { 'user-agent': 'seven-day-pathway/approve (Birmingham Impact Lab)' },
});
if (!response.ok) stop(`could not re-fetch the source page (${response.status}).`);

const pageText = (await response.text())
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&#39;/g, "'")
  .replace(/&quot;/g, '"');

const { checked, failures } = verifyQuotes(draft, pageText);
console.log(`Re-checked ${checked.length} quote(s).`);
if (failures.length > 0) {
  for (const { label, quote } of failures) console.error(`  GONE: ${label}: "${quote.slice(0, 80)}"`);
  stop('the page no longer contains these quotes. Re-run the research script.');
}

// The app fails its own build if a script reads above a ninth grade level. An
// entry that would push it over gets stopped here, at the point a human is
// still holding it, rather than at the point a connector reads it out loud.
const tooHard = (draft.plain?.translations ?? [])
  .map((t) => ({ ...t, grade: readingGrade(t.you_say) }))
  .filter((t) => t.grade > 9);
if (tooHard.length > 0) {
  console.error('\nThese plain-language lines read above a ninth grade level:\n');
  for (const t of tooHard) console.error(`  grade ${t.grade.toFixed(1)}: "${t.you_say}"\n`);
  stop('rewrite them in the draft, in shorter words and shorter sentences, then re-run.');
}

const registry = JSON.parse(readFileSync(REGISTRY, 'utf8'));
if (registry.programs.some((p) => p.id === draft.id)) {
  stop(`${draft.id} is already in the registry. Remove it first if you mean to replace it.`);
}

// Namespace the ids so a flag can be cited unambiguously in a review later.
const pad = (n) => String(n + 1).padStart(2, '0');
const funding = (flagValue('--funding') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const known = new Set(registry.funding_paths.map((f) => f.id));
for (const id of funding) {
  if (!known.has(id)) stop(`funding path "${id}" is not in the registry.`);
}

const entry = {
  id: draft.id,
  provider: draft.provider,
  provider_short: draft.provider_short,
  program_name: draft.program_name,
  academy: flagValue('--academy') ?? draft.academy ?? null,
  program_url: draft.program_url,
  schedule_url: draft.schedule_url ?? null,
  leads_to: draft.leads_to,
  credential: draft.credential,
  ...(draft.credential_source_quote ? { credential_source_quote: draft.credential_source_quote } : {}),
  cost_usd: draft.cost_usd ?? null,
  ...(draft.cost_source_quote ? { cost_source_quote: draft.cost_source_quote } : {}),
  cost_notes: draft.cost_notes ?? [],
  format: draft.format,
  ...(draft.format_source_quote ? { format_source_quote: draft.format_source_quote } : {}),
  cohorts: draft.cohorts ?? [],
  requirements: (draft.requirements ?? []).map((r, i) => ({
    ...r,
    id: `${draft.id}-REQ-${pad(i)}`,
    source_url: r.source_url ?? draft.program_url,
  })),
  funding_paths: funding,
  contacts: (draft.contacts ?? []).map((c) =>
    Object.fromEntries(Object.entries(c).filter(([, v]) => v !== '' && v != null)),
  ),
  ...(draft.plain
    ? {
        plain: {
          ...draft.plain,
          translations: draft.plain.translations.map((t) => ({ ...t, source_url: draft.program_url })),
        },
      }
    : {}),
  data_quality_flags: (draft.data_quality_flags ?? []).map((f, i) => ({
    ...f,
    id: `${draft.id}-DQ-${pad(i)}`,
  })),
  fetched_at: new Date().toISOString(),
};

registry.programs.push(entry);
writeFileSync(REGISTRY, `${JSON.stringify(registry, null, 2)}\n`);

console.log(`\nApproved. ${entry.id} added to ${REGISTRY}.`);
if (funding.length === 0) {
  console.log('\nNote: no funding paths were attached, so the app will not offer anyone a way to');
  console.log('pay for this. Re-run with --funding if that is wrong. It usually is.');
}
console.log('\nNow run: npm test');
