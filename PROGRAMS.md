# Source ledger

Every real fact in this project traces to a public page read during the Lab on
August 28, 2026, between roughly 10:15 and 10:25 AM CDT. Nothing here was carried
in from earlier work, and nothing was recalled from memory.

The machine-readable version of this ledger is
[`public/data/programs.json`](public/data/programs.json), where each extracted
field carries the verbatim sentence it came from in a `source_quote` alongside
the `source_url` it was read from.

## Pages read

| Source | What was taken from it |
|---|---|
| [Jefferson State Fast Track and Workforce Education](https://www.jeffersonstate.edu/academics/fast-track/) | Entry requirements (age 18+, government ID and diploma/transcript/GED in English, Accuplacer for occupational diplomas), payment timing, the WIOA scholarship statement, Workforce Education phone, Birmingham Career Center phone, Ken King's on-site Career Center phone |
| [Fast Track IT Academy](https://www.jeffersonstate.edu/academics/fast-track/information-technology-academy/) | The list of IT Academy courses |
| [Fast Track class schedules and registration](https://www.jeffersonstate.edu/admissions/workforce-education-2/fast-track-course-information-registration/) | Cohort days, times, dates, delivery mode, and prices for IT Help Desk ($999), CompTIA A+ ($1,199), and Cyber Security ($1,200) |
| [Computer Technician with CompTIA A+ Certification Prep](https://www.jeffersonstate.edu/academics/fast-track/information-technology-academy/computer-technician-with-comptia-a-certification-prep/) | Course price, the credential statement, "Exams are not included in registration fee", registration office hours and both campus addresses |
| [Lawson State Office of Workforce Development](https://www.lawsonstate.edu/learn_at_lawson/workforce_development/default.aspx) | Existence of IT workforce training, the office phone, the Birmingham campus address, and the absence of published cost, dates, and requirements |
| [Innovate Birmingham](https://www.innovatebham.com/) | Current site state: a 2026 copyright, active calls to action, and unfilled placeholder contact details |
| [Central Six AlabamaWorks](https://centralsix.org/) | Regional workforce board contact, address, and the six counties served |
| [Career Karma: Innovate Birmingham](https://careerkarma.com/schools/innovate-birmingham/) | The historical 17-29 age range and the report that courses stopped in 2023. Recorded as an unverified third-party claim, never as program fact |

## Three problems found in the source data

These are recorded in the registry as `data_quality_flags` and surfaced in the
app rather than silently corrected. They are the reason this project exists: a
person following these pages in good faith would hit all three.

**1. A cohort that ends before it begins.** The Fast Track schedule lists the
Tuesday/Thursday IT Help Desk section as running "November 3, 2026 - February 11,
2026". The end date precedes the start date, so one of the two is wrong. The most
likely reading is February 11, 2027, but the registry stores `null` and flags it
rather than guessing, and the plan includes a call to confirm it.

**2. A program whose status cannot be determined.** Innovate Birmingham's site
carries a 2026 copyright and active "Get Started" and "Join Now" calls to action,
which reads as a live program. Its published phone number is `+1 (000) 123-4567`
and its email is an unfilled placeholder, which does not. A third-party review
site reports the program stopped offering courses in 2023. The registry does not
resolve this. It marks the program `do_not_rely`, keeps it visible, and routes
the plan to a program a person can actually start. Deleting the listing would
have been easier and less useful: a person who has heard of the program needs to
know why it is uncertain, not to have it quietly vanish.

**3. Cost, schedule, and requirements that are simply not published.** Lawson
State publishes that IT workforce training exists but not what it costs, when it
runs, or who can enter. The registry stores those as gaps and the app renders
them as "Cannot tell from the page" rather than filling them in.

## What is deliberately not here

- **No scraping.** Each page was fetched once, by hand, during the build window.
  There is no crawler and no repeated polling in this project.
- **No live data.** Everything carries a `fetched_at` stamp. Cost, schedule, and
  eligibility change without notice, and the app says so on every screen.
- **No eligibility determination.** Nothing in this project decides whether a
  person qualifies for a program or for funding. Those determinations belong to
  Jefferson State and to the Alabama Career Centers, and the plan names which one
  owns which question.

## Prior research, cited but not reused

[onecounty.thenewguard.ai](https://onecounty.thenewguard.ai) is a public artifact
mapping Jefferson County's 34 municipal governments, built before this event. It
is cited here as background the way a project would cite press coverage. No code
and no data from it appears anywhere in this repository.
