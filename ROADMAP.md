# Roadmap

Gap analysis of the shipped artifact against the Birmingham Opportunity Navigator
design brief, written at 12:55 on event day with the build window closing at 2:00.

The short version: **the trust layer is built and the reachability layer is not.**
Everything the brief says about provenance, explainability, refusing to invent, and
plain language is implemented and under test. Transportation, the three-recommendation
report, and the interview-confirmation loop are the real holes.

## Where the brief is already satisfied

| Brief | Status | Where |
|---|---|---|
| 1. Pruce as primary user | Built | The hallway flow is designed for the connector, not the resident |
| 12. Explainable ranking, not an LLM choosing | Built | `src/lib/planner.ts`. Named rules, printed in the UI so a user can disagree |
| 12. Deterministic scoring, AI for interpretation | Built | No model at runtime. The ranking rule is a readable function |
| 13. Barrier detection | Partial | 8 situation chips and keyword barrier detection over profile text |
| 14. Access optimisation, combining pieces | Partial | Funding doors plus the ordering constraint that funding precedes enrolment |
| 18. Mobile first, large targets, plain language | Built | Phone column, demo chrome stripped below 620px, reading level gated by test |
| 20. Trust and explainability | Built | Every value carries the sentence it came from; freshness date on every card |
| 20. Never invent programs, tuition, schedules | Built | Two of six programs produce no words at all, with the reason stated |
| 21. Privacy: collect only what is needed | Built | Nothing stored or transmitted; dictation's exception is disclosed on screen |
| 25. Administration, lightweight | Partial | `scripts/research-program.mjs` and `scripts/approve-program.mjs` are the admin surface |
| 31. Testing deterministic logic | Built | 62 tests. Ranking, staleness, missing data, fabricated-quote rejection |
| 32. Best reachable path, not best program | Partial | Honoured for money, schedule and device. Not yet for geography |

## What is missing, in the order it costs us

### 1. Mobility is not modelled at all (brief section 8)

The brief makes transportation a ranking input and says a program the person cannot
reach must not rank first. Today the registry has no coordinates, no campus-to-home
distance, no transit lookup, and no commute time. What exists is narrower: a `no_car`
chip, and reasoning about whether a program is delivered online.

That produced one real insight worth keeping - online delivery removes the transport
barrier and silently adds a device-and-home-internet barrier - but it is not the same
thing as knowing whether someone in Ensley can get to a Shelby County campus at 6pm.

**To close it:** add `latitude`, `longitude`, and `campus_address` to the program
schema; add an approximate start point (ZIP or neighbourhood, never a street address)
to the situation inputs; put a routing provider behind an adapter as the brief requires;
make travel time a ranking term. Non-trivial, because MAX Transit's published data is
the constraint, not the code.

### 2. One recommendation, not three (brief section 15)

`chooseRecommended` returns a single option. The brief asks for the three strongest,
each with fit, gain, time, cost, route, and next actions. The ranking already computes
an ordering, so surfacing the top three is small. Writing three honest "why this fits"
explanations without inventing anything is not.

### 3. No interview loop and no profile confirmation (brief sections 19 and 22)

The brief's flow is: record, extract a structured profile, **let Pruce correct it**,
then match. What exists is dictation into a notes box, keyword extraction into chips,
and chips that can be toggled. The chips are a thin version of "correct the extracted
profile" and the evidence line under each one is a thin version of explainability, but
there is no profile object, no missing-information prompts beyond two fixed questions,
and no confirmation step before recommendations.

### 4. Capability extraction is absent (brief section 6)

The brief's strongest single idea is unimplemented: hearing "I've been taking care of
my grandmother for three years" and surfacing caregiving, medication management, and
household management as transferable capability. Nothing in the app does this. It is
also the piece where a language model is clearly the right tool and where the
verification discipline would need the most care, because inflating someone's
qualifications is exactly the harm this project is organised against.

### 5. Resource model covers roughly half the fields (brief section 10)

Present: organisation, program name, credential, cost, format, cohorts, requirements,
contacts, funding paths, source, verification date, confidence, data-quality flags.

Absent: coordinates, program duration, application deadline, enrolment frequency,
supplies cost, stipends, transportation assistance, childcare assistance, income and
residency requirements, language requirements, background restrictions, application URL.

Several of those are absent because the source pages do not publish them, which the
registry already records as `incomplete` flags rather than gaps. That distinction
should survive any schema expansion.

### 6. Funding discovery is manual where program discovery is not

The five funding paths in the registry (WIOA, ACCS Pathways to Prosperity, Jeff State
Career Pathways, ADRS vocational rehab, SNAP E&T) were researched and entered by hand.
`scripts/research-program.mjs` drafts **programs** from a URL under quote verification,
but there is no equivalent for funding sources, so growing the funding side of the
registry is still artisanal.

Tested against a real case on event day: STRIVE Birmingham (strive.org, tuition-free
workforce training, a Birmingham site since 2023). The program researcher handled it,
8 of 8 quotes verified, draft at `research/STRIVE-BHAM.json`. What it caught is why the
verification layer matters for funding claims specifically: the "Free" on that page is
the page tagline, not a statement in the program description; the only published phone
number is the New York headquarters, not the Birmingham site; and no class dates are
published, only weekly info-session times. A connector repeating "it's free, call them"
off that page would be wrong twice before lunch.

**To close it:** a `research-funding.mjs` sibling that drafts a `FundingPath` (covers,
determined_by, conditions, contacts, ordering constraints) instead of a `Program`, with
the same quote gate and the same human approval, feeding the funding doors the way the
program pipeline feeds the switcher.

### 7. Not built: analytics (26), alternative pathway ladders (16), printable report (17)

## What should not change

The brief proposes Next.js, Postgres, and Supabase. This is Vite, React, and static
JSON on Cloudflare Workers, and brief section 30.4 says not to replace working
architecture without a concrete reason. There is no reason yet: there are no accounts,
no writes, and no server state. A backend becomes necessary at the point sessions are
saved or an admin UI replaces the two CLI scripts, and the adapter discipline the brief
asks for should be introduced then rather than pre-emptively.

The one exception worth doing early is the AI-provider adapter, because the research
script currently shells out to `claude -p` directly.

## Honest scoring against the brief's definition of success (section 27)

| Step | Today |
|---|---|
| Open on a phone, one button to start | Partial. There is no Start Interview screen; it opens on the hallway |
| Record a natural conversation | Partial. Dictation into a notes box, not an interview |
| Convert to a structured profile | Partial. Chips, not a profile object |
| Pruce corrects mistakes | Partial. Toggle chips |
| Identify goals, skills, resources, constraints | Partial. Constraints yes, skills no |
| Search Birmingham opportunities | Yes, six verified programs |
| Determine basic eligibility | Yes, and refuses to assert eligibility, which is correct |
| Evaluate transportation feasibility | **No** |
| Identify financial and accessibility resources | Yes, five funding routes with the deciding office named |
| Rank realistic opportunities | Yes, one rather than three |
| Explain why each fits | Yes |
| Show how to access it | Partial. Who to call and what to say; no route |
| Concrete next actions | Yes, with named confirmer and scripted question |
| Save, print or share a report | Partial. Copyable plain-text message, no print view |

## Decisions worth keeping

- **The model reads and drafts; the registry speaks.** A language model never writes
  the words a connector says to a person, because those words have to be traceable to a
  published sentence. It does the research, under mechanical verification.
- **A refusal is a feature.** Two of six programs produce no script. The brief's section
  20 asks that unverifiable information be labelled; going further and withholding the
  words entirely is what protects the connector's credibility.
- **An unknown is a result, not a gap to fill.** Carried through the registry, the
  planner's open questions, and the research tool's `incomplete` flags.
