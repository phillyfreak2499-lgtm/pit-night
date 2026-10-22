-- One row per Monday import. job_key = season + league week + reporting-period end.
-- A retry finds the same row and resumes from its stage; a lease keeps two runs apart.
create table if not exists pit_monday_jobs (
  job_key text primary key,
  status text not null,
  stage text not null default 'claimed',
  staged text,
  query_ids text not null default '[]',
  report text,
  attempts integer not null default 1,
  lease_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The whole season document as it stood before each automated write, for recovery.
create table if not exists pit_season_snapshots (
  id text primary key,
  job_key text not null,
  step text not null,
  rev integer not null,
  doc text not null,
  created_at timestamptz not null default now()
);
create index if not exists pit_season_snapshots_job on pit_season_snapshots (job_key);
