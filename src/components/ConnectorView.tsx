import { useState } from 'react';
import type { ConnectorBrief, ProgramRegistry, SevenDayPlan } from '../types';
import { STALE_AFTER_DAYS, briefToText, contactLine } from '../lib/planner';
import FundingDoors from './FundingDoors';

function Receipt({ quote, url }: { quote?: string; url?: string }) {
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

/**
 * The connector's screen. Same plan, arranged around the question a trusted
 * person actually faces: what can I say out loud right now, and what is not
 * mine to say?
 */
export default function ConnectorView({
  plan,
  brief,
  registry,
}: {
  plan: SevenDayPlan;
  brief: ConnectorBrief | null;
  registry: ProgramRegistry;
}) {
  const { profile } = plan;
  const [copied, setCopied] = useState(false);

  const copyBrief = async () => {
    if (!brief) return;
    const text = briefToText(brief, profile, registry);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard access can be refused; show the text so it can be copied by hand.
      window.prompt('Copy this brief:', text);
    }
  };

  if (!brief) {
    return (
      <div className="connector">
        <section className="empty">
          <h3>You would not be the right person to answer this one.</h3>
          <p>
            This asks about <strong>{profile.pathway}</strong>, and this brief only covers technology
            reskilling. Rather than have you guess, the honest move is a referral: the handoff owner
            named for this situation is a <strong>{profile.handoffOwnerType}</strong>.
          </p>
          <p className="empty-note">
            Saying "that is not my area, but I know who to ask" protects the trust that makes you
            useful. This tool will not invent an answer to fill the silence.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="connector">
      <section className="moment">
        <p className="moment-label">The moment</p>
        <p className="moment-quote">
          Someone stops you after a meeting: <em>"{profile.goal}. What should they do?"</em>
        </p>
        <p className="moment-context">
          The person asking is fictional (<span className="badge badge-synthetic">synthetic</span>{' '}
          {profile.profileId}), and what they told you was:{' '}
          <em>{profile.currentState}. {profile.constraint}</em> Everything below about programs is
          real and was read on{' '}
          {new Date(brief.readOn).toLocaleDateString('en-US', { dateStyle: 'long' })}.
        </p>
      </section>

      <section className="share">
        <button type="button" onClick={copyBrief} className="share-button">
          {copied ? 'Copied' : 'Copy this to send them'}
        </button>
        <p className="share-note">
          Plain text for a message or an email. The read date and the limits travel with the
          facts, so the caveats do not get stripped off in the retelling.
        </p>
      </section>

      <section className="say">
        <h3>Say this. It is sourced.</h3>
        <p className="section-note">
          Each line was read off a public page today. The quote is there so you can show your work if
          anyone asks where you got it.
        </p>
        <ul className="fact-list">
          {brief.canSay.map((fact, i) => (
            <li key={`${fact.label}-${i}`}>
              <span className="fact-label">{fact.label}</span>
              <span className="fact-value">{fact.value}</span>
              <Receipt quote={fact.sourceQuote} url={fact.sourceUrl} />
            </li>
          ))}
        </ul>
      </section>

      <section className="dont">
        <h3>Do not promise this. It is not yours to promise.</h3>
        <p className="section-note">
          Every line names the office that actually decides it. Handing that decision to the right
          desk is the difference between a referral and a disappointment.
        </p>
        <ul className="caution-list">
          {brief.cannotPromise.map((caution, i) => (
            <li key={`${caution.claim}-${i}`}>
              <p className="caution-claim">{caution.claim}</p>
              <p className="caution-because">{caution.because}</p>
              <p className="caution-who">
                <strong>Who decides:</strong> {caution.whoDecides}
              </p>
              <Receipt quote={caution.sourceQuote} url={caution.sourceUrl} />
            </li>
          ))}
        </ul>
      </section>

      {brief.handoffStep && (
        <section className="handoff">
          <h3>Send them here, and give them the words</h3>
          <div className="handoff-card">
            <p className="handoff-title">{brief.handoffStep.title}</p>
            <p className="handoff-when">{brief.handoffStep.dayWindow}</p>
            {brief.handoffStep.contact && (
              <p className="handoff-contact">
                <strong>{brief.handoffStep.contact.name}</strong>
                <span className="contact"> {contactLine(brief.handoffStep.contact)}</span>
              </p>
            )}
            <div className="script">
              <p className="script-label">Tell them to ask exactly this</p>
              <p className="script-text">"{brief.handoffStep.confirmationQuestion}"</p>
            </div>
            <p className="why">
              <strong>Why this call and not another:</strong> {brief.handoffStep.why}
            </p>
          </div>
        </section>
      )}

      {plan.recommendedOption && (
        <FundingDoors program={plan.recommendedOption.program} registry={registry} />
      )}

      {brief.coaching.length > 0 && (
        <section className="coaching">
          <h3>Warn them about this before they go</h3>
          <ul>
            {brief.coaching.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      )}

      {brief.credibilityRisks.length > 0 && (
        <section className="credibility">
          <h3>This one could cost you</h3>
          <p className="section-note">
            Programs people have heard of that you should not vouch for today.
          </p>
          {brief.credibilityRisks.map((risk) => (
            <div key={risk.program} className="risk">
              <h4>{risk.program}</h4>
              <p>{risk.risk}</p>
              <p className="instead">
                <strong>What to say instead:</strong> {risk.whatToSayInstead}
              </p>
              <Receipt quote={risk.sourceQuote} url={risk.sourceUrl} />
            </div>
          ))}
        </section>
      )}

      <section className="freshness">
        <h3>Check this again before you repeat it</h3>
        <p>
          Everything above was read on{' '}
          <strong>{new Date(brief.readOn).toLocaleDateString('en-US', { dateStyle: 'long' })}</strong>.
          Prices, cohort dates, and requirements change without anyone announcing it. Treat this brief
          as stale after <strong>{STALE_AFTER_DAYS} days</strong> and re-check the two source pages
          before you tell someone else.
        </p>
        <p className="freshness-note">
          The reason this matters more for you than for a website: a page that goes out of date is
          just wrong. A person who goes out of date stops being the one people ask.
        </p>
      </section>
    </div>
  );
}
