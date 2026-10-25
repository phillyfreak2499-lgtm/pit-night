-- Live play-by-play uses pit_claude_text with kind = 'live', one row per beat.
-- A ready row is still never rewritten. The index serves the daily generation
-- cap, which counts rows of that kind first claimed on a Chicago calendar day.
create index if not exists pit_claude_text_kind_created
  on pit_claude_text (kind, created_at);
