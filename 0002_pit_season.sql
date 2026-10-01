-- One shared league season. Every device pulls and pushes this row.
create table if not exists pit_season (
  id text primary key,
  rev integer not null,
  doc text not null,
  updated_at timestamptz not null default now()
);
