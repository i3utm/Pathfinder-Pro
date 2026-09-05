import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// @ts-expect-error plain JS module, no declaration file
import { verifyQuotes, flatten } from '../scripts/lib/verify-quotes.mjs';

const PAGE = `IT Help Desk with Google IT Support Desk
ONLINE - LIVE INSTRUCTION
Students must be 18 or older and provide a government issued ID and
diploma/transcript or GED in ENGLISH. Students pay online at the time of enrollment.`;

// The happy path proves nothing on its own. What has to be proven is that a
// quote the model made up gets caught, because that is the failure this whole
// tool exists to make impossible.

test('a fabricated quote fails verification', () => {
  const entry = {
    format_source_quote: 'ONLINE - LIVE INSTRUCTION',
    cost_source_quote: 'Tuition is fully covered for all applicants.',
  };
  const { failures } = verifyQuotes(entry, PAGE);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].label, 'cost_source_quote');
});

test('a real quote passes even when the page wrapped it across lines', () => {
  const entry = {
    requirements: [
      {
        id: 'REQ-DOC',
        source_quote: 'a government issued ID and diploma/transcript or GED in ENGLISH',
      },
    ],
  };
  const { failures, checked } = verifyQuotes(entry, PAGE);
  assert.equal(checked.length, 1);
  assert.deepEqual(failures, []);
});

test('every field that claims to quote the page is actually checked', () => {
  const entry = {
    credential_source_quote: 'made up credential',
    cost_source_quote: 'made up cost',
    format_source_quote: 'made up format',
    requirements: [{ id: 'R1', source_quote: 'made up requirement' }],
    data_quality_flags: [{ id: 'F1', source_quote: 'made up flag' }],
    plain: { translations: [{ page_says: 'made up translation', you_say: 'plain words' }] },
  };
  const { checked, failures } = verifyQuotes(entry, PAGE);
  assert.equal(checked.length, 6, 'a quoting field escaped verification');
  assert.equal(failures.length, 6);
});

test('curly quotes and ragged whitespace are not treated as differences', () => {
  assert.equal(flatten('  It’s   "open"  '), 'it\'s "open"');
});

// The entry drafted live during the build window, kept as the worked example.
test('the drafted sixth program was verified and left for human review', () => {
  const draft = JSON.parse(readFileSync(new URL('../research/JSCC-DATA.json', import.meta.url), 'utf8'));
  assert.equal(draft.review_status, 'quotes_verified_pending_human_review');
  assert.deepEqual(draft.unverified_quotes, []);
  assert.ok(
    draft.data_quality_flags.some((f: { severity: string }) => f.severity === 'do_not_rely'),
    'the contradiction the tool found is not recorded',
  );
});

// The approval script normalizes a draft into the registry. What must survive
// that step is everything a connector would later be shown as proof.

test('an approved entry carries namespaced ids and a source url on every requirement', () => {
  const registry = JSON.parse(
    readFileSync(new URL('../public/data/programs.json', import.meta.url), 'utf8'),
  );
  const approved = registry.programs.find((p: { id: string }) => p.id === 'JSCC-DATA');
  assert.ok(approved, 'the approved sixth program is not in the registry');
  for (const requirement of approved.requirements) {
    assert.match(requirement.id, /^JSCC-DATA-REQ-\d\d$/);
    assert.ok(requirement.source_url, `${requirement.id} lost its source url in approval`);
  }
  for (const flag of approved.data_quality_flags) {
    assert.match(flag.id, /^JSCC-DATA-DQ-\d\d$/);
  }
  for (const translation of approved.plain.translations) {
    assert.equal(translation.source_url, approved.program_url);
  }
  assert.ok(approved.funding_paths.length > 0, 'approved with no way to pay for it');
  assert.ok(!('review_status' in approved), 'draft bookkeeping leaked into the registry');
  assert.ok(!('unverified_quotes' in approved), 'draft bookkeeping leaked into the registry');
});
