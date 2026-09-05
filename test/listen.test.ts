import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { readNotes } from '../src/lib/listen.ts';
import { SITUATION_FACTS, buildScript, translationStatus } from '../src/lib/hallway.ts';
import * as hallwayForNights from '../src/lib/hallway.ts';
import type { ProgramRegistry } from '../src/types.ts';

const registry = JSON.parse(
  readFileSync(new URL('../public/data/programs.json', import.meta.url), 'utf8'),
) as ProgramRegistry;

test('the connector types what he remembers and gets the right chips', () => {
  const reading = readNotes(
    'kid wants to get into computers, works days at the warehouse, no car, mom says money is tight',
    registry,
  );
  assert.deepEqual(new Set(reading.factIds), new Set(['works_days', 'no_car', 'money_tight']));
  assert.equal(reading.programId, 'JSCC-ITHD');
});

test('every match names the words that produced it', () => {
  const notes = 'She takes the bus everywhere. Gets food stamps. Wants to fix computers.';
  const reading = readNotes(notes, registry);
  for (const heard of reading.heard) {
    const quoted = heard.becauseTheySaid.replace(/^\.\.\.|\.\.\.$/g, '').trim();
    assert.ok(quoted.length > 0, `${heard.factId} matched without evidence`);
    assert.ok(
      notes.toLowerCase().includes(quoted.toLowerCase()),
      `${heard.factId} cited words that are not in the notes: "${quoted}"`,
    );
    assert.ok(
      quoted.length < notes.length,
      `${heard.factId} quoted the whole note back instead of the words that matched`,
    );
  }
  assert.equal(reading.programId, 'JSCC-APLUS');
});

test('it says so rather than guessing when it recognizes nothing', () => {
  const reading = readNotes('we talked for a while after the meeting', registry);
  assert.deepEqual(reading.factIds, []);
  assert.equal(reading.programId, null);
  assert.ok(reading.stillUnknown.some((q) => /which of these three/i.test(q)));
});

test('it never routes to a program a connector should not vouch for', () => {
  const everyCue = registry.programs.map((p) => p.program_name).join(' ');
  const reading = readNotes(`${everyCue} lawson innovate bootcamp cyber`, registry);
  if (reading.programId) {
    const routed = registry.programs.find((p) => p.id === reading.programId)!;
    assert.ok(translationStatus(routed).canTranslate);
  }
});

test('the device question is always raised when the notes did not settle it', () => {
  const reading = readNotes('wants an it job, money is tight', registry);
  assert.ok(reading.stillUnknown.some((q) => /computer and internet/i.test(q)));
});

test('the money question is dropped once the notes settle it', () => {
  const reading = readNotes('he gets snap, no computer at home, help desk', registry);
  assert.ok(!reading.stillUnknown.some((q) => /who pays/i.test(q)));
  assert.ok(!reading.stillUnknown.some((q) => /computer and internet/i.test(q)));
});

test('every fact the reader can emit is a fact the script knows how to use', () => {
  const known = new Set(SITUATION_FACTS.map((f) => f.id));
  const reading = readNotes(
    'no car no computer no diploma food stamps veteran disability works days money is tight help desk',
    registry,
  );
  for (const id of reading.factIds) assert.ok(known.has(id), `${id} is not a situation fact`);
  const program = registry.programs.find((p) => p.id === reading.programId)!;
  assert.ok(buildScript(program, reading.factIds), 'the reader produced facts the script rejected');
});

test('each chip cites the part of the note that produced it, not the whole note', () => {
  const notes =
    'kid wants to get into computers, works days at the warehouse, no car, mom says money is tight';
  const reading = readNotes(notes, registry);
  assert.equal(reading.heard.length, 3);
  const quotes = reading.heard.map((h) => h.becauseTheySaid);
  assert.equal(new Set(quotes).size, 3, 'three chips gave the same quote');
  for (const q of quotes) {
    assert.ok(q.length < notes.length, `quoted the whole note: "${q}"`);
  }
});

test('thumbs skip apostrophes, and the reader still hears it', () => {
  const withApostrophe = readNotes("she aint got a ride and doesn't have a computer", registry);
  const without = readNotes('she aint got a ride and doesnt have a computer', registry);
  assert.deepEqual(new Set(withApostrophe.factIds), new Set(['no_car', 'no_computer']));
  assert.deepEqual(without.factIds, withApostrophe.factIds);
});

// The first real interview, recorded at the event's project showcase. The
// matcher recognized none of it, because its cues were written for compressed
// connector notes and this is how people actually talk: negation at a distance,
// idiom, and money trouble phrased as someone else having to pay. This
// transcript is the regression fixture so that failure stays fixed.
const SHOWCASE_TRANSCRIPT = `all right I'm just going to record this so I don't have to write everything
down is that okay yeah that's fine cool so just talk to me normal where are you staying right now
over in Ensley off Avenue I've been there my whole life pretty much and are you working right now
yeah I clean off this is downtown nights I go in at 6:00 and I'm off at 2:00 in the morning four
nights a week it's all right just it ain't enough and they cut me back to four nights in the spring
so how are you getting downtown but that's the whole thing at 2:00 in the morning so I got my
license I just don't have a car right now I did get through the 11th I had my daughter and didn't
go back I've been meaning to get my GED I just never you know that's all right that's fixable how
old your daughter she's seven she's in school during the day and my granny watches her in the
evenings when I work now you were telling me about your grandmother earlier oh yeah I take care of
her going in going on three years now I do her medicine she's got like six different ones different
times today and some of them she can't can't take with food so I have to keep that all on a chart I
get to make her appointment it's just what you do so what do you want like if it went how you
wanted it I want to get into Healthcare my cousin is a CNA at one of the nursing homes and she's
making almost double what I make and she says that they're always hiring I think I'd be good at it
I already do it basically I just don't get paid how fast you need money coming in I can't quit my
job whatever I do I got to keep working nights but I could do something during the daytime like
mornings if it's not every single day my granny she just can't be that alone that long better so
how long will you be willing to be in a program like weeks months a couple of months I could do not
two years I can't do it for 2 years and money could you pay for a class up front no not right now
if it's something I've got to pay for it's just it's got to be later somebody else is going to have
to cover it do you have a computer at home I got my phone that's it and my data runs out towards
the end of the month usually all right let me see what this thing says that`;

test('the showcase interview is heard instead of returning nothing', () => {
  const reading = readNotes(SHOWCASE_TRANSCRIPT, registry);
  for (const expected of ['money_tight', 'no_car', 'no_computer', 'no_diploma', 'works_nights']) {
    assert.ok(reading.factIds.includes(expected), `${expected} was missed again`);
  }
  // She works nights, not days. Lighting works_days here would be wrong.
  assert.ok(!reading.factIds.includes('works_days'));
  // Her goal is healthcare. The registry covers technology, so no program
  // should light up; the honest next step is the handoff, not a tech class.
  assert.equal(reading.programId, null);
  // Every match still names its evidence.
  for (const heard of reading.heard) {
    assert.ok(heard.becauseTheySaid.trim().length > 0, `${heard.factId} without evidence`);
  }
});

test('working nights surfaces the night-class collision as a warning', () => {
  const { buildPlainCard } = hallwayForNights;
  const program = registry.programs.find((p) => p.id === 'JSCC-ITHD')!;
  const card = buildPlainCard(program, registry, ['works_nights'])!;
  assert.ok(
    card.whatUsuallyStopsPeople.some((s) => /same hours/i.test(s)),
    'the shift collision warning did not surface',
  );
});
