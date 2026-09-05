import { useEffect, useMemo, useState } from 'react';
import type { ProgramRegistry, SyntheticProfile } from './types';
import { loadProfiles, loadRegistry } from './lib/load';
import { buildConnectorBrief, buildPlan } from './lib/planner';
import HallwayView from './components/HallwayView';
import ConnectorView from './components/ConnectorView';
import PlanView from './components/PlanView';
import NavigatorView from './components/NavigatorView';
import './App.css';

/**
 * Demo presets live in the URL hash so each step of a demo is one clickable link.
 * `#PROF-04` is the connector brief; `#PROF-04/detail` is the full working-out
 * behind it; `#organizer` is the caseload view.
 */
type Section = 'hallway' | 'brief' | 'detail';

function readHash(): { view: string; section: Section } {
  const raw = window.location.hash.replace(/^#/, '') || 'PROF-04';
  const [view, section] = raw.split('/');
  const known: Section[] = ['hallway', 'brief', 'detail'];
  return {
    view: view || 'PROF-04',
    section: known.includes(section as Section) ? (section as Section) : 'hallway',
  };
}

export default function App() {
  const [profiles, setProfiles] = useState<SyntheticProfile[] | null>(null);
  const [registry, setRegistry] = useState<ProgramRegistry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState(readHash());

  useEffect(() => {
    Promise.all([loadProfiles(), loadRegistry()])
      .then(([p, r]) => {
        setProfiles(p);
        setRegistry(r);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    const onHash = () => setRoute(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const plan = useMemo(() => {
    if (!profiles || !registry || route.view === 'organizer') return null;
    const profile = profiles.find((p) => p.profileId === route.view) ?? profiles[0];
    return profile ? buildPlan(profile, registry) : null;
  }, [profiles, registry, route.view]);

  const brief = useMemo(
    () => (plan && registry ? buildConnectorBrief(plan, registry) : null),
    [plan, registry],
  );

  if (error) {
    return (
      <main className="shell">
        <div className="error">
          <h1>Could not load the data</h1>
          <p>{error}</p>
        </div>
      </main>
    );
  }

  if (!profiles || !registry) {
    return (
      <main className="shell">
        <p className="loading">Loading synthetic profiles and the program registry...</p>
      </main>
    );
  }

  const isOrganizer = route.view === 'organizer';

  return (
    <main className="shell">
      <header className="masthead">
        <div>
          <h1>Upskiller</h1>
          <p className="tagline">
            For the person everyone already asks. What you can say today about technology reskilling
            in Birmingham, what is not yours to promise, and who to hand them to.
          </p>
        </div>
        <div className="legend">
          <span className="badge badge-synthetic">Synthetic person</span>
          <span className="badge badge-real">
            Real program, read{' '}
            {new Date(registry.registry_meta.fetched_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>
      </header>

      <p className="standfirst">
        Birmingham has 99 neighborhood associations, each electing three officers. Those roughly 297
        people, plus every pastor, barber, and librarian who gets asked, are the connectors. They have
        the network already. What they do not have is current program information they can repeat
        without risking the trust that makes them useful. This tool does not decide anything. It hands
        a connector sourced facts, the limits of those facts, and a warm handoff.
      </p>

      <nav className="picker">
        {profiles.map((p) => (
          <a
            key={p.profileId}
            href={`#${p.profileId}`}
            className={route.view === p.profileId ? 'active' : ''}
            title={p.goal}
          >
            {p.profileId}
            <span className="picker-sub">{p.pathway}</span>
          </a>
        ))}
        <a href="#organizer" className={isOrganizer ? 'active nav-view' : 'nav-view'}>
          Organizer view
          <span className="picker-sub">all {profiles.length} profiles</span>
        </a>
      </nav>

      {isOrganizer ? (
        <NavigatorView profiles={profiles} registry={registry} />
      ) : plan ? (
        <>
          <nav className="subnav">
            <a href={`#${route.view}`} className={route.section === 'hallway' ? 'active' : ''}>
              In the hallway
            </a>
            <a href={`#${route.view}/brief`} className={route.section === 'brief' ? 'active' : ''}>
              The full brief
            </a>
            <a href={`#${route.view}/detail`} className={route.section === 'detail' ? 'active' : ''}>
              Show the working
            </a>
          </nav>
          {route.section === 'detail' ? (
            <PlanView plan={plan} />
          ) : route.section === 'brief' ? (
            <ConnectorView plan={plan} brief={brief} registry={registry} />
          ) : (
            <HallwayView plan={plan} registry={registry} />
          )}
        </>
      ) : null}

      <footer className="colophon">
        <p>
          <strong>Nothing here is a confirmation.</strong> {registry.registry_meta.confirmation_notice}
        </p>
        <p>
          <strong>How the registry was built.</strong> {registry.registry_meta.method}
        </p>
        <p>
          Built at the Birmingham Claude Impact Lab, August 28, 2026. Synthetic profiles come from the
          event's own dataset. Prior research on Jefferson County's 34 municipal governments is
          published separately at{' '}
          <a href="https://onecounty.thenewguard.ai" target="_blank" rel="noreferrer">
            onecounty.thenewguard.ai
          </a>{' '}
          and is cited here as background only; no code or data from it appears in this project.
        </p>
      </footer>
    </main>
  );
}
