import { useEffect, useState } from "react";
import { claudeHealth, mondayDryRun, mondayStatus } from "@/lib/pit/monday-server";
import { Btn, SectionLabel } from "./bits";

type Status = Awaited<ReturnType<typeof mondayStatus>>;

/** The Monday 5:00 a.m. job: setup checks, a no-write dry run, and the private reports. */
export function MondayPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [output, setOutput] = useState("");
  const [start, setStart] = useState("");

  const refresh = () =>
    mondayStatus()
      .then(setStatus)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not load the Monday job."));
  useEffect(() => {
    void refresh();
  }, []);

  const end = start ? new Date(Date.parse(`${start}T12:00:00Z`) + 6 * 86_400_000).toISOString().slice(0, 10) : "";
  const run = async (what: "dry" | "claude") => {
    setBusy(what);
    setOutput("");
    try {
      if (what === "dry") setOutput((await mondayDryRun({ data: { start, end } })).report);
      else {
        const h = await claudeHealth();
        setOutput(h.ok ? `Claude is working: ${h.model} answered in ${h.ms} ms.` : `Claude check failed: ${h.reply}`);
      }
      await refresh();
    } catch (e) {
      setOutput(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy("");
    }
  };

  const tick = (ok: boolean) => (ok ? "✔" : "✖");
  return (
    <section id="monday" className="border border-line p-4" data-testid="monday-panel">
      <SectionLabel>Monday 5:00 a.m. job</SectionLabel>
      {error ? <p className="mt-2 text-sm text-spark">{error}</p> : null}
      {status ? (
        <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          <li>{tick(status.enabled)} Writes {status.enabled ? "on" : "off (dry runs only)"}</li>
          <li>{tick(status.cronSecret)} Cron secret</li>
          <li>
            {tick(status.snowflake.ok)} Snowflake {status.snowflake.ok ? "configured" : `missing ${status.snowflake.missing.join(", ")}`}
          </li>
          <li>{tick(status.claudeKey)} Claude key reaches the server</li>
          <li className="sm:col-span-2 text-muted">Grading rules {status.ruleVersion}</li>
        </ul>
      ) : null}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-xs text-muted">
          Dry-run week (pick its Sunday)
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="min-h-11 border border-line bg-deep px-2 text-fg" />
        </label>
        <Btn tone="line" disabled={!start || busy !== ""} onClick={() => void run("dry")} testId="monday-dry-run">
          {busy === "dry" ? "Reading Snowflake…" : `Dry run ${start ? `${start} – ${end}` : ""}`}
        </Btn>
        <Btn tone="ghost" disabled={busy !== ""} onClick={() => void run("claude")} testId="claude-health">
          {busy === "claude" ? "Asking Claude…" : "Check Claude"}
        </Btn>
      </div>
      {output ? <pre className="mt-3 max-h-96 overflow-auto border border-line bg-deep p-3 text-xs whitespace-pre-wrap">{output}</pre> : null}
      {status?.reports.length ? (
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-xs tracking-widest text-muted uppercase">Recent runs</p>
          {status.reports.map((r) => (
            <details key={r.job_key} className="border border-line">
              <summary className="cursor-pointer px-3 py-2 text-sm">
                {r.job_key} · {r.status} · {r.stage} · {r.updated_at.slice(0, 16)} UTC
              </summary>
              <pre className="max-h-96 overflow-auto px-3 pb-3 text-xs whitespace-pre-wrap">{r.report ?? "(no report yet)"}</pre>
            </details>
          ))}
        </div>
      ) : null}
    </section>
  );
}
