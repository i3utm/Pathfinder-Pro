/**
 * Checking a drafted entry against the page it claims to come from.
 *
 * A model that writes a plausible quote is more dangerous here than one that
 * writes nothing, because a quote is exactly what a connector would repeat as
 * proof. So no quote is taken on trust: each one has to appear, literally, in
 * the text that was fetched. This is the part of the research tool that makes
 * the rest of it usable.
 */

/** Whitespace and curly quotes differ between a page and a quote of it. Those are not errors. */
export function flatten(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .trim();
}

/** Every field in a drafted entry that claims to be quoting the source. */
export function quotesIn(entry) {
  const quotes = [];
  const add = (label, value) => {
    if (typeof value === 'string' && value.trim()) quotes.push({ label, quote: value });
  };
  add('credential_source_quote', entry.credential_source_quote);
  add('cost_source_quote', entry.cost_source_quote);
  add('format_source_quote', entry.format_source_quote);
  for (const requirement of entry.requirements ?? []) {
    add(`requirement:${requirement.id || requirement.kind}`, requirement.source_quote);
  }
  for (const flag of entry.data_quality_flags ?? []) {
    add(`flag:${flag.id || flag.field}`, flag.source_quote);
  }
  for (const translation of entry.plain?.translations ?? []) {
    add('plain:page_says', translation.page_says);
  }
  return quotes;
}

export function verifyQuotes(entry, pageText) {
  const haystack = flatten(pageText);
  const checked = quotesIn(entry).map((q) => ({ ...q, found: haystack.includes(flatten(q.quote)) }));
  return { checked, failures: checked.filter((q) => !q.found) };
}
