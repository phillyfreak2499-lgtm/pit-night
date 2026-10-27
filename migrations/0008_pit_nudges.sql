-- Daily store reminders. Contact addresses stay server-side, never in the shared season.
create table if not exists pit_store_contacts (
  store_id text primary key,
  email text not null,
  updated_at timestamptz not null default now()
);

-- One row per store per Central calendar day: a retry finds the row and does not send again.
create table if not exists pit_nudge_log (
  day text not null,
  store_id text not null,
  status text not null,
  detail text,
  sent_at timestamptz not null default now(),
  primary key (day, store_id)
);

create table if not exists pit_nudge_settings (
  id text primary key,
  paused boolean not null default false
);
