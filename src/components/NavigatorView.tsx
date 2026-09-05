import type { ProgramRegistry, SyntheticProfile } from '../types';
import { detectBarriers } from '../lib/planner';

/**
 * The navigator view answers a different question from the plan view: not "what
 * should this person do" but "what keeps stopping everyone." It counts barriers
 * across the whole synthetic caseload and never shows an individual profile's
 * situation, which is what the brief asks for.
 */
export default function NavigatorView({
  profiles,
  registry,
}: {
  profiles: SyntheticProfile[];
  registry: ProgramRegistry;
}) {
  const tallies = new Map<string, { label: string; count: number; profileIds: string[] }>();

  for (const profile of profiles) {
    for (const barrier of detectBarriers(profile)) {
      const entry = tallies.get(barrier.barrier) ?? {
        label: barrier.barrierLabel,
        count: 0,
        profileIds: [],
      };
      entry.count += 1;
      entry.profileIds.push(profile.profileId);
      tallies.set(barrier.barrier, entry);
    }
  }

  const ranked = [...tallies.entries()].sort((a, b) => b[1].count - a[1].count);
  const total = profiles.length;
  const covered = profiles.filter((p) => p.pathway === registry.registry_meta.pathway).length;

  const docs = tallies.get('documentation');
  const cost = tallies.get('upfront_cost');

  return (
    <div className="navigator">
      <section>
        <h2>What keeps stopping people</h2>
        <p className="section-note">
          Counted across all {total} synthetic profiles. This view shows how often a barrier appears,
          never who has it. A navigator can read the pattern without opening anyone's file.
        </p>

        <ul className="tallies">
          {ranked.map(([kind, entry]) => (
            <li key={kind}>
              <div className="tally-head">
                <strong>{entry.label}</strong>
                <span className="tally-count">
                  {entry.count} of {total}
                </span>
              </div>
              <div className="bar">
                <div className="bar-fill" style={{ width: `${(entry.count / total) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="finding">
        <h3>The pattern worth acting on</h3>
        {docs && cost ? (
          <>
            <p>
              {docs.count} of the {total} profiles are blocked by <strong>a document, a certification,
              or a background check</strong>, and {cost.count} more are blocked by{' '}
              <strong>money needed before day one</strong>. None of them are blocked by ability, and
              none of them are blocked by a shortage of programs.
            </p>
            <p>
              That matters because the two are usually handled by different offices, in a fixed order,
              and the order is not obvious from any single program page. Jefferson State requires
              payment at the moment of enrollment, while the funding decision belongs to an Alabama
              Career Center. A person who follows a program page in good faith does the steps
              backwards and pays for the course themselves or misses the cohort.
            </p>
            <p className="finding-punchline">
              A workforce organization running this pathway could act on one thing: publish the funding
              conversation as step zero, before any program listing, and give people a written estimate
              of how long an eligibility determination takes. That number is not published anywhere we
              could find today.
            </p>
          </>
        ) : (
          <p>Not enough profiles loaded to report a pattern.</p>
        )}
      </section>

      <section className="coverage">
        <h3>Honest coverage</h3>
        <p>
          This project covers one pathway in depth: <strong>{registry.registry_meta.pathway}</strong>.
          That is {covered} of the {total} synthetic profiles. The other {total - covered} are
          visible in the picker and produce an explicit "not covered" result rather than a
          fabricated match. The registry holds {registry.programs.length} real programs from{' '}
          {new Set(registry.programs.map((p) => p.provider)).size} providers, read from public pages
          on {new Date(registry.registry_meta.fetched_at).toLocaleDateString('en-US', { dateStyle: 'long' })}.
        </p>
      </section>
    </div>
  );
}
