# Upskiller (Team 3B, Pathfinders)

Product name: **Upskiller**. Repository and domain retain the working name
seven-day-pathway, after the plan at the core of the tool: no class starts within
seven days, but every step that decides whether a person ever starts happens in the
next seven.

**Birmingham Claude Impact Lab, August 28, 2026. Challenge 3: Make Economic Opportunity Easier to Reach.**

A briefing tool for Birmingham's community connectors: the people who already have
the network and already get asked. It turns public program pages into something a
connector can say out loud today, with the source attached, the limits stated, and a
warm handoff at the end.

**The tool does not decide anything.** It does not score people, predict who will
succeed, or assert that anyone is eligible for anything. Where the public pages do
not answer a question, it emits the question instead of a guess.

- **Live artifact:** https://sevenday.immatt.com
- **Demo starts here:** https://sevenday.immatt.com/#PROF-04
- **Source ledger:** [PROGRAMS.md](PROGRAMS.md)

## Team

- **Team name:** Pathfinders
- **Team ID:** 3B
- **Team members:** Matt Ezell

## Challenge and primary user

- **Challenge:** 3 - Make Economic Opportunity Easier to Reach
- **Primary user:** A community connector. Both the informal kind (a neighborhood
  association officer, a pastor, a barber, a librarian) and the staffed kind (a
  resource navigator or workforce staffer at a partner organization).

### The connector we designed for

Pruce is an illustrative persona, not a real individual and not part of the synthetic
dataset. He is late twenties to early thirties, born to the community he serves. He
went through leadership training and, unlike many of the people he grew up with, he
stayed, and he spends his time building up the people around him. He is loosely
attached to a larger community-minded organization.

Three things about Pruce set the design:

**His credibility is generational, not positional.** Nobody appointed Pruce. People
listen to him because they have known him their whole lives. When he vouches for a
program he is spending trust built over decades, on behalf of people he will see again
at church on Sunday. That is why "This one could cost you" is a headline section rather
than a footnote, and why a program whose status cannot be confirmed is shown and
explained rather than quietly dropped.

**He has the leadership training. He does not have the facts.** Pruce already knows how
to have the conversation. He does not need a tool that coaches him on how to talk to
people, and would rightly resent one. He needs to know what is true today. So the tool
supplies facts, sources, and limits, and stays entirely out of the human part.

**His scarce resource is ninety seconds, not information.** The conversation that
matters happens standing up, in a hallway after a meeting or on a sidewalk, with a phone
in one hand. Pruce is not going to sit down and read a directory. What fails him in that
moment is institutional language he has to translate live, out loud, without stalling.
So the tool builds him the words rather than the directory, and everything it produces
is sized for a thumb and a single breath.

His organizational attachment matters too: it means the organizer view has a real
audience. What Pruce learns across many conversations is exactly what his organization
needs in order to argue for something.

## Problem and repeated workflow

The repeated moment is **"someone just asked me what they should do."**

Birmingham already has a connector network, and a formal one. The city is divided into
23 communities and 99 neighborhoods, each neighborhood association electing a president,
vice president, and secretary: roughly 297 elected community connectors, a structure
running since 1974. The 23 community presidents form the Citizens Advisory Board, which
meets monthly with the mayor and council.

That network is under strain. [BirminghamWatch reported in February 2025](https://birminghamwatch.org/2025/02/21/birminghams-neighborhood-association-network-faces-challenges-at-50/)
that per-neighborhood funding was cut from $10,000 to $2,000 a year, city-funded
neighborhood newsletters were eliminated, and some association meetings now draw three
to five residents.

Strip a connector of budget and newsletters and what remains is their personal network
and their credibility. That is the asset this project is built to protect.

Because the connector's problem is not finding programs. It is answering with
confidence and without risk. Someone asks after a meeting. The connector half-remembers
a program, or repeats a flyer that is two years old. If they are right, someone's life
changes. If they are wrong, they have spent the one thing that makes them useful, and
the next person does not ask.

The facts that decide whether a pathway is reachable are spread across pages that
cannot see each other, so being right requires an hour of research the connector does
not have in the moment.

Three of those facts, all true at once, all on separate pages:

1. Jefferson State takes payment **at the moment of enrollment**.
2. The scholarship that would cover that payment is decided by an **Alabama Career
   Center**, not by the college.
3. Nobody publishes **how long that determination takes**.

A person who reads the program page in good faith and follows it does the steps in
the wrong order. They enroll and pay, or they ask about funding once the cohort has
opened and has run out of room. The pathway does not fail because the person was not
capable. It fails on sequencing.

## What the project does

### The hallway: translate, say it, hand it off

The primary screen is phone-shaped and has three beats, because that is the shape of the
moment it serves.

Across the top, a **program switcher**: the connector picks whichever thing the person
actually asked about. All five registry programs are reachable from it, including the
two that cannot be translated.

**1. Translate.** The program in plain speech: what it is, what you get, when it meets,
what it costs, what you need. Then *what usually stops people*, which is derived from the
registry rather than written by hand: a cohort that already started, payment due at
signup, an enrollment desk that keeps weekday hours, paperwork that takes longer than
anyone expects.

**2. Say it.** A script to read out loud, roughly 55 to 75 seconds, closing on exactly
one ask. The body lines carry no question marks, so the connector does not accidentally
open three threads at once. The script is scored with Flesch-Kincaid and **a test fails
the build if it exceeds a ninth-grade reading level** in any combination of inputs. It
currently lands around grade 2.5. That gate exists because the failure mode this project
is built against is prose drifting back into the institutional register.

**3. Hand it off.** A plain-text message to send before walking away, leading with the
funding call, because that ordering is what decides whether any of the rest works.

### The translation is data, and it is auditable

The plain speech is not generated at runtime. Each program carries a `plain` block in
the registry, and every plain sentence keeps the **verbatim published sentence it
replaces** beside it. Under *"Where these words came from"* the connector sees both:

> **The page says** ONLINE - LIVE INSTRUCTION
> **You say** You do it from home, but at a set time, with a teacher live on the screen.
> It is not something you click through on your own whenever you get a minute.

Same discipline as every other value in this project. You can see the source sentence
and judge whether the translation is fair before you repeat it. Thirteen of these pairs
across three programs, each pinned to the page it came from.

### It refuses two of the five programs

Two programs in the registry produce **no words at all**, on purpose:

- **Lawson State** publishes that it runs IT workforce training but publishes no cost,
  no cohort dates, and no entry requirements. There is nothing specific to say.
- **Innovate Birmingham** cannot be confirmed to be operating. Its site carries a 2026
  copyright and live "Join Now" calls to action, its published phone number is an
  unfilled template placeholder, and a third-party report says it stopped offering
  courses in 2023.

For both, the screen says *"I am not going to give you words for this one,"* gives the
reason, and gives the connector a sentence that is still useful:

> Say "Lawson State runs training in this and I do not know the details, let me get you
> the number." Then give them the number. Being the person who admits that is worth more
> than being the person who guessed.

They stay on the list because a directory would list them, someone would spend a week on
them, and the connector who sent them there would wear it. A test asserts that a program
flagged `do_not_rely` can never produce a script.

### Say it back to me

The connector does not tap eight chips while someone is standing in front of him. So the
screen opens with a box he can **speak or type** into. The **Speak** button dictates
straight into it, for the walk back to the car.

> kid wants to get into computers, works days at the warehouse, no car, mom says money is
> tight

That sets the program to IT Help Desk and lights three chips, and then it **shows its
work**: each chip quotes the part of his own note that produced it, windowed to the
matched phrase rather than the whole note.

> **Already working days** because you wrote "...get into computers, works days at the
> warehouse, no..."

Apostrophes are normalized away on both sides, because "aint got a ride" is what actually
gets typed with thumbs. It also names what
the notes did *not* settle, as questions rather than assumptions:

- Do they have a computer and internet at home that holds up for three hours?
- Has anyone talked to them about who pays for it?

When it recognizes nothing it says so, in those words, and tells him to tap the chips
instead. People do not talk in keywords, and a matcher that quietly returns nothing is
worse than one that admits it.

**Typing stays on the phone. Speaking does not, and the screen says so.** The matching
runs in the browser and transmits nothing. Dictation is different: the browser ships the
audio to a speech service to turn it into words, and for Chrome that service is Google's.
Everything else in this app touches no network, so that difference is disclosed in the
interface rather than left for the earlier promise to quietly cover. Either way the box
tells the connector to record what he heard, not who said it.

The seam is what gets tested. Dictation arrives as unpunctuated fragments with no
capitals, and a test asserts those still fold into one line and still match. It will also never route to one of the two programs the tool
refuses to vouch for, and a test enforces that.

Across the top sit optional **situation chips** (money is tight, no car, no computer,
works days, no diploma, on SNAP, veteran, has a disability). Tapping one changes what the
connector says next and which doors surface. Nothing is stored, nothing is sent, and
tapping a chip never means anyone qualifies for anything. The connector already holds
these facts from the conversation; the tool just stops making them translate on the fly.

One finding shaped this directly. Online delivery **solves** the transport barrier and
**silently creates** a device barrier: a phone will not carry a three-hour live session
twice a week, so the class quietly requires a computer and steady home internet. That
requirement appears on no program page. Tapping "no car" surfaces it.

### The brief: four questions

Behind the hallway, for when there is a table and time, the connector gets a brief built
around four questions:

- **Say this. It is sourced.** Facts read off a public page today, each with the
  verbatim quote attached so the connector can show their work.
- **Do not promise this. It is not yours to promise.** Every limit names the office
  that actually decides it, which turns a disappointment into a referral.
- **Send them here, and give them the words.** A named human, a phone number, and the
  exact question to ask, so the person arrives able to advocate for themselves.
- **This one could cost you.** Programs a connector has heard of but should not vouch
  for today, with what to say instead.

Plus **the funding doors**: every route to paying for the course that could be verified
today, each one naming the office that decides it. Two of the five could not be fully
verified this morning and say so on the card, with a note explaining exactly how far
verification got, rather than a fabricated quote.

Plus a freshness contract: the brief states the date it was read and declares itself
stale after 30 days, because a page that goes out of date is merely wrong while a
person who goes out of date stops being the one people ask.

Behind that, under "Show the working", the full analysis:

- **Barriers**, read from the profile's own words, each naming the phrase that
  triggered it so a navigator can check the reasoning by eye.
- **Options**: real Birmingham programs, each assessed against each barrier with a
  verdict of *addresses / does not solve / cannot tell from the page*, a plain-language
  reason, and the verbatim source sentence behind it.
- **Collisions**: places where two true facts contradict each other. For the anchor
  profile, the class is deliberately built for evening students while the enrollment
  desk and the funding office both keep weekday business hours, so every step that
  unblocks the pathway happens during the shift this person cannot leave.
- **A seven-day plan**: ordered steps, each with a real date, the named person who
  confirms it, and the exact question to ask them. Steps that require reaching an
  office are moved off weekends.
- **Open questions**: what the tool does not know, stated rather than filled in.
- **An organizer view**: barrier frequency across the whole synthetic caseload, showing
  the pattern without exposing any individual profile. This is the view a connector
  carries into a Citizens Advisory Board meeting or a partner conversation, where the
  question is not "what should this person do" but "what keeps stopping everyone".

### The finding

Across the six synthetic profiles, **five are blocked by a document, a certification,
or a background check**, and **two by money needed before day one**. None are blocked
by ability, and none by a shortage of programs. Those two barrier types are handled by
different offices in a fixed order, and that order is not discoverable from any single
program page.

## Data and evidence sources

**Synthetic (fictional, never presented as real):**

- `public/data/economic-opportunity-profiles.csv`, copied unmodified from the event hub
  (`Birmingham-AI/claude-impact-lab`). Six fictional profiles, every row carrying
  `is_synthetic=true`. The app refuses to load any row without that marker, and renders
  a "Synthetic person, not real" badge on every profile it displays. The anchor profile
  for the demo is PROF-04, technology reskilling.

**Real (public program pages, each read once during the build window):**

Full ledger with verbatim quotes in [PROGRAMS.md](PROGRAMS.md). In summary: Jefferson
State Community College Fast Track and its IT Academy (requirements, cohort schedules,
prices, registration office hours, contacts), Lawson State Office of Workforce
Development, Innovate Birmingham, Central Six AlabamaWorks, and one third-party review
site used only as an explicitly-labeled unverified claim.

**Prior research, cited but not reused:** [onecounty.thenewguard.ai](https://onecounty.thenewguard.ai),
a public artifact mapping Jefferson County's 34 municipal governments, built before this
event. Cited as background the way a project would cite press coverage. No code and no
data from it appears in this repository.

## Architecture or approach

Vite + React + TypeScript, static JSON, no backend, no database, no network calls at
runtime beyond loading its own two data files.

```
public/data/programs.json    the verified program registry
public/data/*.csv            the event's synthetic profiles, unmodified
src/types.ts                 domain types, synthetic and real kept separate
src/lib/planner.ts           the rule engine (barriers, options, ordering, collisions)
src/lib/hallway.ts           the three beats: plain card, script, handoff message
src/lib/listen.ts            free-text notes to chips, with the matched words shown
src/lib/voice.ts             dictation into the notes box, and what it costs in privacy
scripts/research-program.mjs draft a registry entry from a program URL
scripts/approve-program.mjs  human approval, re-verification, and the reading gate
scripts/lib/verify-quotes.mjs every drafted quote checked against the fetched page
research/                    drafts awaiting human review, never loaded by the app
src/lib/csv.ts               CSV reader
src/components/HallwayView   the phone-shaped primary screen
src/components/ConnectorView the four-question brief
src/components/FundingDoors  routes to paying for it, and who decides each
src/components/PlanView      per-profile plan, "show the working"
src/components/NavigatorView caseload aggregate
test/planner.test.ts         27 tests
test/hallway.test.ts         17 tests, including the reading-level gate
test/listen.test.ts          9 tests, including what it must refuse to route to
test/voice.test.ts           3 tests on the dictation seam
test/research.test.ts        6 tests, mostly on catching fabricated quotes
```

The planner is a set of named rules in one reviewable file. Each rule states its own
reasoning in plain language and cites its source. There is no model in the runtime, no
scoring function, and no ranking of people. The recommendation rule is printed in the
UI above the options so a user can disagree with it:

> Options blocked by a data-quality problem are set aside. Of the rest, prefer the
> program whose stated destination most closely matches the goal in the profile, then
> the one that addresses the most of the profile's stated barriers, then the one with
> the earliest cohort a person could still join.

### The research tool: Claude drafts, the machine verifies

Five programs read by hand does not scale, and "someone reads every page forever" is not
an answer for a connector network spanning 99 neighborhoods. So the same job runs as a
tool in the repo:

```bash
node scripts/research-program.mjs <program-url> [--id PROGRAM-ID]
```

It fetches the page, Claude drafts a registry entry from it, and then **every quote the
model produced is checked, character for character, against the text that was actually
fetched.** A quote that is not on the page fails the run and the draft is marked
`rejected_unverifiable_quotes`. The model is not trusted to be accurate. It is required to
be checkable, and then it is checked.

Nothing here writes to `public/data/programs.json`. Drafts land in `research/` marked
`quotes_verified_pending_human_review`, because a person still decides what a connector is
allowed to repeat. A second script does the approving, and it is the human-confirmation
point made executable:

```bash
node scripts/approve-program.mjs research/JSCC-DATA.json --i-reviewed-this \
  --funding WIOA-CAREERCENTER,ACCS-PATHWAYS
```

It refuses in four ways. Without `--i-reviewed-this` it prints a summary and stops, because
nobody has taken responsibility. It refuses a draft not marked quote-verified. It
**re-fetches the page and re-checks every quote**, so a hand-edited draft cannot smuggle a
fabricated quote past the first check and a page that changed since drafting is caught. And
it applies the app's own reading-level gate, rejecting any plain sentence above ninth
grade before it can reach a connector rather than after.

**It was run live during the build window** on a sixth program, Jefferson State's Data
Analytics: Power BI course. Nine of nine quotes verified, and it found a problem nobody
had looked for: **the same page names two different Microsoft certification exams for the
same course**, DA-100 in the introduction and PL-300 in the certification section, with no
indication which is current. Confirmed by hand afterward: each code appears exactly once
on the page. It also declined to state a tuition figure, because the page publishes none,
and raised five `incomplete` flags instead of filling the gaps. The draft is committed at
[research/JSCC-DATA.json](research/JSCC-DATA.json).

**The loop was then run end to end**, and it caught its own author twice. The first
approval attempt was rejected by the existing registry tests: the script had dropped the
`source_url` from every requirement, and had let through a plain sentence reading at grade
9.9. Both are now gates inside the approval script, so the next person hits them before the
merge rather than after. Approving then required rewriting two lines in the draft, which is
what human review is supposed to look like. JSCC-DATA is now the sixth program in the
registry, and it renders as a program the tool **refuses to give a connector words for**,
on the strength of the contradiction it found in its own source page.

The tests that matter here are the negative ones. `test/research.test.ts` feeds the
verifier fabricated quotes and asserts every one is caught, asserts that no field which
claims to quote a page escapes checking, and asserts that approval preserves every citation
a connector would later be shown as proof.

### How Claude was used to build it

- **Extraction with provenance.** Claude read each public program page and normalized it
  into the registry schema, carrying the verbatim source sentence into a `source_quote`
  field beside every extracted value. Any claim in the app can be audited back to the
  sentence that produced it. A test enforces that every requirement in the registry has
  both a quote and a URL.
- **Finding the contradictions.** The three data-quality problems in [PROGRAMS.md](PROGRAMS.md)
  (a cohort ending before it starts, a program whose operating status cannot be
  determined, and unpublished cost/schedule/requirements) surfaced during that reading
  and became features rather than corrections.
- **Building the planner and its tests**, then rendering the output and reading it
  critically. Two real defects were caught that way and fixed: the planner was ranking a
  CompTIA A+ course above an IT support course for someone who wants an IT support job,
  and it was scheduling phone calls to a weekday-only office on a Saturday.

### How Claude appears in the result

**Not in the words a connector says.** The deployed app is static and calls no model. The
plain speech, the script, and the funding routes all come from the registry, where each
one carries the published sentence it came from. For a tool whose entire value is that its
claims are auditable, generating fresh prose about a real person's eligibility at the
moment of use would undercut the whole thing.

**In building and maintaining the registry, under verification.** That is where the model
earns its place, and `scripts/research-program.mjs` is that work made repeatable: Claude
reads the page and drafts the entry, the script proves every quote against the source, and
a human approves before it reaches a connector.

The dividing line is the design: **the model reads and drafts, the registry speaks.**

## Working artifact

- **Live:** https://sevenday.immatt.com (demo preset: [#PROF-04](https://sevenday.immatt.com/#PROF-04))
- Each profile is a URL preset, so every step of the demo is one link.

Run locally:

```bash
git clone https://github.com/mattezell/seven-day-pathway
cd seven-day-pathway
npm install
npm run dev      # http://localhost:5173/#PROF-04
npm test         # 62 tests
npm run build
```

## What works today

- All six synthetic profiles load and render, with the `is_synthetic` marker enforced at
  load time and displayed in the UI.
- PROF-04 produces a complete six-step plan with real dates, real phone numbers, a named
  confirmer and a scripted question on every step.
- Five real programs assessed against each barrier with sourced reasoning.
- The business-hours collision is detected and explained.
- Programs flagged `do_not_rely` are shown, explained, and excluded from the
  recommendation.
- Profiles outside the covered pathway return an explicit "not covered" result and route
  to the profile's named handoff owner, instead of a fabricated match.
- The hallway flow runs end to end on a phone: a notes box he can speak or type into,
  three beats, eight situation chips, a copyable handoff message.
- Typed notes set the program and the chips, and every chip shows the words that produced
  it. Nothing is transmitted or stored.
- The script holds a grade 2.3 to 3.4 reading level across every combination of chips and
  every translatable program, enforced by test, and repeats no sentence when several
  chips are tapped at once.
- Three of the five programs translate; the other two refuse and say why, and the refusal
  is enforced by test rather than by hand.
- Five funding paths are listed with the deciding office named on each, and the two that
  could not be fully verified are labeled as such.
- The research tool runs end to end against a live page, verifies its own quotes, and
  found a contradiction in a sixth program during the build window.
- That sixth program was reviewed, approved through the gates, and is live in the registry,
  where it correctly refuses to produce words for a connector.
- 62 tests pass. Typecheck and lint clean.

## Known limitations and simulated elements

- **The people are fictional.** All six profiles come from the event's synthetic dataset.
  No real person is represented anywhere in this project. No real client data, no PII, no
  HMIS records.
- **The programs are real, but nothing here is a confirmation.** Every record is a
  snapshot read on the morning of August 28, 2026. Cost, schedule, cohort dates, and
  eligibility change without notice. Only the program can confirm that a specific person
  qualifies for a specific opening, and only a Career Center can determine WIOA
  eligibility.
- **One pathway, not five.** Technology reskilling covers 1 of the 6 synthetic profiles
  directly. The other five are visible and produce an honest "not covered" result. The
  navigator view's barrier counts span all six, since barrier detection reads the profile
  text and does not depend on the registry.
- **Six programs is a demonstration, not a census** of Birmingham IT training.
- **The seven-day window is a planning horizon, not a promise.** For the anchor profile
  the honest answer is that a class cannot start within seven days. What can finish in
  seven days is the funding conversation and the paperwork that make the November cohort
  reachable, which is what the plan says.
- **Barrier detection is keyword matching** over the profile text. It is deliberately
  simple so a navigator can audit it, and it will miss barriers phrased in ways the rules
  do not anticipate. It is a prompt for a human, not a substitute for one.
- **No writes to any live system.** Nothing is submitted, no ticket or referral or
  application is filed, and each source page was fetched once by hand.

## Next step toward a pilot

**Birmingham's Community Resource Services Division circulates one connector brief to
the 99 neighborhood associations, and collects what the officers get asked.**

The division already exists to be the liaison between neighborhood associations and city
government, already convenes these officers, and is reachable at (205) 297-8192. It does
not need to adopt software. It needs to hand its officers one page they can trust, and
tell us where it was wrong.

That is the pilot: one pathway, one printed brief, one cycle of the Citizens Advisory
Board's monthly meeting. The measure of success is not usage. It is whether an officer
says "I used this and it held up," or "I used this and it was out of date."

The unblocking ask that runs alongside it: **Central Six AlabamaWorks publishes how long
a WIOA eligibility determination currently takes.** That single unpublished number is
what makes the ordering problem invisible, and with it the brief's "start this
conversation today" becomes a real deadline. Central Six is at 205-458-8966 ext. 1350.

## Demo video

Not required; the artifact is reviewable at the public link above.
