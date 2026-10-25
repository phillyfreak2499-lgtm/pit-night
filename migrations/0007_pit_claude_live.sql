-- Live play-by-play uses pit_claude_text with kind = 'live', one row per beat.
-- A ready row is still never rewritten. The daily cap counts rows of that kind
-- whose created_at falls in a Chicago calendar day:
--   created_at >= that midnight and created_at < the next midnight.
-- This (kind, created_at) index serves that range.
create index if not exists pit_claude_text_kind_created
  on pit_claude_text (kind, created_at);
