/**
 * The hallway.
 *
 * A connector's scarce resource is not information. It is the ninety seconds
 * after a meeting, standing up, holding a phone in one hand, when someone says
 * "my nephew needs something after graduation."
 *
 * What fails him there is not that the program page is hard to find. It is that
 * the page is written in institutional language and he has to translate it live,
 * from memory, under pressure, and then remember to close on something.
 *
 * So this module builds the words, not the directory. Three beats: say what it
 * is in plain speech, say it out loud in ninety seconds, hand it over before
 * walking away.
 */
import type {
  FundingPath,
  PlainTranslation,
  Program,
  ProgramRegistry,
  SyntheticProfile,
} from '../types.ts';
import { fundingPathsFor, longDate, nextJoinableCohort } from './planner.ts';

/**
 * Something a connector can learn in ninety seconds without interrogating
 * anyone. These are the facts people volunteer. Each one changes what is worth
 * saying out loud and which doors are worth naming.
 *
 * None of this is stored, transmitted, or used to decide anything about anyone.
 */
export interface SituationFact {
  id: string;
  label: string;
  /** Funding doors this fact makes worth mentioning. */
  opensPaths: string[];
  /** A line to work into the script when this is true. */
  scriptLine?: string;
  /** Something that will bite them later if nobody says it now. */
  warning?: string;
}

export const SITUATION_FACTS: SituationFact[] = [
  {
    id: 'money_tight',
    label: 'Money is tight',
    opensPaths: ['WIOA-CAREERCENTER', 'ACCS-PATHWAYS'],
    scriptLine:
      'You would not have to pay for this up front on your own. There are a few ways people get it covered, and one of them can cover the whole thing.',
  },
  {
    id: 'no_car',
    label: 'No car, or hard to get around',
    opensPaths: [],
    scriptLine: 'You would not have to drive anywhere. The class meets online.',
    warning:
      'Online solves the ride, but it needs a computer and steady internet at home. Ask about that before they count on it. If they do not have both, that is the next thing to solve, not a reason to stop.',
  },
  {
    id: 'no_computer',
    label: 'No computer or home internet',
    opensPaths: [],
    warning:
      'This class meets online, live, twice a week for three hours. A phone will not carry that. Solve the computer and the internet first, or this pathway will fail in week two and it will look like they gave up.',
  },
  {
    id: 'works_nights',
    label: 'Works nights',
    opensPaths: [],
    warning:
      'This class meets at night, and so does their shift. Those are the same hours. Get their exact work schedule before anything else, because a night class solves the day worker and quietly fails the night worker.',
  },
  {
    id: 'works_days',
    label: 'Already working days',
    opensPaths: [],
    scriptLine:
      'It meets at night, six to nine, twice a week. You would not have to quit your job or drop a shift to do it.',
    warning:
      'The class is at night but the enrollment office is not. It is open weekdays, eight to four thirty. Tell them to ask for a callback time, before they take unpaid hours off.',
  },
  {
    id: 'no_diploma',
    label: 'No diploma or GED yet',
    opensPaths: ['JSCC-CAREERPATHWAYS'],
    warning:
      'They will be asked for a diploma, a transcript, or a GED to enroll. That does not end it. The same college runs adult education, and there is help there that is tied to being an adult education student.',
  },
  {
    id: 'on_snap',
    label: 'Gets SNAP or food assistance',
    opensPaths: ['SNAP-ET'],
  },
  {
    id: 'veteran',
    label: 'Veteran, or married to one',
    opensPaths: ['WIOA-CAREERCENTER'],
    scriptLine: 'Being a veteran moves you up the line for the money side of this. That is worth saying when you call.',
  },
  {
    id: 'disability',
    label: 'A health condition makes work hard',
    opensPaths: ['ADRS-VRS'],
  },
];

/**
 * Whether this program can be translated at all.
 *
 * A connector saying plain words about a program is spending their own
 * credibility. Two of the five programs in the registry cannot support that
 * today: one publishes no cost, schedule, or requirements, and one cannot be
 * confirmed to be operating. The honest output for those is the refusal and the
 * reason, not a smoother-sounding paragraph.
 */
export interface TranslationStatus {
  canTranslate: boolean;
  refusal?: string;
  whatToSayInstead?: string;
}

export function translationStatus(program: Program): TranslationStatus {
  const doNotRely = program.data_quality_flags.find((f) => f.severity === 'do_not_rely');
  if (doNotRely) {
    return {
      canTranslate: false,
      refusal: `${program.provider_short} cannot be confirmed to be running this right now. ${doNotRely.note}`,
      whatToSayInstead:
        'Do not send anyone here on your word. If you have heard good things about it, say that you have heard good things and that you are checking whether it is still going.',
    };
  }
  if (!program.plain) {
    const incomplete = program.data_quality_flags.find((f) => f.severity === 'incomplete');
    return {
      canTranslate: false,
      refusal:
        incomplete?.note ??
        `${program.provider_short} has not published enough about this to say anything specific out loud.`,
      whatToSayInstead: `Say "${program.provider_short} runs training in this and I do not know the details, let me get you the number." Then give them the number. Being the person who admits that is worth more than being the person who guessed.`,
    };
  }
  return { canTranslate: true };
}

/**
 * Programs meet in the evening or they do not, and the difference decides
 * whether "night class" is a true thing to say.
 */
function classNoun(program: Program): string {
  const joinable = program.cohorts.filter((c) => c.status !== 'already_started');
  const timed = joinable.length > 0 ? joinable : program.cohorts;
  const allEvening =
    timed.length > 0 && timed.every((c) => /\b([5-9]|1[01]):\d{2}\s*pm/i.test(c.time));
  return allEvening ? 'night class' : 'class';
}

function isOnline(program: Program): boolean {
  return /online/i.test(program.format);
}

/** Beat one: the program in plain speech. */
export interface PlainCard {
  whatItIs: string;
  whatYouGet: string;
  whenItMeets: string;
  whatItCosts: string;
  whatYouNeed: string[];
  /** The institutional sentences this card replaces, kept so it can be checked. */
  translations: PlainTranslation[];
  whatUsuallyStopsPeople: string[];
  confirmWith: string;
  readOn: string;
}

/** Beat two: the ninety seconds, out loud. */
export interface HallwayScript {
  lines: string[];
  theAsk: string;
  askingTips: string[];
  estimatedSeconds: number;
}

export function buildPlainCard(
  program: Program,
  registry: ProgramRegistry,
  factIds: string[],
): PlainCard | null {
  const plain = program.plain;
  if (!plain || !translationStatus(program).canTranslate) return null;

  const cohort = nextJoinableCohort(program);
  const facts = SITUATION_FACTS.filter((f) => factIds.includes(f.id));

  const whatUsuallyStopsPeople: string[] = [];

  const started = program.cohorts.find((c) => c.status === 'already_started');
  if (started) {
    whatUsuallyStopsPeople.push(
      `A class already started on ${longDate(started.start_date)}. People find this page, get excited, and then find out they missed it. Ask whether someone can still join before you plan around the next one.`,
    );
  }

  if (typeof program.cost_usd === 'number' && program.cost_usd > 0) {
    whatUsuallyStopsPeople.push(
      `You pay when you sign up, not later. So if you need help paying, that has to be sorted out first. This is the single most common way people get stuck.`,
    );
  }

  if (program.in_person_help) {
    whatUsuallyStopsPeople.push(
      `The ${classNoun(program)} is at night, but the office you have to call is only open on weekdays, ${program.in_person_help.hours.replace('Monday-Friday, ', '')}. If you work days, ask them for a time they can call you back.`,
    );
  }

  const docs = program.requirements.filter((r) => r.kind === 'document');
  if (docs.length > 0) {
    whatUsuallyStopsPeople.push(
      `You need your ID and a diploma, transcript, or GED. Finding those papers takes longer than people expect, so start looking now.`,
    );
  }

  if (isOnline(program)) {
    const hours = cohort ? sessionHours(cohort.time) : 'three';
    whatUsuallyStopsPeople.push(
      `It is online and live, so you need a computer and internet that holds up for ${hours} hours at a stretch. A phone is not enough. Nobody says this out loud, and it ends more attempts than anything else on this list.`,
    );
  }

  for (const fact of facts) {
    if (fact.warning && !whatUsuallyStopsPeople.includes(fact.warning)) {
      whatUsuallyStopsPeople.push(fact.warning);
    }
  }

  return {
    whatItIs: `A ${classNoun(program)} at ${program.provider_short} that trains you for ${plain.job_said_out_loud}. That is ${plain.the_job_is}.`,
    whatYouGet: plain.what_you_get,
    whenItMeets: cohort
      ? `${cohort.days.replace(' / ', ' and ')} nights, ${cohort.time}, online. The next one starts ${longDate(cohort.start_date)}.`
      : 'No start date is posted right now.',
    whatItCosts:
      typeof program.cost_usd === 'number' && program.cost_usd > 0
        ? `$${program.cost_usd.toLocaleString()}, and you pay when you sign up. There are several ways people get that covered, including one that can pay all of it.`
        : 'Not posted. You have to call and ask.',
    whatYouNeed: program.requirements
      .filter((r) => r.kind !== 'payment' && !r.conditional)
      .map((r) => plainRequirement(r.label)),
    translations: plain.translations,
    whatUsuallyStopsPeople,
    confirmWith: program.contacts[0]
      ? `${program.contacts[0].name}, ${program.contacts[0].phone ?? ''}`
      : program.provider,
    readOn: registry.registry_meta.fetched_at,
  };
}

/**
 * "6:00 pm - 9:00 pm" spoken aloud. A script that reads a clock face out loud
 * sounds like a script.
 */
function spokenTime(time: string): string {
  const spoken: Record<string, string> = {
    '6': 'six', '6:30': 'six thirty', '7': 'seven', '9': 'nine', '9:30': 'nine thirty',
  };
  const parts = time.match(/(\d{1,2})(?::(\d{2}))?\s*[ap]m/gi);
  if (!parts || parts.length < 2) return time;
  const key = (part: string) => {
    const m = part.match(/(\d{1,2})(?::(\d{2}))?/);
    if (!m) return part;
    return m[2] && m[2] !== '00' ? `${m[1]}:${m[2]}` : m[1];
  };
  const from = spoken[key(parts[0])];
  const to = spoken[key(parts[1])];
  return from && to ? `${from} to ${to}` : time;
}

/** How long one session runs, for the device warning. */
function sessionHours(time: string): string {
  const parts = time.match(/(\d{1,2})(?::(\d{2}))?\s*[ap]m/gi);
  if (!parts || parts.length < 2) return 'three';
  const minutes = (part: string) => {
    const m = part.match(/(\d{1,2})(?::(\d{2}))?/);
    return m ? Number(m[1]) * 60 + Number(m[2] ?? 0) : 0;
  };
  const span = Math.round((minutes(parts[1]) - minutes(parts[0])) / 60);
  return ['zero', 'one', 'two', 'three', 'four', 'five'][span] ?? String(span);
}

function plainRequirement(label: string): string {
  return label
    .replace('Government-issued ID and a diploma, transcript, or GED in English', 'A photo ID, and a diploma, transcript, or GED')
    .replace('Be 18 or older', 'To be 18 or older')
    .replace('No previous computer experience is required', 'No computer experience. They will teach you from the start');
}

/**
 * Beat two. Roughly two hundred words, which is about ninety seconds spoken,
 * ending in one ask rather than a list of things to do.
 */
export function buildScript(program: Program, factIds: string[]): HallwayScript | null {
  const plain = program.plain;
  if (!plain || !translationStatus(program).canTranslate) return null;

  const cohort = nextJoinableCohort(program);
  const has = (id: string) => factIds.includes(id);
  const online = isOnline(program);
  const lines: string[] = [];

  // Composed slot by slot rather than appended, so that ticking two facts never
  // makes the script say the same thing twice. Ninety seconds does not have room
  // for a repeated sentence, and repetition is what makes a script sound like one.

  lines.push(
    `There is a ${classNoun(program)} at ${program.provider_short} for ${plain.job_said_out_loud}. That is ${plain.the_job_is}.`,
  );

  if (cohort) {
    const when = `${cohort.days.replace(' / ', ' and ')} nights, ${spokenTime(cohort.time)}${online ? ', online' : ''}`;
    lines.push(
      has('works_days')
        ? `It runs ${when}, so you would not have to quit your job or drop a shift. The next one starts ${longDate(cohort.start_date)}.`
        : `It runs ${when}. The next one starts ${longDate(cohort.start_date)}.`,
    );
  }

  if (online && has('no_car') && !has('no_computer')) {
    lines.push(
      `You would not have to drive anywhere for it. You would need a computer and internet at home though, so let us make sure you have that.`,
    );
  }

  if (online && has('no_computer')) {
    lines.push(
      `One catch. It is online and live, so you would need a computer and steady internet. A phone will not do it. Let us solve that part first.`,
    );
  }

  if (typeof program.cost_usd === 'number' && program.cost_usd > 0) {
    lines.push(
      has('money_tight')
        ? `It costs $${program.cost_usd.toLocaleString()}, but you would not be paying that yourself. A few programs help with it, and one can cover all of it. I do not decide that, they do. It is worth one call.`
        : `It costs $${program.cost_usd.toLocaleString()}, and you pay when you sign up. A lot of people do not pay that themselves. A few programs help, and one can cover all of it.`,
    );
  }

  if (has('veteran')) {
    lines.push(`If you served, say that when you call. It moves you up the line for the money.`);
  }

  if (has('no_diploma')) {
    lines.push(
      `They will ask for a diploma or a GED. If you do not have one yet, that is not the end of it. The same school can help you with that part.`,
    );
  }

  lines.push(
    `I want to be straight with you. I cannot promise you a seat and I cannot promise they will pay for it. What I can tell you is who to call and what to ask.`,
  );

  const theAsk = 'Can I text you the number and what to say, right now, before I forget?';

  const askingTips = [
    'Ask by offering, not by qualifying. "A lot of folks get this paid for, want me to find out if that is you?" gets an answer. "Are you low income?" ends the conversation.',
    'Do not ask what is wrong with someone. Say "some of these programs are built for people dealing with a health thing, is any of that you?" and let them decide what to tell you.',
    'If they go quiet on money, move on and put it in the text instead. Reading it alone later is easier than saying it out loud to someone they know.',
    'Close with the text, not with advice. The number in their phone is worth more than anything else you said.',
  ];

  const words = lines.join(' ').split(/\s+/).length + theAsk.split(/\s+/).length;
  return { lines, theAsk, askingTips, estimatedSeconds: Math.round((words / 140) * 60) };
}

/** Beat three: the message he sends before walking away. */
export function buildHandoffMessage(
  program: Program,
  registry: ProgramRegistry,
  factIds: string[],
  profile: SyntheticProfile,
): string {
  const cohort = nextJoinableCohort(program);
  const paths = fundingPathsFor(program, registry);
  const opened = new Set(
    SITUATION_FACTS.filter((f) => factIds.includes(f.id)).flatMap((f) => f.opensPaths),
  );
  const relevant: FundingPath[] = paths.filter((p) => opened.has(p.id));
  const money = relevant.length > 0 ? relevant : paths.slice(0, 2);

  const lines: string[] = [];
  lines.push(`Good talking to you. Here is what I said I would send.`);
  lines.push('');
  lines.push(`${program.program_name}, at ${program.provider}.`);
  if (cohort) {
    lines.push(
      `${cohort.days.replace(' / ', ' and ')} nights, ${cohort.time}, online. Next start: ${longDate(cohort.start_date)}.`,
    );
  }
  if (typeof program.cost_usd === 'number' && program.cost_usd > 0) {
    lines.push(`Cost: $${program.cost_usd.toLocaleString()}, due when you sign up.`);
  }
  lines.push('');
  lines.push('DO THIS FIRST, before you sign up for anything:');

  const wioa = paths.find((p) => p.ordering_constraint);
  const firstCall = wioa?.contacts[0];
  if (firstCall) {
    lines.push(`Call ${firstCall.name}, ${firstCall.phone ?? ''}.`);
    lines.push(
      `Say: "I want to take a workforce training class at ${program.provider}. Can you tell me if I qualify for help paying for it, what you need from me, and how long it takes?"`,
    );
    lines.push(
      `Do that before you enroll. The college takes the money when you sign up, and this office is the one that decides about help paying.`,
    );
  }

  if (money.length > 0) {
    lines.push('');
    lines.push('Other places that help with the cost:');
    for (const path of money) {
      const contact = path.contacts[0];
      lines.push(
        `- ${path.name}${contact?.phone ? `, ${contact.phone}` : ''}. ${path.covers}.`,
      );
    }
  }

  const started = program.cohorts.find((c) => c.status === 'already_started');
  if (started) {
    lines.push('');
    lines.push(
      `One more thing: a class started on ${longDate(started.start_date)}. Ask if you can still get in, before you settle for the later one.`,
    );
  }

  lines.push('');
  lines.push(
    `Straight talk: nobody has promised you a seat or promised to pay. These are the right people to ask. I looked all this up on ${longDate(registry.registry_meta.fetched_at.slice(0, 10))} and it can change, so let them confirm it.`,
  );
  lines.push('');
  lines.push(`(Demo message. The example situation, ${profile.profileId}, is made up.)`);

  return lines.join('\n');
}

/**
 * Flesch-Kincaid grade level. Approximate, and that is fine: it is used as a
 * regression guard so the script cannot drift back into institutional prose,
 * not as a linguistic claim.
 */
export function readingGrade(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length || 1;
  const words = text.split(/\s+/).filter(Boolean);
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  return 0.39 * (words.length / sentences) + 11.8 * (syllables / words.length) - 15.59;
}

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 3) return 1;
  const groups = w
    .replace(/e$/, '')
    .match(/[aeiouy]+/g);
  return groups ? groups.length : 1;
}
