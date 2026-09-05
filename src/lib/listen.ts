/**
 * Listening.
 *
 * The connector has just had the conversation. He is standing in the parking
 * lot with his thumbs, typing what he remembers: "kid wants to get into
 * computers, works at the warehouse days, no car, mom says money is tight."
 *
 * This turns that into the two decisions the hallway screen needs: which
 * program to open, and which situation facts are in play. It does not decide
 * anything about the person, does not store the text, and does not send it
 * anywhere. It runs in the browser on a string the connector typed himself.
 *
 * Every match names the words that triggered it. A connector who cannot see why
 * the tool did something has no way to catch it being wrong, and this tool is
 * going to be wrong sometimes: people do not talk in keywords.
 */
import type { Program, ProgramRegistry } from '../types.ts';
import { SITUATION_FACTS } from './hallway.ts';
import { translationStatus } from './hallway.ts';

export interface Heard {
  /** What was matched, and the words in the connector's notes that matched it. */
  factId: string;
  label: string;
  becauseTheySaid: string;
}

export interface Reading {
  factIds: string[];
  heard: Heard[];
  programId: string | null;
  programBecause: string | null;
  /** Things worth asking about that the notes did not settle. */
  stillUnknown: string[];
}

/**
 * Phrases people actually use, not the words institutions use. "Ain't got a
 * ride" has to hit, because that is what gets said.
 */
const FACT_CUES: Record<string, string[]> = {
  money_tight: [
    'money is tight', 'money tight', 'cannot afford', "can't afford", 'no money',
    'broke', 'tight on money', 'expensive', 'too much money', 'cost too much',
    'struggling', 'behind on rent', 'paycheck to paycheck',
    // From the first recorded interview: money trouble arrives as idiom and as
    // sentences about someone else paying, not as the word "afford".
    "ain't enough", 'aint enough', 'not enough money', 'have to cover it',
    'somebody else is going to have to', "can't pay", 'cannot pay', 'got to be later',
  ],
  no_car: [
    'no car', "doesn't have a car", 'does not have a car', 'no ride', "ain't got a ride",
    'no transportation', 'takes the bus', 'rides the bus', 'no license', 'car broke down',
    'hard to get around', 'lives in huntsville', 'lives out of town', 'far out',
    "don't have a car", 'do not have a car', 'without a car', 'no bus',
  ],
  no_computer: [
    'no computer', 'no laptop', 'no internet', 'no wifi', "doesn't have a computer",
    'does not have a computer', 'only has a phone', 'just has a phone', 'phone only',
    "my phone that's it", 'just my phone', 'just got my phone', 'data runs out',
    'runs out of data', "don't have a computer",
  ],
  works_days: [
    'works days', 'works during the day', 'day shift', 'first shift', 'has a job',
    'working full time', 'works full time', 'at the warehouse', 'cannot miss work',
    "can't miss work", 'nine to five',
  ],
  no_diploma: [
    'no diploma', 'no ged', 'did not finish', "didn't finish", 'dropped out',
    'never graduated', 'no high school', 'working on their ged', 'occupational diploma',
    // "I've been meaning to get my GED" means they do not have one.
    'get my ged', 'get her ged', 'get his ged', 'get their ged',
    'through the 11th', 'through the 10th', 'through 11th grade', 'through 10th grade',
  ],
  on_snap: ['snap', 'food stamps', 'ebt', 'food assistance', 'wic'],
  veteran: ['veteran', 'was in the army', 'was in the navy', 'served', 'military', 'vet'],
  works_nights: [
    'works nights', 'work nights', 'working nights', 'night shift', 'third shift',
    'overnight shift', 'overnights', 'off at 2 in the morning',
  ],
  disability: [
    'disability', 'disabled', 'health condition', 'bad back', 'injured', 'on ssi',
    'cannot stand', "can't stand", 'chronic',
  ],
};

/** What the person said they want, mapped to what the registry actually offers. */
const PROGRAM_CUES: Record<string, string[]> = {
  'JSCC-ITHD': [
    'help desk', 'helpdesk', 'it support', 'tech support', 'work with computers',
    'get into computers', 'computer job', 'google cert', 'it job',
  ],
  'JSCC-APLUS': [
    'fix computers', 'fixing computers', 'repair', 'hardware', 'a+', 'comptia',
    'build computers', 'take them apart',
  ],
  'JSCC-CYBER': [
    'cyber', 'security', 'hacking', 'hacker', 'infosec', 'cybersecurity',
  ],
};

function normalize(text: string): string {
  // Apostrophes go away entirely on both sides of the comparison, so "aint got
  // a ride" and "ain't got a ride" are the same string. People type fast with
  // their thumbs and the curly-quote variants are escaped rather than literal
  // so this file stays pure ASCII on disk.
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019']/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * The connector's own words that triggered a match, with a little room on
 * either side.
 *
 * Quoting the whole note back is not evidence. People type one long run-on
 * sentence, and three chips all citing the same eighty words tells the
 * connector nothing about which part did what.
 */
function evidenceFor(notes: string, cue: string): string {
  const escaped = cue
    .split(/\s+/)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "'?"));
  const match = new RegExp(escaped.join('\\s+'), 'i').exec(notes);
  if (!match) return cue;

  const WINDOW = 22;
  let start = Math.max(0, match.index - WINDOW);
  let end = Math.min(notes.length, match.index + match[0].length + WINDOW);
  // Do not cut a word in half; back off to the nearest space.
  if (start > 0) start = notes.indexOf(' ', start) + 1 || start;
  if (end < notes.length) end = notes.lastIndexOf(' ', end) + 1 || end;

  const quoted = notes.slice(start, end).trim().replace(/\s+/g, ' ');
  return `${start > 0 ? '...' : ''}${quoted}${end < notes.length ? '...' : ''}`;
}

export function readNotes(notes: string, registry: ProgramRegistry): Reading {
  const haystack = normalize(notes);
  const heard: Heard[] = [];

  for (const fact of SITUATION_FACTS) {
    const cue = (FACT_CUES[fact.id] ?? []).find((c) => haystack.includes(normalize(c)));
    if (cue) {
      heard.push({ factId: fact.id, label: fact.label, becauseTheySaid: evidenceFor(notes, cue) });
    }
  }

  let programId: string | null = null;
  let programBecause: string | null = null;
  for (const [id, cues] of Object.entries(PROGRAM_CUES)) {
    const cue = cues.find((c) => haystack.includes(normalize(c)));
    if (!cue) continue;
    const candidate = registry.programs.find((p: Program) => p.id === id);
    if (!candidate || !translationStatus(candidate).canTranslate) continue;
    programId = id;
    programBecause = `They said "${cue}".`;
    break;
  }

  // The two facts that most often decide whether a pathway is survivable are
  // also the two people least often volunteer. If the notes did not settle
  // them, that is worth a question rather than an assumption.
  const factIds = heard.map((h) => h.factId);
  const stillUnknown: string[] = [];
  if (!factIds.includes('no_computer')) {
    stillUnknown.push('Do they have a computer and internet at home that holds up for three hours?');
  }
  if (!factIds.includes('money_tight') && !factIds.includes('on_snap')) {
    stillUnknown.push('Has anyone talked to them about who pays for it?');
  }
  if (!programId) {
    stillUnknown.push('Which of these three did they actually mean? Pick one above.');
  }

  return { factIds, heard, programId, programBecause, stillUnknown };
}
