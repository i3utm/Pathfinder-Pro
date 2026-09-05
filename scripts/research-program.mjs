#!/usr/bin/env node
/**
 * Read one public program page and draft a registry entry from it.
 *
 * The five programs in this registry were read by hand on the morning of the
 * event. That does not scale, and "someone reads every page by hand forever" is
 * not an answer to how a connector network in a city of 99 neighborhoods gets
 * current information.
 *
 * So this is the same job, run as a tool. Claude reads the fetched page and
 * drafts the entry. The important part is what happens next: every source_quote
 * it produced is checked, mechanically, against the text that was actually
 * fetched. A quote that is not literally on the page fails the run. The model
 * is not trusted to be accurate; it is trusted to be checkable, and then it is
 * checked.
 *
 * The draft is written to research/ for a human to approve. Nothing here writes
 * to public/data/programs.json. A person still decides what a connector is
 * allowed to repeat.
 *
 * Usage:
 *   node scripts/research-program.mjs <url> [--id PROGRAM-ID]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { verifyQuotes } from './lib/verify-quotes.mjs';

const [, , url, ...rest] = process.argv;
if (!url) {
  console.error('Usage: node scripts/research-program.mjs <url> [--id PROGRAM-ID]');
  process.exit(2);
}
const idFlag = rest.indexOf('--id');
const suggestedId = idFlag >= 0 ? rest[idFlag + 1] : null;

/** Strip a page to readable text. Scripts and styles are noise the model would quote. */
function toText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|li|tr|h[1-6]|section)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

const PROMPT = `You are extracting one training program into a registry that community connectors
use to tell people what is true about it. A connector repeating something wrong spends
credibility they cannot get back, so this registry treats an unknown as a result, never as
a gap to fill in.

Return ONLY a JSON object, no prose around it, in this shape:

{
  "id": "SHORT-UPPERCASE-ID",
  "provider": "full legal name of the institution",
  "provider_short": "what a person would call it out loud",
  "program_name": "as published",
  "program_url": "the url given",
  "leads_to": "the kind of job this is for",
  "credential": "what the person ends up holding",
  "credential_source_quote": "verbatim sentence from the page, or null",
  "cost_usd": number or null,
  "cost_source_quote": "verbatim, or null",
  "cost_notes": ["anything about WHEN payment is due, which decides whether funding help is even possible"],
  "format": "online / in person / hybrid, as published",
  "format_source_quote": "verbatim, or null",
  "cohorts": [{"cohort_id":"","days":"","time":"","start_date":"YYYY-MM-DD","end_date":"YYYY-MM-DD or null","status":"upcoming|already_started|unknown","status_note":""}],
  "requirements": [{"id":"","kind":"eligibility|document|assessment|payment","label":"plain label","source_quote":"verbatim","conditional":true only if it applies to some applicants}],
  "contacts": [{"role":"","name":"","phone":"","email":"","address":"","url":""}],
  "data_quality_flags": [{"id":"","severity":"do_not_rely|confirm_before_relying|incomplete|minor","field":"","note":"what is wrong and why it matters to someone planning around it","source_quote":"verbatim if there is one"}],
  "plain": {
    "job_said_out_loud": "how you would name this job in a sentence, 2-4 words",
    "the_job_is": "a clause completing 'That is ...', in the plainest words possible",
    "what_you_get": "one sentence, plain",
    "translations": [{"page_says":"verbatim institutional sentence","you_say":"the same thing a person would actually understand"}]
  }
}

Hard rules:
- Every *_source_quote and every page_says MUST be text copied EXACTLY from the page below,
  character for character. It will be checked against the page automatically and the run
  fails if it is not there. Never paraphrase into a quote. If there is no sentence to quote,
  use null and raise a data_quality_flag instead.
- Never infer a cost, a date, or a requirement that is not stated. Missing means a flag with
  severity "incomplete".
- If the page contradicts itself, or looks abandoned (placeholder contact details, dates that
  end before they start), raise a flag with severity "do_not_rely" or "confirm_before_relying"
  and say exactly what conflicts.
- "you_say" lines must read at roughly a 6th grade level. Short words, short sentences, no
  institutional nouns.
${suggestedId ? `- Use the id "${suggestedId}".` : ''}

PAGE URL: ${url}

PAGE TEXT:
`;

function runClaude(input) {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', ['-p', '--model', 'claude-sonnet-5'], { stdio: ['pipe', 'pipe', 'inherit'] });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`claude exited ${code}`))));
    child.stdin.end(input);
  });
}

console.log(`Fetching ${url}`);
const response = await fetch(url, { headers: { 'user-agent': 'seven-day-pathway/research (Birmingham Impact Lab)' } });
if (!response.ok) {
  console.error(`Fetch failed: ${response.status} ${response.statusText}`);
  process.exit(1);
}
const pageText = toText(await response.text());
console.log(`Read ${pageText.length} characters of text. Asking Claude to draft the entry.`);

const raw = await runClaude(`${PROMPT}${pageText.slice(0, 60000)}`);
const jsonText = (raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, raw])[1].trim();

let entry;
try {
  entry = JSON.parse(jsonText);
} catch (error) {
  console.error(`Claude did not return parseable JSON: ${error.message}`);
  console.error(raw.slice(0, 2000));
  process.exit(1);
}

// Every quote, checked against the page it claims to come from. This is the
// whole point of the script: the model drafts, the machine verifies.
const { checked, failures } = verifyQuotes(entry, pageText);

console.log(`\nChecked ${checked.length} quote(s) against the fetched page.`);
for (const { label, quote, found } of checked) {
  console.log(`  ${found ? 'FOUND  ' : 'MISSING'} ${label}: "${quote.slice(0, 90)}${quote.length > 90 ? '...' : ''}"`);
}

mkdirSync('research', { recursive: true });
const outPath = `research/${entry.id ?? 'draft'}.json`;
writeFileSync(
  outPath,
  `${JSON.stringify(
    {
      ...entry,
      fetched_at: new Date().toISOString(),
      review_status: failures.length === 0 ? 'quotes_verified_pending_human_review' : 'rejected_unverifiable_quotes',
      unverified_quotes: failures,
    },
    null,
    2,
  )}\n`,
);

console.log(`\nDraft written to ${outPath}`);
if (failures.length > 0) {
  console.error(`\n${failures.length} quote(s) are not on the page. This draft is NOT usable. Do not merge it.`);
  process.exit(1);
}
console.log('All quotes verified against the source page.');
console.log('This is a DRAFT. A human reviews it before it reaches public/data/programs.json.');
