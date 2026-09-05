import { useState } from 'react';
import type { FundingPath, Program, ProgramRegistry } from '../types';
import { DISCLOSURES, contactLine, fundingPathsFor } from '../lib/planner';

/**
 * The funding doors.
 *
 * A connector hears "I cannot afford that" and needs more than one answer. This
 * lists every route to paying for the course that could be verified today, what
 * each one is for, and crucially who decides it.
 *
 * The disclosure filter is a conversation aid, not a form. Nothing is stored,
 * nothing is sent anywhere, and checking a box never means anyone qualifies. It
 * only moves the relevant doors to the top, because a connector who already knows
 * someone is a veteran should not have to read five funding paths to find the one
 * that matters.
 */
export default function FundingDoors({
  program,
  registry,
}: {
  program: Program;
  registry: ProgramRegistry;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const paths = fundingPathsFor(program, registry);
  if (paths.length === 0) return null;

  const openedIds = new Set(
    DISCLOSURES.filter((d) => selected.includes(d.id)).flatMap((d) => d.opensPaths),
  );

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const ordered = [...paths].sort((a, b) => {
    const rank = (p: FundingPath) => (openedIds.has(p.id) ? 0 : 1);
    return rank(a) - rank(b);
  });

  const cost = program.cost_usd;

  return (
    <section className="funding">
      <h3>Who might pay for this</h3>
      <p className="section-note">
        {typeof cost === 'number' && cost > 0
          ? `The course costs $${cost.toLocaleString()}. These are the routes to covering it that could be verified today. `
          : 'These are the routes to covering training costs that could be verified today. '}
        Every one of them is a door to knock on, not a benefit anyone here qualifies for. The office
        named on each card is the only one that can decide.
      </p>

      <div className="disclosure">
        <p className="disclosure-label">
          If they have told you any of this, it may open a door. Tick what applies.
        </p>
        <div className="disclosure-options">
          {DISCLOSURES.map((d) => (
            <label key={d.id} className={selected.includes(d.id) ? 'checked' : ''}>
              <input
                type="checkbox"
                checked={selected.includes(d.id)}
                onChange={() => toggle(d.id)}
              />
              {d.label}
            </label>
          ))}
        </div>
        <p className="disclosure-note">
          Nothing here is saved, sent, or recorded. This only reorders the cards below. It does not
          decide anything about anyone, and you should not write a person's circumstances down
          anywhere on their behalf.
        </p>
      </div>

      <div className="doors">
        {ordered.map((path) => {
          const highlighted = openedIds.has(path.id);
          return (
            <article
              key={path.id}
              className={`door${highlighted ? ' door-open' : ''}${
                path.confidence === 'confirm_before_relying' ? ' door-unconfirmed' : ''
              }`}
            >
              <header>
                <h4>{path.name}</h4>
                {highlighted && <span className="badge badge-open">Worth mentioning</span>}
                {path.confidence === 'confirm_before_relying' && (
                  <span className="badge badge-confirm">Confirm first</span>
                )}
              </header>

              <p className="door-covers">{path.covers}</p>

              {path.why_it_matters_here && <p className="door-why">{path.why_it_matters_here}</p>}

              {path.who_it_is_for && path.who_it_is_for.length > 0 && (
                <div className="door-for">
                  <p className="door-sublabel">Exists for</p>
                  <ul>
                    {path.who_it_is_for.map((audience) => (
                      <li key={audience.group}>
                        <strong>{audience.group}.</strong> {audience.why}
                        {audience.source_quote && (
                          <span className="quote"> "{audience.source_quote}"</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {path.conditions && path.conditions.length > 0 && (
                <div className="door-for">
                  <p className="door-sublabel">Conditions attached</p>
                  <ul>
                    {path.conditions.map((condition) => (
                      <li key={condition}>{condition}</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="door-decides">
                <strong>Who decides:</strong> {path.determined_by}
              </p>

              {path.how_to_start && (
                <p className="door-start">
                  <strong>How it starts:</strong> {path.how_to_start}
                </p>
              )}

              {path.contacts.length > 0 && (
                <ul className="door-contacts">
                  {path.contacts.map((contact) => (
                    <li key={`${contact.name}-${contact.role}`}>
                      <strong>{contact.name}</strong>
                      {contact.role ? `, ${contact.role}` : ''}
                      <span className="contact"> {contactLine(contact)}</span>
                    </li>
                  ))}
                </ul>
              )}

              {path.provenance_note && (
                <p className="door-provenance">
                  <strong>How well we verified this:</strong> {path.provenance_note}
                </p>
              )}

              {path.unknowns.length > 0 && (
                <details className="door-unknowns">
                  <summary>{path.unknowns.length} thing(s) this does not answer</summary>
                  <ul>
                    {path.unknowns.map((unknown) => (
                      <li key={unknown}>{unknown}</li>
                    ))}
                  </ul>
                </details>
              )}

              <p className="source">
                <a href={path.source_url} target="_blank" rel="noreferrer">
                  {path.source_url}
                </a>
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
