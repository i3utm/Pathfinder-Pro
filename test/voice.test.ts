import { test } from 'node:test';
import assert from 'node:assert/strict';

import { appendTranscript } from '../src/lib/voice.ts';
import { readNotes } from '../src/lib/listen.ts';
import { readFileSync } from 'node:fs';
import type { ProgramRegistry } from '../src/types.ts';

const registry = JSON.parse(
  readFileSync(new URL('../public/data/programs.json', import.meta.url), 'utf8'),
) as ProgramRegistry;

// The browser half of dictation cannot be exercised here. What can be, and what
// actually breaks, is the seam: speech arrives as unpunctuated fragments and the
// matcher downstream has to still recognize them.

test('speech arrives in fragments and folds into one line of notes', () => {
  const spoken = ['he wants to get into computers', 'works days at the warehouse', 'no car'];
  const notes = spoken.reduce(appendTranscript, '');
  assert.equal(notes, 'he wants to get into computers works days at the warehouse no car');
});

test('empty and ragged chunks do not leave double spaces behind', () => {
  assert.equal(appendTranscript('no car', '   '), 'no car');
  assert.equal(appendTranscript('no car ', '  money   is  tight '), 'no car money is tight');
  assert.equal(appendTranscript('', 'no car'), 'no car');
});

test('dictated notes, with no punctuation or capitals, still match', () => {
  const dictated = ['she wants to get into computers', 'she takes the bus', 'money is tight']
    .reduce(appendTranscript, '');
  const reading = readNotes(dictated, registry);
  assert.deepEqual(new Set(reading.factIds), new Set(['no_car', 'money_tight']));
  assert.equal(reading.programId, 'JSCC-ITHD');
});
