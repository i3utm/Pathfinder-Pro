/**
 * The planner.
 *
 * Every output of this module is produced by a named rule that states its own
 * reasoning in plain language and cites the source sentence behind it. There is
 * no score, no ranking of people, and no prediction. When the rules cannot
 * answer a question, the planner emits the question rather than a guess.
 */
import type {
  AccessCollision,
  Disclosure,
  FundingPath,
  BarrierAssessment,
  BarrierKind,
  Caution,
  Cohort,
  ConfidentFact,
  ConnectorBrief,
  Contact,
  CredibilityRisk,
  PathwayOption,
  PlanStep,
  Program,
  ProgramRegistry,
  SevenDayPlan,
  SyntheticProfile,
} from '../types';

/** The Lab's build date. Fixed so the demo reads the same all day. */
export const TODAY = new Date('2026-08-28T00:00:00-05:00');

const DAY_MS = 24 * 60 * 60 * 1000;

interface BarrierRule {
  kind: BarrierKind;
  label: string;
  /** Which profile fields this rule reads. */
  fields: (keyof SyntheticProfile)[];
  pattern: RegExp;
  describe: (matchedText: string) => string;
}

/**
 * Barrier detection. Each rule reads named fields of the synthetic profile and
 * says which words triggered it, so a navigator can see why a barrier was named.
 */
export const BARRIER_RULES: BarrierRule[] = [
  {
    kind: 'schedule',
    label: 'Daytime work schedule',
    fields: ['constraint'],
    pattern: /works?\s+(daytime|day)\b|daytime\s+\w*\s*shift|needs evening options/i,
    describe: (m) => `The profile states a daytime working commitment ("${m}"), so anything meeting in business hours conflicts with income.`,
  },
  {
    kind: 'transport',
    label: 'Transportation',
    fields: ['constraint'],
    pattern: /vehicle|transit|transport/i,
    describe: (m) => `The profile states a transportation limit ("${m}"), so travel to a campus is a cost in time and money, not a detail.`,
  },
  {
    kind: 'upfront_cost',
    label: 'Money needed before day one',
    fields: ['constraint'],
    pattern: /afford|upfront|up front|working capital|collateral/i,
    describe: (m) => `The profile states a limit on money available before starting ("${m}"), so any fee due at enrollment is a gate, not a line item.`,
  },
  {
    kind: 'documentation',
    label: 'Documents and checks',
    fields: ['constraint', 'requirement'],
    pattern: /permit|certifi\w*|documentation|background check|screening|records|business plan|diploma/i,
    describe: (m) => `A document, certification, or check is required ("${m}"). These take other people's time, so they set the earliest possible start date.`,
  },
  {
    kind: 'experience',
    label: 'No prior experience',
    fields: ['constraint', 'currentState'],
    pattern: /no prior work experience|no certifications/i,
    describe: (m) => `The profile reports no prior experience or credentials ("${m}"), so programs that assume a background are not reachable yet.`,
  },
];

export function detectBarriers(profile: SyntheticProfile): BarrierAssessment[] {
  const found: BarrierAssessment[] = [];

  for (const rule of BARRIER_RULES) {
    for (const field of rule.fields) {
      const value = String(profile[field] ?? '');
      const match = value.match(rule.pattern);
      if (!match) continue;
      if (found.some((f) => f.barrier === rule.kind)) continue;

      found.push({
        barrier: rule.kind,
        barrierLabel: rule.label,
        verdict: 'does_not_address',
        why: rule.describe(match[0]),
        sourceQuote: value,
        sourceUrl: undefined,
      });
    }
  }

  return found;
}

function isEveningCohort(cohort: Cohort): boolean {
  const match = cohort.time.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (!match) return false;
  let hour = Number(match[1]) % 12;
  if (match[3].toLowerCase() === 'pm') hour += 12;
  return hour >= 17;
}

function isOnline(program: Program): boolean {
  return /online/i.test(program.format);
}

export function nextJoinableCohort(program: Program, today: Date = TODAY): Cohort | null {
  const upcoming = program.cohorts
    .filter((c) => new Date(`${c.start_date}T00:00:00-05:00`).getTime() >= today.getTime())
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  return upcoming[0] ?? null;
}

export function daysUntil(dateIso: string, today: Date = TODAY): number {
  return Math.round((new Date(`${dateIso}T00:00:00-05:00`).getTime() - today.getTime()) / DAY_MS);
}

/**
 * How one program relates to one barrier. The verdict is always accompanied by
 * the reason and, where one exists, the sentence on the program's own page.
 */
function assessBarrier(
  barrier: BarrierAssessment,
  program: Program,
  registry: ProgramRegistry,
): BarrierAssessment {
  const evening = program.cohorts.some(isEveningCohort);
  const online = isOnline(program);
  const docs = program.requirements.filter((r) => r.kind === 'document' || r.kind === 'assessment');
  const payment = program.requirements.find((r) => r.kind === 'payment');

  switch (barrier.barrier) {
    case 'schedule': {
      if (evening && online) {
        // Describe a cohort the person could actually join, not one that has
        // already started, even though both meet in the evening.
        const joinable = nextJoinableCohort(program);
        const cohort =
          joinable && isEveningCohort(joinable) ? joinable : program.cohorts.find(isEveningCohort)!;
        return {
          ...barrier,
          verdict: 'addresses',
          why: `Classes meet ${cohort.days}, ${cohort.time}, delivered online. That sits outside a daytime shift.`,
          sourceQuote: program.format_source_quote,
          sourceUrl: program.schedule_url ?? program.program_url,
        };
      }
      if (program.cohorts.length === 0) {
        return {
          ...barrier,
          verdict: 'unknown',
          why: 'This provider does not publish class times, so whether it fits a daytime shift cannot be answered from the page.',
          sourceUrl: program.program_url,
        };
      }
      return {
        ...barrier,
        verdict: 'does_not_address',
        why: 'The published meeting times fall inside a daytime working schedule.',
        sourceUrl: program.schedule_url ?? program.program_url,
      };
    }

    case 'transport': {
      if (online) {
        return {
          ...barrier,
          verdict: 'addresses',
          why: 'Instruction is delivered online, so no travel to a campus is required for class itself. Enrollment help and the funding office are still in-person or phone.',
          sourceQuote: program.format_source_quote,
          sourceUrl: program.program_url,
        };
      }
      return {
        ...barrier,
        verdict: 'unknown',
        why: 'The page does not state a delivery mode, so travel requirements are unknown.',
        sourceUrl: program.program_url,
      };
    }

    case 'upfront_cost': {
      if (program.cost_usd === null) {
        return {
          ...barrier,
          verdict: 'unknown',
          why: 'This provider does not publish a price. It cannot be planned around until someone calls and asks.',
          sourceUrl: program.program_url,
        };
      }
      if (program.cost_usd === 0) {
        return {
          ...barrier,
          verdict: 'addresses',
          why: 'Historically free to students. Whether that still holds is a separate question flagged on this program.',
          sourceUrl: program.program_url,
        };
      }
      const funding = registry.funding_paths.find((f) => program.funding_paths.includes(f.id));
      return {
        ...barrier,
        verdict: 'does_not_address',
        why: `The course costs $${program.cost_usd.toLocaleString()}, and ${payment?.label.toLowerCase() ?? 'payment is due at enrollment'}. ${
          funding
            ? `A ${funding.name} may cover it, but ${funding.determined_by.toLowerCase()} decides that, not the college. That is why the funding step comes first in the plan below.`
            : 'No funding path is recorded for this program.'
        }`,
        sourceQuote: payment?.source_quote,
        sourceUrl: payment?.source_url ?? program.program_url,
      };
    }

    case 'documentation': {
      if (docs.length === 0) {
        return {
          ...barrier,
          verdict: 'unknown',
          why: 'This provider does not publish entry requirements, so the paperwork burden is unknown.',
          sourceUrl: program.program_url,
        };
      }
      const conditional = docs.filter((d) => d.conditional);
      return {
        ...barrier,
        verdict: 'does_not_address',
        why: `This program requires: ${docs.map((d) => d.label).join('; ')}.${
          conditional.length > 0
            ? ` One of these applies only in some cases, so it is a question to ask rather than a task to assume.`
            : ''
        } Gathering these is what sets the earliest realistic start date.`,
        sourceQuote: docs[0].source_quote,
        sourceUrl: docs[0].source_url ?? program.program_url,
      };
    }

    case 'experience': {
      const noExp = program.requirements.find((r) => r.id === 'no_experience');
      if (noExp) {
        return {
          ...barrier,
          verdict: 'addresses',
          why: 'The program states that no previous computer experience is required.',
          sourceQuote: noExp.source_quote,
          sourceUrl: noExp.source_url,
        };
      }
      return {
        ...barrier,
        verdict: 'unknown',
        why: 'The page does not say whether prior experience is assumed. Worth asking on the first call.',
        sourceUrl: program.program_url,
      };
    }

    default:
      return { ...barrier, verdict: 'unknown', why: 'No rule covers this barrier.' };
  }
}

function isBlocking(program: Program): { blocking: boolean; reason?: string } {
  if (program.recommendation === 'do_not_plan_around_until_confirmed') {
    const flag = program.data_quality_flags.find((f) => f.severity === 'do_not_rely');
    return { blocking: true, reason: flag?.note };
  }
  return { blocking: false };
}

/** Programs are matched to a profile by pathway, and the reason is stated. */
export function buildOptions(
  profile: SyntheticProfile,
  barriers: BarrierAssessment[],
  registry: ProgramRegistry,
): PathwayOption[] {
  if (profile.pathway !== registry.registry_meta.pathway) return [];

  return registry.programs.map((program) => {
    const { blocking, reason } = isBlocking(program);
    return {
      program,
      inclusionReason: `${program.provider_short} runs this as ${
        program.academy ?? 'a workforce program'
      }, and it leads to ${program.leads_to.toLowerCase()}. It is listed because the profile's stated goal is "${profile.goal}".`,
      assessments: barriers.map((b) => assessBarrier(b, program, registry)),
      nextCohort: nextJoinableCohort(program),
      blocking,
      blockingReason: reason,
    };
  });
}

const STOPWORDS = new Set([
  'a', 'an', 'and', 'or', 'the', 'to', 'in', 'of', 'for', 'with', 'on', 'at',
  'enter', 'become', 'secure', 'qualify', 'complete', 'roles', 'role',
]);

function significantTerms(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 1 && !STOPWORDS.has(w))
      .map((w) => (w.endsWith('s') ? w.slice(0, -1) : w)),
  );
}

/**
 * How closely a program's stated destination matches the profile's stated goal.
 * Plain word overlap, deliberately: a navigator can check it by eye, which is
 * the point. This is not a quality judgement about the program.
 */
export function goalAlignment(profile: SyntheticProfile, program: Program): number {
  const goal = significantTerms(profile.goal);
  const dest = significantTerms(program.leads_to);
  let shared = 0;
  for (const term of goal) if (dest.has(term)) shared += 1;
  return shared;
}

/**
 * Recommendation rule, stated in full so it can be argued with.
 * The person is never scored or ranked; these tests are applied to programs.
 */
export const RECOMMENDATION_RULE =
  'Options that are blocked by a data-quality problem are set aside. Of the rest, the planner prefers the program whose stated destination most closely matches the goal in the profile, then the one that addresses the most of the profile\'s stated barriers, then the one with the earliest cohort a person could still join. Each test is plain word overlap or a count you can check by eye. Nothing is scored and no person is ranked.';

export function chooseRecommended(
  options: PathwayOption[],
  profile: SyntheticProfile,
): PathwayOption | null {
  const eligible = options.filter((o) => !o.blocking);
  if (eligible.length === 0) return null;

  return eligible.reduce((best, current) => {
    const goal = (o: PathwayOption) => goalAlignment(profile, o.program);
    if (goal(current) !== goal(best)) return goal(current) > goal(best) ? current : best;

    const addressed = (o: PathwayOption) =>
      o.assessments.filter((a) => a.verdict === 'addresses').length;
    if (addressed(current) !== addressed(best)) return addressed(current) > addressed(best) ? current : best;

    const start = (o: PathwayOption) => o.nextCohort?.start_date ?? '9999-12-31';
    return start(current) < start(best) ? current : best;
  });
}

const dayLabel = (date: Date) =>
  date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'America/Chicago',
  });

const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6;

/** Every office in this pathway keeps weekday hours, so a call step must not land on a weekend. */
function shiftToBusinessDay(date: Date): Date {
  const moved = new Date(date);
  while (isWeekend(moved)) moved.setDate(moved.getDate() + 1);
  return moved;
}

/**
 * Day windows are real dates, and steps that require reaching an office are
 * moved off weekends. Telling someone to phone a Monday-to-Friday office on a
 * Saturday is exactly the failure this project exists to catch.
 */
function formatDayWindow(
  startDay: number,
  endDay: number,
  options: { businessHoursOnly?: boolean } = {},
  today: Date = TODAY,
): string {
  const raw = (offset: number) => new Date(today.getTime() + offset * DAY_MS);
  const adjust = (d: Date) => (options.businessHoursOnly ? shiftToBusinessDay(d) : d);

  const start = adjust(raw(startDay - 1));
  const end = adjust(raw(endDay - 1));

  if (start.getTime() === end.getTime()) return dayLabel(start);
  return `${dayLabel(start)} to ${dayLabel(end)}`;
}

/**
 * Human-readable form of an ISO date, for text a person reads aloud on a call.
 * Formatted in UTC from the date parts: a cohort date is a calendar date, and
 * rendering it through a zone that changes offset in November silently shifts
 * it by a day.
 */
export function longDate(dateIso: string): string {
  const [year, month, day] = dateIso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * The seven-day plan. The ordering is not cosmetic: when a funding path declares
 * a `funding_before_enrollment` constraint and the profile has a money barrier,
 * the funding conversation is step one, because enrolling first means having paid.
 */
export function buildSteps(
  profile: SyntheticProfile,
  option: PathwayOption | null,
  barriers: BarrierAssessment[],
  registry: ProgramRegistry,
  blockedOptions: PathwayOption[],
): PlanStep[] {
  if (!option) return [];

  const steps: PlanStep[] = [];
  const program = option.program;
  const funding = fundingPathsFor(program, registry).find(
    (f) => f.ordering_constraint?.rule === 'funding_before_enrollment',
  );
  const hasMoneyBarrier = barriers.some((b) => b.barrier === 'upfront_cost');
  const push = (step: Omit<PlanStep, 'order'>) => steps.push({ ...step, order: steps.length + 1 });

  const costsMoney = typeof program.cost_usd === 'number' && program.cost_usd > 0;
  if (funding && costsMoney && funding.ordering_constraint) {
    const contact = funding.contacts[0];
    push({
      dayWindow: formatDayWindow(1, 1, { businessHoursOnly: true }),
      title: hasMoneyBarrier
        ? `Open the ${funding.name} conversation today`
        : `Settle how the $${program.cost_usd!.toLocaleString()} gets paid, before anything else`,
      detail: `Call the ${contact.name}${contact.phone ? ` at ${contact.phone}` : ''} and ask to start an eligibility determination. Ask three things: whether this situation qualifies, exactly which documents they need, and how long a determination takes.${
        hasMoneyBarrier
          ? ''
          : ` This profile does not state a money problem, so this step is here as a question rather than an assumption. But the course costs $${program.cost_usd!.toLocaleString()} and the college takes payment at the moment of enrollment, so if cost is a factor at all, this is the call that has to happen first. If it genuinely is not a factor, this step takes one minute to close.`
      }`,
      doneBy: 'the person',
      confirmedBy: contact.name,
      confirmationQuestion:
        'Am I eligible for a WIOA training scholarship, what do you need from me, and how long will a determination take?',
      contact,
      why: funding.ordering_constraint!.why,
      sourceQuotes: funding.ordering_constraint!.source_quotes,
      sourceUrls: [funding.source_url],
      isConfirmationOnly: false,
    });
  }

  const started = program.cohorts.find((c) => c.status === 'already_started');
  const providerContact = program.contacts[0];
  if (started && providerContact) {
    push({
      dayWindow: formatDayWindow(1, 2, { businessHoursOnly: true }),
      title: `Ask whether the ${started.days} cohort still accepts a late start`,
      detail: `The ${started.days} section began ${longDate(started.start_date)}, ${Math.abs(
        daysUntil(started.start_date),
      )} days ago. Whether someone can still join is a question only ${program.provider_short} can answer, and it is worth one phone call before planning around a later date.`,
      doneBy: 'the person',
      confirmedBy: providerContact.name,
      confirmationQuestion: `The ${started.days} section started on ${longDate(started.start_date)}. Can someone still enroll, or should I plan for the next cohort?`,
      contact: providerContact,
      why: 'A cohort that already started is not automatically closed, and the difference between joining now and waiting is months of income.',
      sourceQuotes: started.status_note ? [started.status_note] : [],
      sourceUrls: [program.schedule_url ?? program.program_url],
      isConfirmationOnly: true,
    });
  }

  const docs = program.requirements.filter((r) => r.kind === 'document' || r.kind === 'assessment');
  if (docs.length > 0) {
    const conditional = docs.filter((d) => d.conditional);
    push({
      dayWindow: formatDayWindow(2, 5),
      title: 'Gather the documents the program requires at enrollment',
      detail: `Collect: ${docs
        .filter((d) => !d.conditional)
        .map((d) => d.label)
        .join('; ')}.${
        conditional.length > 0
          ? ` Then ask whether ${conditional
              .map((d) => d.label.toLowerCase())
              .join(' or ')} applies in this case, rather than assuming it does.`
          : ''
      } The same documents are usually what the funding office asks for, so gathering them once serves both steps.`,
      doneBy: 'the person',
      confirmedBy: providerContact?.name ?? program.provider,
      confirmationQuestion: 'Here is what I have. Is anything missing, and does the reading assessment apply to me?',
      contact: providerContact,
      why: 'These are the requirements the program publishes for entry. Documents depend on other offices, so they set the earliest realistic start date.',
      sourceQuotes: docs.map((d) => d.source_quote).filter((q): q is string => Boolean(q)),
      sourceUrls: docs.map((d) => d.source_url).filter((u): u is string => Boolean(u)),
      isConfirmationOnly: false,
    });
  }

  const flaggedCohort = program.cohorts.find((c) => c.data_quality_flag);
  if (flaggedCohort) {
    const flag = program.data_quality_flags.find((f) => f.id === flaggedCohort.data_quality_flag);
    push({
      dayWindow: formatDayWindow(2, 5, { businessHoursOnly: true }),
      title: 'Confirm the published cohort dates, which do not read correctly',
      detail: flag?.note ?? 'The published dates for this cohort are internally inconsistent and need confirmation.',
      doneBy: 'the person',
      confirmedBy: providerContact?.name ?? program.provider,
      confirmationQuestion: `The schedule lists this section as ${flag?.source_quote ?? 'running to a date before it starts'}. What are the real start and end dates?`,
      contact: providerContact,
      why: 'Planning several months of evenings around a date that is printed wrong is a real risk, and one call removes it.',
      sourceQuotes: flag?.source_quote ? [flag.source_quote] : [],
      sourceUrls: [program.schedule_url ?? program.program_url],
      isConfirmationOnly: true,
    });
  }

  for (const blocked of blockedOptions) {
    push({
      dayWindow: formatDayWindow(3, 5, { businessHoursOnly: true }),
      title: `Resolve, but do not plan around, ${blocked.program.provider}`,
      detail: `${blocked.blockingReason ?? 'This program has an unresolved data-quality problem.'} One email or call settles it. Until it is settled, this plan does not depend on it.`,
      doneBy: 'the person',
      confirmedBy: blocked.program.provider,
      confirmationQuestion: 'Is this program currently running, is it accepting applications, and what are the current eligibility requirements?',
      why: 'A directory would list this program and a person could lose a week on it. Naming the uncertainty is more useful than hiding or deleting the listing.',
      sourceQuotes: blocked.program.data_quality_flags
        .map((f) => f.source_quote)
        .filter((q): q is string => Boolean(q)),
      sourceUrls: [blocked.program.program_url],
      isConfirmationOnly: true,
    });
  }

  const cohort = option.nextCohort;
  push({
    dayWindow: formatDayWindow(6, 7),
    title: 'Decide with the funding answer in hand, not before',
    detail: cohort
      ? `The next cohort of ${program.program_name} starts ${longDate(cohort.start_date)}, ${daysUntil(
          cohort.start_date,
        )} days out. That is enough time for a funding determination if it started on day one, and not enough if it starts later. Review what came back this week with a navigator and choose.`
      : `No cohort of ${program.program_name} has a published start date a person could still join. Review what came back this week with a navigator and choose between waiting for the next posting and a different program.`,
    doneBy: 'the person',
    confirmedBy: `${profile.handoffOwnerType} (the handoff owner named in the synthetic profile)`,
    confirmationQuestion: 'Given what the career center and the college said this week, which program and which cohort do we commit to?',
    why: 'The decision is the person\'s to make, with a navigator, once the unknowns are answered. This tool does not make it and does not recommend enrolling before funding is settled.',
    sourceQuotes: [],
    sourceUrls: [],
    isConfirmationOnly: false,
  });

  return steps;
}

/**
 * A collision is where two true facts about a person's week contradict each
 * other. They are the most useful thing this tool finds, because neither source
 * page can see the other.
 */
export function detectCollisions(
  barriers: BarrierAssessment[],
  option: PathwayOption | null,
  registry: ProgramRegistry,
): AccessCollision[] {
  const collisions: AccessCollision[] = [];
  if (!option) return collisions;

  const hasSchedule = barriers.some((b) => b.barrier === 'schedule');
  const help = option.program.in_person_help;
  const funding = registry.funding_paths.find((f) => option.program.funding_paths.includes(f.id));

  if (hasSchedule && help) {
    collisions.push({
      title: 'The class is built for evening students. The enrollment desk is not.',
      detail: `${option.program.provider_short} teaches this course online in the evening, which is exactly why it fits. But registration help runs ${help.hours}, and the career center that decides funding keeps business hours too. Every step that unblocks this pathway happens during the shift this person cannot leave.`,
      mitigation:
        'On the first call, ask for a callback window outside business hours, or whether intake and document submission can be completed by email or online. Ask before taking unpaid time off, not after.',
      sourceQuotes: [help.source_quote, funding?.determined_by_source_quote].filter(
        (q): q is string => Boolean(q),
      ),
    });
  }

  return collisions;
}

export function collectOpenQuestions(
  option: PathwayOption | null,
  registry: ProgramRegistry,
): string[] {
  const questions: string[] = [];
  if (!option) return questions;

  const funding = registry.funding_paths.find((f) => option.program.funding_paths.includes(f.id));
  if (funding) questions.push(...funding.unknowns);

  for (const flag of option.program.data_quality_flags) {
    if (flag.severity === 'confirm_before_relying' || flag.severity === 'incomplete') {
      questions.push(flag.note);
    }
  }

  if (option.program.exam_fee_included === false) {
    questions.push(
      `The certification exam is not included in the course fee for ${option.program.program_name}, and the exam price is not published here. Ask what it costs before budgeting.`,
    );
  }

  return questions;
}

export function buildPlan(profile: SyntheticProfile, registry: ProgramRegistry): SevenDayPlan {
  const barriers = detectBarriers(profile);
  const options = buildOptions(profile, barriers, registry);
  const recommendedOption = chooseRecommended(options, profile);
  const blockedOptions = options.filter((o) => o.blocking);

  return {
    profile,
    barriers,
    options,
    recommendedOption,
    steps: buildSteps(profile, recommendedOption, barriers, registry, blockedOptions),
    collisions: detectCollisions(barriers, recommendedOption, registry),
    openQuestions: collectOpenQuestions(recommendedOption, registry),
    generatedFor: profile.profileId,
  };
}

/** Every funding path attached to a program, in registry order. */
export function fundingPathsFor(program: Program, registry: ProgramRegistry): FundingPath[] {
  return registry.funding_paths.filter((f) => program.funding_paths.includes(f.id));
}

/**
 * The disclosures a connector is likely to already hold, and which door each one
 * opens. Nothing here is stored, transmitted, or used to decide anything. It only
 * changes which doors are highlighted, because a connector who knows someone is a
 * veteran should not have to read five funding paths to find the relevant one.
 */
export const DISCLOSURES: Disclosure[] = [
  { id: 'low_income', label: 'Money is tight, or they receive public assistance', opensPaths: ['WIOA-CAREERCENTER'] },
  { id: 'veteran', label: 'They are a veteran, or the spouse of one', opensPaths: ['WIOA-CAREERCENTER'] },
  { id: 'snap', label: 'They receive SNAP food assistance', opensPaths: ['SNAP-ET'] },
  { id: 'disability', label: 'A health condition or disability makes work harder', opensPaths: ['ADRS-VRS'] },
  { id: 'adult_ed', label: 'They are working on a GED, or are in adult education', opensPaths: ['JSCC-CAREERPATHWAYS'] },
];

export function contactLine(contact: Contact): string {
  return [contact.phone, contact.email, contact.address].filter(Boolean).join(' | ');
}

/** How long before a connector should re-check a program fact before repeating it. */
export const STALE_AFTER_DAYS = 30;

/**
 * The brief as plain text, for the way a connector actually passes things on:
 * a text message, a WhatsApp forward, an email to someone's mother. Deliberately
 * carries the limits and the read date, so the caveats travel with the facts
 * rather than being stripped off in the retelling.
 */
export function briefToText(
  brief: ConnectorBrief,
  profile: SyntheticProfile,
  registry: ProgramRegistry,
): string {
  const lines: string[] = [];
  const read = longDate(registry.registry_meta.fetched_at.slice(0, 10));

  lines.push(`WHAT I FOUND OUT (read ${read})`, '');

  for (const fact of brief.canSay) {
    lines.push(`- ${fact.label}: ${fact.value}`);
  }

  if (brief.handoffStep) {
    lines.push('', 'THE CALL TO MAKE');
    lines.push(brief.handoffStep.title);
    if (brief.handoffStep.contact) {
      lines.push(`${brief.handoffStep.contact.name}: ${contactLine(brief.handoffStep.contact)}`);
    }
    lines.push(`Ask exactly this: "${brief.handoffStep.confirmationQuestion}"`);
  }

  if (brief.fundingPaths.length > 0) {
    lines.push('', 'WAYS PEOPLE PAY FOR THIS');
    lines.push('These are doors to ask about. None of them is a promise, and each one is decided');
    lines.push('by the office named, not by me.');
    for (const path of brief.fundingPaths) {
      const who = path.who_it_is_for?.map((a) => a.group).join('; ');
      const phones = path.contacts.map((c) => `${c.name}: ${c.phone ?? ''}`.trim()).join(' | ');
      lines.push(
        `- ${path.name}${path.confidence === 'confirm_before_relying' ? ' (needs confirming)' : ''}: ${path.covers}.`,
      );
      if (who) lines.push(`  For: ${who}.`);
      lines.push(`  Decided by: ${path.determined_by}.`);
      if (phones) lines.push(`  Contact: ${phones}`);
    }
  }

  if (brief.coaching.length > 0) {
    lines.push('', 'HEADS UP');
    for (const note of brief.coaching) lines.push(`- ${note}`);
  }

  lines.push('', 'WHAT I CANNOT PROMISE');
  for (const caution of brief.cannotPromise) {
    lines.push(`- ${caution.claim} That is decided by ${caution.whoDecides}.`);
  }

  lines.push(
    '',
    `These details were read from public program pages on ${read} and can change without notice.`,
    'Nothing here confirms that anyone qualifies for anything. Please check with the program directly.',
    '',
    `(Prepared from a demonstration tool. The example situation, ${profile.profileId}, is fictional.)`,
  );

  return lines.join('\n');
}

/**
 * The connector brief.
 *
 * A connector's working capital is that people believe them. So this arranges the
 * same plan around one question: what can I say out loud right now, and what is
 * not mine to say? Everything in `canSay` carries the sentence it came from.
 * Everything in `cannotPromise` names the office that actually decides it.
 */
export function buildConnectorBrief(
  plan: SevenDayPlan,
  registry: ProgramRegistry,
): ConnectorBrief | null {
  const option = plan.recommendedOption;
  if (!option) return null;

  const program = option.program;
  const funding = registry.funding_paths.find((f) => program.funding_paths.includes(f.id));
  const cohort = option.nextCohort;

  const canSay: ConfidentFact[] = [
    {
      label: 'The program',
      value: `${program.provider} runs "${program.program_name}"${
        program.academy ? ` as part of its ${program.academy}` : ''
      }.`,
      sourceUrl: program.program_url,
    },
    {
      label: 'What it leads to',
      value: program.leads_to,
      sourceUrl: program.program_url,
    },
  ];

  if (typeof program.cost_usd === 'number') {
    canSay.push({
      label: 'The published price',
      value:
        program.cost_usd === 0
          ? 'Historically free to students.'
          : `$${program.cost_usd.toLocaleString()}, as published on the schedule.`,
      sourceQuote: program.cost_source_quote,
      sourceUrl: program.schedule_url ?? program.program_url,
    });
  }

  if (cohort) {
    canSay.push({
      label: 'When it meets',
      value: `${cohort.days}, ${cohort.time}, ${program.format.toLowerCase()}. The next published start is ${longDate(
        cohort.start_date,
      )}.`,
      sourceQuote: program.format_source_quote,
      sourceUrl: program.schedule_url ?? program.program_url,
    });
  }

  const entry = program.requirements.filter((r) => r.kind === 'eligibility' || r.kind === 'document');
  for (const requirement of entry) {
    canSay.push({
      label: 'What they will be asked for',
      value: requirement.label,
      sourceQuote: requirement.source_quote,
      sourceUrl: requirement.source_url,
    });
  }

  if (funding) {
    canSay.push({
      label: 'That help with the cost exists',
      value: `A ${funding.name} may cover ${funding.covers.toLowerCase()}. It is worth asking about.`,
      sourceQuote: funding.determined_by_source_quote,
      sourceUrl: funding.source_url,
    });
  }

  const cannotPromise: Caution[] = [
    {
      claim: 'That they will get a seat.',
      because: 'Enrollment and any late entry are the college\'s call, and cohorts fill.',
      whoDecides: program.contacts[0]?.name ?? program.provider,
      sourceUrl: program.program_url,
    },
  ];

  if (funding) {
    cannotPromise.push({
      claim: 'That the course will be paid for.',
      because: funding.determined_by_source_quote,
      whoDecides: funding.determined_by,
      sourceQuote: funding.determined_by_source_quote,
      sourceUrl: funding.source_url,
    });
    for (const unknown of funding.unknowns) {
      cannotPromise.push({
        claim: 'How quickly the funding answer comes back.',
        because: unknown,
        whoDecides: funding.contacts[0]?.name ?? funding.determined_by,
        sourceUrl: funding.source_url,
      });
    }
  }

  const conditional = program.requirements.filter((r) => r.conditional);
  for (const requirement of conditional) {
    // Requirement labels carry their condition inline ("X, only if Y"). Split it
    // so the claim reads as a sentence and the condition becomes the reason.
    const [what, condition] = requirement.label.split(/,\s*only if\s*/i);
    cannotPromise.push({
      claim: `Whether the ${what.trim()} applies to them.`,
      because: condition
        ? `It applies only if ${condition.trim()}, and which case someone falls into is settled at intake, not in advance.`
        : 'The requirement is conditional, and which case someone falls into is settled at intake.',
      whoDecides: program.contacts[0]?.name ?? program.provider,
      sourceQuote: requirement.source_quote,
      sourceUrl: requirement.source_url,
    });
  }

  const flagged = program.data_quality_flags.filter((f) => f.severity === 'confirm_before_relying');
  for (const flag of flagged) {
    cannotPromise.push({
      claim: 'The exact dates, until someone confirms them.',
      because: flag.note,
      whoDecides: program.contacts[0]?.name ?? program.provider,
      sourceQuote: flag.source_quote,
      sourceUrl: flag.source_url,
    });
  }

  const credibilityRisks: CredibilityRisk[] = plan.options
    .filter((o) => o.blocking)
    .map((o) => ({
      program: `${o.program.provider} - ${o.program.program_name}`,
      risk: o.blockingReason ?? 'This program has an unresolved data-quality problem.',
      whatToSayInstead:
        'If someone brings this program up, say you have heard of it and that you want to check whether it is still running before sending them. Then make the call yourself. Sending someone to a program that has closed costs you more than it costs the program.',
      sourceQuote: o.program.data_quality_flags[0]?.source_quote,
      sourceUrl: o.program.program_url,
    }));

  const coaching = plan.collisions.map((c) => `${c.title} ${c.mitigation}`);
  if (program.in_person_help) {
    coaching.push(
      `Tell them the enrollment office keeps ${program.in_person_help.hours}, so the call has to happen on a weekday. That is worth saying out loud before they plan around it.`,
    );
  }

  return {
    canSay,
    fundingPaths: fundingPathsFor(program, registry),
    cannotPromise,
    handoffStep: plan.steps[0] ?? null,
    coaching,
    credibilityRisks,
    readOn: registry.registry_meta.fetched_at,
    staleAfterDays: STALE_AFTER_DAYS,
  };
}
