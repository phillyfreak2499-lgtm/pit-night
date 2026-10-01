create table if not exists pit_credentials (
  id text primary key,
  hash text not null,
  generation integer not null default 1
);
create table if not exists pit_sessions (
  token_hash text primary key,
  credential_id text not null references pit_credentials(id),
  generation integer not null,
  identity text not null,
  expires_at timestamptz not null
);
create table if not exists pit_login_attempts (
  id text primary key,
  attempts integer not null,
  window_at timestamptz not null default now()
);
-- Remove publicly exposed legacy credentials while retaining the season and crews.
update pit_season set
  doc = jsonb_set(doc::jsonb - 'pin', '{stores}',
    coalesce((select jsonb_agg(store - 'passcode') from jsonb_array_elements(doc::jsonb->'stores') store), '[]'::jsonb))::text,
  rev = rev + 1,
  updated_at = now()
where doc::jsonb ? 'pin' or exists (
  select 1 from jsonb_array_elements(doc::jsonb->'stores') store where store ? 'passcode'
);
