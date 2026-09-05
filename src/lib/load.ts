import { parseCsv } from './csv';
import type { ProgramRegistry, SyntheticProfile } from '../types';

const base = import.meta.env.BASE_URL;

export async function loadProfiles(): Promise<SyntheticProfile[]> {
  const res = await fetch(`${base}data/economic-opportunity-profiles.csv`);
  if (!res.ok) throw new Error(`Could not load synthetic profiles (HTTP ${res.status})`);
  const rows = parseCsv(await res.text());

  return rows.map((row) => {
    if (row.is_synthetic !== 'true') {
      throw new Error(
        `Refusing to load profile ${row.profile_id}: every row in this dataset must carry is_synthetic=true.`,
      );
    }
    return {
      profileId: row.profile_id,
      pathway: row.pathway,
      currentState: row.current_state,
      goal: row.goal,
      constraint: row.constraint,
      opportunity: row.opportunity,
      requirement: row.requirement,
      nextSevenDayAction: row.next_seven_day_action,
      handoffOwnerType: row.handoff_owner_type,
      requiresHumanConfirmation: row.requires_human_confirmation === 'true',
      isSynthetic: true,
    };
  });
}

export async function loadRegistry(): Promise<ProgramRegistry> {
  const res = await fetch(`${base}data/programs.json`);
  if (!res.ok) throw new Error(`Could not load the program registry (HTTP ${res.status})`);
  return (await res.json()) as ProgramRegistry;
}
