import { useEffect, useState } from "react";
import { askRulebook, claudeHealth, getClaudeCopy, rulebookQuota, type CopyResult } from "@/lib/pit/claude-server";
import { usePit } from "@/lib/pit/store";
import { Btn, Panel, SectionLabel } from "./bits";

/** Stored Claude copy. Shows nothing until it is ready, so a dark booth never breaks a page. */
export function ClaudeCopy({
  kind,
  id,
  label,
  className = "",
}: {
  kind: "bout" | "recap" | "hype";
  id: string;
  label: string;
  className?: string;
}) {
  const [copy, setCopy] = useState<CopyResult | null>(null);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;
    const load = () =>
      getClaudeCopy({ data: { kind, id } })
        .then((res) => {
          if (!alive) return;
          setCopy(res);
          // Another viewer is writing it; check back a few times.
          if (res.status === "pending" && tries++ < 8) timer = setTimeout(load, 5000);
        })
        .catch(() => alive && setCopy({ status: "unavailable", reason: "" }));
    void load();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [kind, id]);

  if (!copy || copy.status === "unavailable") return null;
  return (
    <div className={`border-l-2 border-amber pl-3 ${className}`} data-testid={`claude-${kind}`}>
      <p className="text-[11px] tracking-[0.2em] text-amber uppercase">{label}</p>
      {copy.status === "pending" ? (
        <p className="mt-1 text-sm text-muted">The booth is writing it up…</p>
      ) : (
        copy.body.split(/\n\s*\n/).map((para, i) => (
          <p key={i} className="mt-1 text-sm leading-relaxed whitespace-pre-line">
            {para}
          </p>
        ))
      )}
    </div>
  );
}

/** Desk: prove the Claude key works with one tiny call through the site's server. */
export function ClaudeCheck() {
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="border border-line p-4" data-testid="claude-check">
      <SectionLabel>Claude booth</SectionLabel>
      <p className="mt-2 text-sm text-muted">
        Fight commentary, the weekly recap, matchup hype and the captains&apos; rulebook use Claude (Haiku). Check that the key reaches the server.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Btn
          tone="line"
          disabled={busy}
          testId="claude-health"
          onClick={async () => {
            setBusy(true);
            try {
              const h = await claudeHealth();
              setResult(h.ok ? `Claude is working: ${h.model} answered in ${h.ms} ms.` : `Claude check failed: ${h.message || "unexpected reply"}`);
            } catch (e) {
              setResult(e instanceof Error ? e.message : "Claude check failed.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Asking Claude…" : "Check Claude"}
        </Btn>
        {result ? <p className="text-sm" aria-live="polite">{result}</p> : null}
      </div>
    </section>
  );
}

/** Captains ask the rulebook. Answers come only from the Rules page and FAQ. */
export function RulebookQa() {
  const role = usePit((s) => s.session.role);
  const allowed = role === "captain" || role === "commissioner";
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{ q: string; a: string } | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!allowed) return;
    rulebookQuota()
      .then((q) => setLeft(q.left))
      .catch(() => setLeft(null));
  }, [allowed]);

  if (!allowed) {
    return (
      <Panel className="p-4">
        <SectionLabel>Ask the rulebook</SectionLabel>
        <p className="mt-2 text-sm text-muted">Captains can ask how scoring, locks or Tune-Ups work. Sign in as captain on the Clipboard.</p>
      </Panel>
    );
  }

  const ask = async () => {
    const q = question.trim();
    if (q.length < 3 || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await askRulebook({ data: { question: q } });
      setAnswer({ q, a: res.answer });
      setLeft(res.left);
      setQuestion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The rulebook helper is busy. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel className="p-4" >
      <SectionLabel>Ask the rulebook</SectionLabel>
      <p className="mt-2 text-sm text-muted">
        Answers come only from these rules and the FAQ. If they don&apos;t cover it, it says so. Ask the Desk for anything official.
      </p>
      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
      >
        <label className="sr-only" htmlFor="rulebook-question">
          Your rules question
        </label>
        <input
          id="rulebook-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={300}
          placeholder="How does the Full Tune-Up work?"
          className="min-h-11 w-full border border-line bg-deep px-3 outline-none focus:border-amber"
          data-testid="rulebook-question"
        />
        <Btn type="submit" disabled={busy || left === 0 || question.trim().length < 3} testId="rulebook-ask">
          {busy ? "Checking…" : "Ask"}
        </Btn>
      </form>
      {left !== null ? <p className="mt-2 text-xs text-muted">{left} questions left today.</p> : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-spark">
          {error}
        </p>
      ) : null}
      {answer ? (
        <div className="mt-3 border-l-2 border-amber pl-3" data-testid="rulebook-answer" aria-live="polite">
          <p className="text-xs text-muted">{answer.q}</p>
          <p className="mt-1 text-sm leading-relaxed">{answer.a}</p>
        </div>
      ) : null}
    </Panel>
  );
}
