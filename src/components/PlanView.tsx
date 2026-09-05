import type { BarrierAssessment, PathwayOption, SevenDayPlan } from '../types';
import { RECOMMENDATION_RULE, contactLine, daysUntil } from '../lib/planner';

const VERDICT_LABEL: Record<BarrierAssessment['verdict'], string> = {
  addresses: 'Addresses this',
  does_not_address: 'Does not solve this',
  unknown: 'Cannot tell from the page',
};

function SourceNote({ quote, url }: { quote?: string; url?: string }) {
  if (!quote && !url) return null;
  return (
    <p className="source">
      {quote && <span className="quote">"{quote}"</span>}
      {url && (
        <a href={url} target="_blank" rel="noreferrer">
          source
        </a>
      )}
    </p>
  );
}

function OptionCard({ option }: { option: PathwayOption }) {
  const { program } = option;
  return (
    <article className={`option ${option.blocking ? 'option-blocked' : ''}`}>
      <header>
        <h4>
          {program.program_name}
          <span className="provider">{program.provider}</span>
        </h4>
        <span className="badge badge-real">Real program</span>
      </header>

      {option.blocking && (
        <p className="blocked-note">
          <strong>Do not build your week around this one yet.</strong> {option.blockingReason}
        </p>
      )}

      <dl className="facts">
        <div>
          <dt>Cost</dt>
          <dd>
            {program.cost_usd === null
              ? 'Not published'
              : program.cost_usd === 0
                ? 'Historically free'
                : `$${program.cost_usd.toLocaleString()}`}
          </dd>
        </div>
        <div>
          <dt>Format</dt>
          <dd>{program.format}</dd>
        </div>
        <div>
          <dt>Next cohort</dt>
          <dd>
            {option.nextCohort
              ? `${option.nextCohort.start_date} (${daysUntil(option.nextCohort.start_date)} days), ${option.nextCohort.days}, ${option.nextCohort.time}`
              : 'None published'}
          </dd>
        </div>
        <div>
          <dt>Leads to</dt>
          <dd>{program.leads_to}</dd>
        </div>
      </dl>

      <p className="inclusion">{option.inclusionReason}</p>

      <ul className="assessments">
        {option.assessments.map((a) => (
          <li key={a.barrier} className={`verdict-${a.verdict}`}>
            <span className="verdict-tag">{VERDICT_LABEL[a.verdict]}</span>
            <strong>{a.barrierLabel}.</strong> {a.why}
            <SourceNote quote={a.sourceQuote} url={a.sourceUrl} />
          </li>
        ))}
      </ul>

      {program.data_quality_flags.length > 0 && (
        <details className="flags">
          <summary>{program.data_quality_flags.length} data-quality note(s) on this program</summary>
          {program.data_quality_flags.map((f) => (
            <div key={f.id} className={`flag flag-${f.severity}`}>
              <strong>{f.severity.replace(/_/g, ' ')}:</strong> {f.note}
              <SourceNote quote={f.source_quote} url={f.source_url} />
            </div>
          ))}
        </details>
      )}
    </article>
  );
}

export default function PlanView({ plan }: { plan: SevenDayPlan }) {
  const { profile } = plan;

  return (
    <div className="plan">
      <section className="profile-card">
        <header>
          <h2>{profile.profileId}</h2>
          <span className="badge badge-synthetic">Synthetic person, not real</span>
        </header>
        <p className="goal">{profile.goal}</p>
        <dl className="facts">
          <div>
            <dt>Situation</dt>
            <dd>{profile.currentState}</dd>
          </div>
          <div>
            <dt>Stated constraint</dt>
            <dd>{profile.constraint}</dd>
          </div>
          <div>
            <dt>Pathway</dt>
            <dd>{profile.pathway}</dd>
          </div>
          <div>
            <dt>Handoff owner</dt>
            <dd>{profile.handoffOwnerType}</dd>
          </div>
        </dl>
        <p className="synthetic-note">
          This profile is fictional, taken from the event's synthetic dataset with
          <code>is_synthetic=true</code> on every row. The programs it is matched against below are real
          and were read from public pages this morning.
        </p>
      </section>

      {plan.options.length === 0 ? (
        <section className="empty">
          <h3>No programs in this registry serve the "{profile.pathway}" pathway.</h3>
          <p>
            This project deliberately covers one pathway, technology reskilling, in depth rather than
            every pathway shallowly. Rather than invent a match, the planner says so. A navigator
            using this today would route this profile to a colleague who covers{' '}
            {profile.pathway}, and the named handoff owner for this profile is a{' '}
            <strong>{profile.handoffOwnerType}</strong>.
          </p>
        </section>
      ) : (
        <>
          <section>
            <h3>What stands in the way</h3>
            <p className="section-note">
              Read from the profile's own words. Each barrier names the phrase that triggered it.
            </p>
            <ul className="barriers">
              {plan.barriers.map((b) => (
                <li key={b.barrier}>
                  <strong>{b.barrierLabel}.</strong> {b.why}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3>Options</h3>
            <p className="section-note">
              {RECOMMENDATION_RULE}
              {plan.recommendedOption && (
                <>
                  {' '}
                  On that rule, the planner puts <strong>{plan.recommendedOption.program.program_name}</strong> first.
                </>
              )}
            </p>
            <div className="options">
              {plan.options.map((o) => (
                <OptionCard key={o.program.id} option={o} />
              ))}
            </div>
          </section>

          {plan.collisions.length > 0 && (
            <section className="collisions">
              <h3>What neither page can see on its own</h3>
              {plan.collisions.map((c) => (
                <div key={c.title} className="collision">
                  <h4>{c.title}</h4>
                  <p>{c.detail}</p>
                  <p className="mitigation">
                    <strong>What to do about it:</strong> {c.mitigation}
                  </p>
                  {c.sourceQuotes.map((q) => (
                    <p key={q} className="source">
                      <span className="quote">"{q}"</span>
                    </p>
                  ))}
                </div>
              ))}
            </section>
          )}

          <section>
            <h3>The next seven days</h3>
            <p className="section-note">
              Every step names the person who has to confirm it and the exact question to ask them.
              Nothing on this list is done by the software.
            </p>
            <ol className="steps">
              {plan.steps.map((step) => (
                <li key={step.order} className={step.isConfirmationOnly ? 'step step-confirm' : 'step'}>
                  <div className="step-head">
                    <span className="day">{step.dayWindow}</span>
                    <h4>{step.title}</h4>
                    {step.isConfirmationOnly && (
                      <span className="badge badge-confirm">Resolves an unknown</span>
                    )}
                  </div>
                  <p>{step.detail}</p>
                  <div className="gate">
                    <p>
                      <strong>A person confirms this:</strong> {step.confirmedBy}
                      {step.contact && <span className="contact"> {contactLine(step.contact)}</span>}
                    </p>
                    <p className="ask">
                      <strong>Ask exactly this:</strong> "{step.confirmationQuestion}"
                    </p>
                  </div>
                  <p className="why">
                    <strong>Why this order:</strong> {step.why}
                  </p>
                  {step.sourceQuotes.map((q) => (
                    <p key={q} className="source">
                      <span className="quote">"{q}"</span>
                    </p>
                  ))}
                  {step.sourceUrls.map((u) => (
                    <p key={u} className="source">
                      <a href={u} target="_blank" rel="noreferrer">
                        {u}
                      </a>
                    </p>
                  ))}
                </li>
              ))}
            </ol>
          </section>

          {plan.openQuestions.length > 0 && (
            <section className="open-questions">
              <h3>What this tool does not know</h3>
              <p className="section-note">
                These are unanswered on the public pages. They are listed rather than filled in with a
                plausible guess.
              </p>
              <ul>
                {plan.openQuestions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="csv-compare">
            <h3>What the synthetic dataset suggested, and what changed</h3>
            <p>
              The synthetic profile's own <code>next_seven_day_action</code> reads:{' '}
              <em>"{profile.nextSevenDayAction}"</em> with a handoff to a{' '}
              <strong>{profile.handoffOwnerType}</strong>.
            </p>
            <p>
              Matched against real Birmingham programs, that action is reasonable but incomplete: the
              training provider cannot answer the question that actually decides whether this pathway
              is affordable. That determination sits with an Alabama Career Center, and the college
              requires payment at the moment of enrollment. So the plan above starts one step earlier
              than the dataset does.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
