-- Claude-written league copy. Generated once per key and never rewritten once ready,
-- so page views read stored text and a posted card keeps its original commentary.
-- Separate from pit_season: nothing here touches scorecards, locks or results.
create table if not exists pit_claude_text (
  kind text not null,
  key text not null,
  status text not null default 'pending',
  model text not null,
  body text,
  error text,
  attempts integer not null default 1,
  claimed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (kind, key)
);

-- Captain rules questions, kept for the daily cap.
create table if not exists pit_claude_questions (
  id text primary key,
  asker text not null,
  day text not null,
  question text not null,
  answer text,
  model text not null,
  created_at timestamptz not null default now()
);
create index if not exists pit_claude_questions_asker_day on pit_claude_questions (asker, day);
