import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseCsv } from '../src/lib/csv.ts';
import {
  briefToText,
  buildConnectorBrief,
  buildPlan,
  DISCLOSURES,
  chooseRecommended,
  daysUntil,
  detectBarriers,
  goalAlignment,
  longDate,
  nextJoinableCohort,
} from '../src/lib/planner.ts';
import type { ProgramRegistry, SyntheticProfile } from '../src/types.ts';

const registry = JSON.parse(
  readFileSync(new URL('../public/data/programs.json', import.meta.url), 'utf8'),
) as ProgramRegistry;

const profiles = parseCsv(
  readFileSync(new URL('../public/data/economic-opportunity-profiles.csv', import.meta.url), 'utf8'),
).map(
  (row): SyntheticProfile => ({
    profileId: row.profile_id,
    pathway: row.pathway,
    currentState: row.current_state,
    goal: row.goal,
    constraint: row.constraint,
    opportunity: row.opportunity,
    requirement: row.requirement,
    nextSevenDayAction: row.next_seven_day_action,
    handoffOwnerType: row.handoff_owner_type,
    requiresHumanConfirmation: row.requires_human_confirmation === 'true',
    isSynthetic: true,
  }),
);

const byId = (id: string) => profiles.find((p) => p.profileId === id)!;

test('every synthetic profile row is labeled synthetic', () => {
  assert.equal(profiles.length, 6);
  for (const profile of profiles) {
    assert.equal(profile.isSynthetic, true);
    assert.equal(profile.requiresHumanConfirmation, true);
  }
});

test('the program registry is not labeled synthetic and carries a fetch timestamp', () => {
  assert.equal(registry.registry_meta.is_synthetic, false);
  assert.match(registry.registry_meta.fetched_at, /^2026-08-28T/);
  for (const program of registry.programs) {
    assert.ok(program.fetched_at, `${program.id} is missing fetched_at`);
    assert.ok(program.program_url.startsWith('https://'), `${program.id} needs a source URL`);
  }
});

test('every extracted requirement cites the sentence it came from', () => {
  for (const program of registry.programs) {
    for (const requirement of program.requirements) {
      assert.ok(
        requirement.source_quote && requirement.source_url,
        `${program.id}/${requirement.id} must carry a source quote and URL`,
      );
    }
  }
});

test('PROF-04 barriers come from the profile text, not from assumptions', () => {
  // PROF-04's constraint names only a schedule problem. Its requirement is a
  // "Basic computer literacy assessment", which is not a document or a check,
  // so the documentation rule correctly does not fire. The planner must not
  // invent a money barrier here either: the profile does not state one.
  const barriers = detectBarriers(byId('PROF-04')).map((b) => b.barrier);
  assert.deepEqual(barriers, ['schedule']);
});

test('cost is raised for PROF-04 as a question even though no money barrier was stated', () => {
  const plan = buildPlan(byId('PROF-04'), registry);
  const fundingStep = plan.steps[0];
  assert.match(fundingStep.title, /\$999/);
  assert.match(fundingStep.detail, /does not state a money problem/);
  assert.equal(fundingStep.order, 1, 'the funding question must still come first');
});

test('the recommended program is the one whose destination matches the stated goal', () => {
  // A+ starts sooner (Aug 31 vs Nov 3) and would win a date-first tiebreak,
  // but PROF-04 wants an IT support role, so goal alignment must come first.
  const plan = buildPlan(byId('PROF-04'), registry);
  assert.equal(plan.recommendedOption?.program.id, 'JSCC-ITHD');
  assert.ok(
    goalAlignment(byId('PROF-04'), plan.recommendedOption!.program) >
      goalAlignment(byId('PROF-04'), registry.programs.find((p) => p.id === 'JSCC-APLUS')!),
  );
});

test('a transport constraint does not get misread as a schedule constraint', () => {
  // PROF-01 says "limited evening transit", which contains the word "evening".
  const barriers = detectBarriers(byId('PROF-01')).map((b) => b.barrier);
  assert.ok(barriers.includes('transport'));
  assert.ok(!barriers.includes('schedule'));
});

test('documentation is the most common barrier across the caseload', () => {
  const counts = new Map<string, number>();
  for (const profile of profiles) {
    for (const barrier of detectBarriers(profile)) {
      counts.set(barrier.barrier, (counts.get(barrier.barrier) ?? 0) + 1);
    }
  }
  assert.equal(counts.get('documentation'), 5);
  assert.equal(counts.get('upfront_cost'), 2);
});

test('a cohort that already started is not offered as joinable', () => {
  const helpDesk = registry.programs.find((p) => p.id === 'JSCC-ITHD')!;
  const next = nextJoinableCohort(helpDesk);
  assert.equal(next?.cohort_id, 'JSCC-ITHD-TT-NOV');
  assert.ok(daysUntil('2026-08-24') < 0);
});

test('a program flagged do_not_rely is never recommended', () => {
  const plan = buildPlan(byId('PROF-04'), registry);
  const innovate = plan.options.find((o) => o.program.id === 'INNOVATE-BHAM')!;
  assert.equal(innovate.blocking, true);
  assert.notEqual(plan.recommendedOption?.program.id, 'INNOVATE-BHAM');
  assert.equal(chooseRecommended([innovate], byId('PROF-04')), null);
});

test('the funding step comes before enrollment when money is a barrier', () => {
  // PROF-03 carries the upfront-cost barrier; the ordering rule must fire.
  const barriers = detectBarriers(byId('PROF-03')).map((b) => b.barrier);
  assert.ok(barriers.includes('upfront_cost'));
});

test('PROF-04 gets a plan whose every step names a human confirmer and a question', () => {
  const plan = buildPlan(byId('PROF-04'), registry);
  assert.ok(plan.steps.length >= 4, 'expected a multi-step plan');
  for (const step of plan.steps) {
    assert.ok(step.confirmedBy.length > 0, `step ${step.order} has no named confirmer`);
    assert.ok(step.confirmationQuestion.length > 0, `step ${step.order} has no question to ask`);
    assert.ok(step.why.length > 0, `step ${step.order} does not justify its position`);
  }
});

test('the last step hands the decision to the profile\'s named handoff owner', () => {
  const plan = buildPlan(byId('PROF-04'), registry);
  const last = plan.steps[plan.steps.length - 1];
  assert.match(last.confirmedBy, /training provider/);
});

test('the schedule collision between evening classes and a daytime office is detected', () => {
  const plan = buildPlan(byId('PROF-04'), registry);
  assert.equal(plan.collisions.length, 1);
  assert.match(plan.collisions[0].title, /enrollment desk/i);
});

test('a pathway the registry does not cover produces no options rather than a bad match', () => {
  const plan = buildPlan(byId('PROF-02'), registry);
  assert.equal(plan.options.length, 0);
  assert.equal(plan.steps.length, 0);
  assert.equal(plan.recommendedOption, null);
});

test('open questions are surfaced rather than filled in', () => {
  const plan = buildPlan(byId('PROF-04'), registry);
  assert.ok(plan.openQuestions.length > 0);
  assert.ok(
    plan.openQuestions.some((q) => /how long/i.test(q)),
    'the unknown determination time must be stated out loud',
  );
});

test('cohort dates render as calendar dates, not shifted by a timezone change', () => {
  // November 3 falls after CST resumes; formatting through a fixed -05:00
  // offset silently rendered it as November 2.
  assert.equal(longDate('2026-11-03'), 'November 3, 2026');
  assert.equal(longDate('2026-08-24'), 'August 24, 2026');
  assert.equal(longDate('2027-02-22'), 'February 22, 2027');
});

test('the connector brief separates what can be said from what cannot be promised', () => {
  const plan = buildPlan(byId('PROF-04'), registry);
  const brief = buildConnectorBrief(plan, registry)!;

  assert.ok(brief.canSay.length >= 5, 'a connector needs real facts to offer');
  for (const fact of brief.canSay) {
    assert.ok(fact.sourceUrl, `"${fact.label}" must be traceable to a page`);
  }

  assert.ok(brief.cannotPromise.length >= 3);
  for (const caution of brief.cannotPromise) {
    assert.ok(caution.whoDecides.length > 0, 'every caution must name the office that decides');
  }

  // Funding is the one a connector is most tempted to promise.
  assert.ok(brief.cannotPromise.some((c) => /paid for/i.test(c.claim)));
});

test('a program that could burn a connector is surfaced as a credibility risk', () => {
  const plan = buildPlan(byId('PROF-04'), registry);
  const brief = buildConnectorBrief(plan, registry)!;
  assert.equal(brief.credibilityRisks.length, 1);
  assert.match(brief.credibilityRisks[0].program, /Innovate Birmingham/);
  assert.match(brief.credibilityRisks[0].whatToSayInstead, /check whether it is still running/i);
});

test('an uncovered pathway produces no connector brief rather than a guess', () => {
  const plan = buildPlan(byId('PROF-02'), registry);
  assert.equal(buildConnectorBrief(plan, registry), null);
});

test('the shareable text carries the caveats along with the facts', () => {
  const plan = buildPlan(byId('PROF-04'), registry);
  const brief = buildConnectorBrief(plan, registry)!;
  const text = briefToText(brief, byId('PROF-04'), registry);

  assert.match(text, /WHAT I CANNOT PROMISE/);
  assert.match(text, /read August 28, 2026/);
  assert.match(text, /can change without notice/);
  assert.match(text, /fictional/i, 'the synthetic origin must survive the forward');
  assert.match(text, /\(205\) 582-5200/, 'the handoff number must be in the message');
  assert.ok(!text.includes('undefined'), 'no undefined leaking into a message a person sends');
});

test('a conditional requirement reads as a sentence, not a mangled label', () => {
  const plan = buildPlan(byId('PROF-04'), registry);
  const brief = buildConnectorBrief(plan, registry)!;
  const conditional = brief.cannotPromise.find((c) => /Accuplacer/i.test(c.claim))!;
  assert.equal(conditional.claim, 'Whether the Accuplacer Reading exam applies to them.');
  assert.match(conditional.because, /only if the applicant holds an occupational diploma/);
});

test('every funding path names who decides and carries a source', () => {
  assert.ok(registry.funding_paths.length >= 5, 'expected several routes, not just WIOA');
  for (const path of registry.funding_paths) {
    assert.ok(path.determined_by.length > 0, `${path.id} must name the deciding office`);
    assert.ok(path.source_url.startsWith('https://'), `${path.id} must cite a page`);
    assert.ok(path.unknowns.length > 0, `${path.id} must state what it does not answer`);
  }
});

test('funding paths that could not be fully verified say so', () => {
  const unconfirmed = registry.funding_paths.filter((p) => p.confidence === 'confirm_before_relying');
  assert.equal(unconfirmed.length, 2, 'Pathways to Prosperity and SNAP E&T were not fully verifiable');
  for (const path of unconfirmed) {
    assert.ok(
      path.provenance_note && path.provenance_note.length > 40,
      `${path.id} must explain how far the verification got`,
    );
  }
});

test('the ordering step still picks the path that declares the constraint', () => {
  // Jefferson State now carries five funding paths; the plan must not grab the
  // first one and lose the funding-before-enrollment rule.
  const plan = buildPlan(byId('PROF-04'), registry);
  assert.match(plan.steps[0].title, /\$999/);
  assert.match(plan.steps[0].why, /payment online at the time of enrollment/);
  assert.equal(plan.steps[0].contact?.name, 'Birmingham Career Center');
});

test('a disclosure opens a door without deciding anything', () => {
  const veteran = DISCLOSURES.find((d) => d.id === 'veteran')!;
  assert.deepEqual(veteran.opensPaths, ['WIOA-CAREERCENTER']);
  const disability = DISCLOSURES.find((d) => d.id === 'disability')!;
  assert.deepEqual(disability.opensPaths, ['ADRS-VRS']);
  // Every path a disclosure points at must actually exist in the registry.
  for (const d of DISCLOSURES) {
    for (const id of d.opensPaths) {
      assert.ok(
        registry.funding_paths.some((p) => p.id === id),
        `disclosure ${d.id} points at missing path ${id}`,
      );
    }
  }
});

test('the shareable text carries the funding doors and their deciding offices', () => {
  const plan = buildPlan(byId('PROF-04'), registry);
  const brief = buildConnectorBrief(plan, registry)!;
  const text = briefToText(brief, byId('PROF-04'), registry);

  assert.match(text, /WAYS PEOPLE PAY FOR THIS/);
  assert.match(text, /Pathways to Prosperity/);
  assert.match(text, /needs confirming/, 'unverified paths must be marked in the forwarded text');
  assert.match(text, /Decided by:/);
  assert.ok(!/you qualify|you are eligible/i.test(text), 'must never assert eligibility');
});
