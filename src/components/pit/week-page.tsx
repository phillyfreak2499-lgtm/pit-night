import { submitDailySpark } from "@/lib/pit/sync";
import { Check, Clock, Flame, Lock, Package, Sparkles, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { buildCard } from "@/lib/pit/engine";
import { paintHex, usePit } from "@/lib/pit/store";
import {
  BOLTS,
  DAY_LABEL,
  DAY_ORDER,
  PROGRAM,
  STREAK_BADGE,
  TUNE_UP_BONUS,
  crateFor,
  dayDate,
  dayOpen,
  programWeek,
  type DayKey,
  type Job,
  type Spark,
  type TrainingWeek,
} from "@/lib/pit/training";
import type { PitData } from "@/lib/pit/types";
import { LOCKER, boltsOf, sparkStreak, weekProgress } from "@/lib/pit/week";
import { Btn, SectionLabel, TextInput, useNow } from "./bits";
import { BotPortrait, useBotLook } from "./bot-portrait";
import { StreakBadge } from "./streak-badge";

/** Ask the shell to open the Clipboard sign-in sheet. */
export function openClipboard() {
  window.dispatchEvent(new Event("pit:open-clipboard"));
}

function useMe() {
  const data = usePit();
  const { role, crewId, storeId } = data.session;
  const me = crewId ? data.crew.find((c) => c.id === crewId) : undefined;
  return { data, me, role, storeId: me?.storeId ?? storeId ?? null };
}

export function WeekPage() {
  const { data, me, role, storeId: myStore } = useMe();
  const boss = role === "commissioner";
  const current = Math.min(4, Math.max(1, data.week));
  const [weekPick, setWeekPick] = useState(current);
  const [viewStore, setViewStore] = useState<string>(myStore ?? data.stores[0]?.id ?? "plano");
  const plan = programWeek(weekPick) ?? PROGRAM[0]!;
  const storeId = boss ? viewStore : (myStore ?? null);
  const store = data.stores.find((s) => s.id === storeId);
  const captain = boss || (role === "captain" && myStore === storeId);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6" data-testid="pit-week">
      <header className="relative overflow-hidden border border-line bg-deep">
        <div className="hazard h-2" />
        <div className="flex flex-wrap items-end justify-between gap-4 px-4 py-5 md:px-6">
          <div className="max-w-2xl">
            <SectionLabel>Pit Week · Tuesday to Saturday</SectionLabel>
            <h1 className="glow-text mt-1 font-display text-5xl leading-none">
              Week {plan.week}: {plan.theme}
            </h1>
            <p className="mt-2 text-lg text-fg">{plan.tagline}</p>
            <p className="mt-1 text-xs tracking-wide text-muted uppercase">From {plan.source}</p>
          </div>
          <div className="flex gap-2">
            {PROGRAM.map((w) => (
              <button
                key={w.week}
                type="button"
                className={`min-h-11 min-w-11 border font-display text-lg ${w.week === weekPick ? "border-amber bg-amber text-deep" : "border-line text-muted hover:text-fg"}`}
                onClick={() => setWeekPick(w.week)}
                aria-label={`Week ${w.week}`}
              >
                {w.week}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-px border-t border-line bg-line text-sm sm:grid-cols-3">
          <HowCell icon={<Check size={16} />} title="Do the jobs" body={`Two a day: one culture, one skill. Write one line of proof. The captain gives the thumbs-up. Wednesday hides a Mystery Crate worth +${BOLTS.crate}.`} />
          <HowCell icon={<Sparkles size={16} />} title="Daily Spark" body={`Three quick questions a day. +${BOLTS.sparkCorrect} bolt per right answer. ${STREAK_BADGE} perfect in a row earns a flame on your name.`} />
          <HowCell
            icon={<Flame size={16} />}
            title="Full Tune-Up"
            body={`Every specialist finishes everything by Saturday close and the captain does CARE: +${TUNE_UP_BONUS} Power, Speed, Armor, and Heat for Monday.`}
          />
        </div>
      </header>

      {boss ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs tracking-widest text-muted uppercase">Desk view</span>
          <select className="min-h-11 border border-line bg-deep px-3" value={viewStore} onChange={(e) => setViewStore(e.target.value)} aria-label="Store">
            {data.stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {!store ? (
        <section className="flex flex-wrap items-center justify-between gap-3 border border-amber/60 bg-surface p-4">
          <div>
            <p className="font-display text-2xl leading-none">Sign in to do your jobs</p>
            <p className="mt-1 text-sm text-muted">Use the Clipboard: pick your store, enter the bay code, and pick your name.</p>
          </div>
          <Btn onClick={openClipboard}>Open the Clipboard</Btn>
        </section>
      ) : (
        <BayBanner data={data} storeId={store.id} week={plan.week} />
      )}

      <section className="grid gap-3 lg:grid-cols-5">
        {plan.days.map((d) => (
          <DayCard key={`${plan.week}-${d.day}`} plan={plan} day={d.day} />
        ))}
      </section>

      {store && captain ? <CaptainDesk data={data} storeId={store.id} plan={plan} /> : null}
      {store && role === "captain" && !boss ? <CareCard plan={plan} /> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <ShoutWall data={data} week={plan.week} />
        <PickEm data={data} />
      </div>

      <LeagueBoard data={data} week={plan.week} />
      {store ? <BoltLocker data={data} storeId={store.id} canBuy={captain} /> : null}
      {me ? null : <p className="text-center text-xs text-muted">Pit Week counts for the bay, not for one person. Names show on the wall and the titantron.</p>}
    </div>
  );
}

function HowCell({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-3 bg-surface p-3">
      <span className="mt-0.5 text-amber">{icon}</span>
      <span>
        <span className="block font-display tracking-wide uppercase">{title}</span>
        <span className="text-muted">{body}</span>
      </span>
    </div>
  );
}

function BayBanner({ data, storeId, week }: { data: PitData; storeId: string; week: number }) {
  const store = data.stores.find((s) => s.id === storeId)!;
  const prog = weekProgress(data, storeId, week);
  const bolts = boltsOf(data, storeId);
  const look = useBotLook(storeId);
  return (
    <section data-bot-hover className={`grid gap-4 border bg-surface p-4 md:grid-cols-[auto_1fr_auto] md:items-center ${prog.tuned ? "tuned-glow border-amber" : "border-line"}`}>
      <div className="h-24 w-44">
        <BotPortrait look={look} zoom={0.9} className="h-full w-full" />
      </div>
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-display text-3xl leading-none" style={{ color: paintHex(store.paint) }}>
            {store.name}
          </p>
          <p className="font-display text-xl">{prog.pct}%</p>
        </div>
        <div className="mt-2 h-3 w-full bg-deep">
          <div className="h-full transition-[width] duration-500" style={{ width: `${prog.pct}%`, background: prog.tuned ? "var(--color-amber)" : paintHex(store.paint) }} />
        </div>
        <p className="mt-2 text-sm text-muted">
          {prog.tuned ? (
            <span className="font-display tracking-wide text-amber uppercase">
              Full Tune-Up locked in · +{TUNE_UP_BONUS} all stats Monday
            </span>
          ) : (
            <>
              {prog.crew.filter((c) => c.complete).length} of {prog.crew.length} specialists finished · CARE {prog.careDone ? "done" : prog.carePending ? "waiting" : "not yet"}. Everyone has to finish
              to earn the Tune-Up.
            </>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2 md:flex-col md:items-end">
        <span className="bolt inline-grid h-10 min-w-10 place-items-center px-2 font-display text-lg text-deep">{bolts.balance}</span>
        <span className="text-xs tracking-widest text-muted uppercase">Bolts</span>
      </div>
    </section>
  );
}

function DayCard({ plan, day }: { plan: TrainingWeek; day: DayKey }) {
  const { data, me } = useMe();
  const now = useNow() ?? new Date();
  const d = plan.days.find((x) => x.day === day)!;
  const open = dayOpen(plan, day, now, data.trainingOpenAll);
  const date = dayDate(plan, day);
  const isToday = date.toDateString() === now.toDateString();
  const spark = me ? data.sparkLog.find((e) => e.id === `${plan.week}:${day}:${me.id}`) : undefined;
  return (
    <article className={`flex flex-col border bg-surface ${isToday ? "border-amber" : "border-line"} ${open ? "" : "opacity-70"}`}>
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <p className="font-display tracking-wide uppercase">{DAY_LABEL[day]}</p>
        <p className="text-xs text-muted">
          {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          {isToday ? <span className="ml-1 text-amber">· today</span> : null}
        </p>
      </div>
      {open ? (
        <div className="flex flex-1 flex-col gap-2 p-2">
          {d.jobs.map((job) => (
            <JobCard key={job.id} job={job} week={plan.week} />
          ))}
          {day === "wed" ? <JobCard job={crateFor(plan.week)} week={plan.week} /> : null}
          <SparkCard week={plan.week} day={day} questions={d.spark} done={spark} />
        </div>
      ) : (
        <div className="grid flex-1 place-items-center gap-1 p-6 text-center text-sm text-muted">
          <Lock size={20} />
          Opens {date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          {day === "wed" ? (
            <span className="mt-2 inline-flex items-center gap-1 text-xs tracking-widest text-spark uppercase">
              <Package size={14} aria-hidden /> Mystery Crate inside
            </span>
          ) : null}
        </div>
      )}
    </article>
  );
}

function JobCard({ job, week }: { job: Job; week: number }) {
  const { data, me } = useMe();
  const completeJob = usePit((s) => s.completeJob);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const entry = me ? data.jobLog.find((e) => e.id === `${week}:${job.id}:${me.id}`) : undefined;
  const crate = job.kind === "crate";
  const tag = job.kind === "culture" ? "Culture" : job.kind === "care" ? "CARE" : crate ? `Mystery Crate · +${BOLTS.crate} bolts` : "Skill";
  return (
    <div
      className={`border p-2 ${entry?.status === "approved" ? "border-ok/50 bg-ok/5" : entry ? "border-warn/50" : crate ? "crate-glow border-spark/70 bg-spark/5" : "border-line bg-deep"}`}
      data-testid={crate ? "mystery-crate" : undefined}
    >
      <button type="button" className="flex w-full items-start gap-2 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span
          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center border ${entry?.status === "approved" ? "border-ok bg-ok text-deep" : entry ? "border-warn text-warn" : "border-line"}`}
          aria-hidden
        >
          {entry?.status === "approved" ? <Check size={14} /> : entry ? <Clock size={12} /> : null}
        </span>
        <span className="min-w-0">
          <span className={`flex items-center gap-1 text-[10px] tracking-widest uppercase ${crate ? "text-spark" : job.kind === "culture" ? "text-amber" : "text-info"}`}>
            {crate ? <Package size={11} aria-hidden /> : null}
            {tag}
          </span>
          <span className="block font-display leading-tight">{job.title}</span>
        </span>
      </button>
      {open ? (
        <div className="mt-2 flex flex-col gap-2 text-sm">
          <p className="text-muted">{job.do}</p>
          {entry ? (
            <p className="border-l-2 border-line pl-2 text-xs text-muted">
              {entry.status === "approved" ? "Approved" : "Waiting on the captain"} · “{entry.note}”
            </p>
          ) : me ? (
            <>
              <label className="text-xs tracking-wide text-muted uppercase" htmlFor={`note-${job.id}`}>
                Proof: {job.proof}
              </label>
              <textarea
                id={`note-${job.id}`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={400}
                className="w-full border border-line bg-bg p-2 text-fg outline-none focus:border-amber"
              />
              <Btn
                onClick={() => {
                  completeJob(week, job.id, note);
                  setNote("");
                }}
                disabled={note.trim().length < 3}
              >
                Check it off
              </Btn>
            </>
          ) : (
            <button type="button" className="text-left text-xs text-amber" onClick={openClipboard}>
              Sign in to check this off →
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SparkCard({ week, day, questions, done }: { week: number; day: DayKey; questions: Spark[]; done?: { correct: number; total: number } }) {
  const { data, me } = useMe();
  const submitSpark = submitDailySpark;
  const streak = me ? sparkStreak(data, me.id) : null;
  const [playing, setPlaying] = useState(false);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);

  if (done) {
    return (
      <div className="flex items-center gap-2 border border-ok/50 bg-ok/5 p-2 text-sm">
        <Sparkles size={16} className="text-ok" />
        <span className="font-display tracking-wide uppercase">Spark</span>
        {streak && streak.current > 1 ? (
          <span className="inline-flex items-center gap-0.5 text-xs text-spark" title="Perfect Sparks in a row">
            <Flame size={12} aria-hidden />
            {streak.current}
          </span>
        ) : null}
        <span className="ml-auto text-muted">
          {done.correct}/{done.total}
        </span>
      </div>
    );
  }
  if (!playing) {
    return (
      <button
        type="button"
        className="spark-btn flex items-center gap-2 border border-amber/60 p-2 text-left text-sm"
        onClick={() => (me ? (setI(0), setPicked(null), setAnswers([]), setPlaying(true)) : openClipboard())}
      >
        <Sparkles size={16} className="text-amber" />
        <span className="font-display tracking-wide uppercase">Daily Spark</span>
        <span className="ml-auto text-xs text-muted">3 questions</span>
      </button>
    );
  }
  const q = questions[i]!;
  const last = i === questions.length - 1;
  return (
    <div className="border border-amber bg-deep p-2 text-sm" role="group" aria-label="Daily Spark">
      <p className="text-[10px] tracking-widest text-amber uppercase">
        Spark {i + 1} of {questions.length}
      </p>
      <p className="mt-1 font-display leading-tight">{q.q}</p>
      <div className="mt-2 flex flex-col gap-1">
        {q.choices.map((c, k) => {
          const show = picked !== null;
          const right = k === q.answer;
          return (
            <button
              key={c}
              type="button"
              disabled={show}
              className={`min-h-11 border px-2 py-1 text-left ${show ? (right ? "border-ok bg-ok/15 text-ok" : k === picked ? "border-bad bg-bad/10 text-bad" : "border-line text-muted") : "border-line hover:border-amber"}`}
              onClick={() => {
                setPicked(k);
                setAnswers((a) => [...a, k]);
              }}
            >
              {c}
            </button>
          );
        })}
      </div>
      {picked !== null ? (
        <div className="mt-2">
          <p className="text-xs text-muted">{q.why}</p>
          <Btn
            className="mt-2 w-full"
            onClick={() => {
              if (last) {
                submitSpark(week, day, answers);
                setPlaying(false);
              } else {
                setI((n) => n + 1);
                setPicked(null);
              }
            }}
          >
            {last ? "Finish" : "Next"}
          </Btn>
        </div>
      ) : null}
    </div>
  );
}

function CareCard({ plan }: { plan: TrainingWeek }) {
  return (
    <section className="border border-line bg-surface p-4">
      <SectionLabel>Captain&apos;s CARE job · counts toward the Tune-Up</SectionLabel>
      <div className="mt-2 max-w-xl">
        <JobCard job={plan.care} week={plan.week} />
      </div>
    </section>
  );
}

function CaptainDesk({ data, storeId, plan }: { data: PitData; storeId: string; plan: TrainingWeek }) {
  const approveJob = usePit((s) => s.approveJob);
  const rejectJob = usePit((s) => s.rejectJob);
  const setCrewOff = usePit((s) => s.setCrewOff);
  const pending = data.jobLog.filter((e) => e.storeId === storeId && e.week === plan.week && e.status === "pending");
  const prog = weekProgress(data, storeId, plan.week);
  const allSpecialists = data.crew.filter((c) => c.storeId === storeId && c.role === "specialist");
  const jobTitle = (id: string) => {
    const crate = crateFor(plan.week);
    if (id === crate.id) return `Mystery Crate: ${crate.title}`;
    return [...plan.days.flatMap((d) => d.jobs), plan.care].find((j) => j.id === id)?.title ?? id;
  };
  return (
    <section className="grid gap-4 border border-line bg-surface p-4 lg:grid-cols-2">
      <div>
        <SectionLabel>Thumbs-up queue · {pending.length}</SectionLabel>
        {pending.length === 0 ? <p className="mt-2 text-sm text-muted">Nothing waiting. When your crew checks off a job, it lands here.</p> : null}
        <ul className="mt-2 flex flex-col gap-2">
          {pending.map((e) => (
            <li key={e.id} className="border border-line bg-deep p-3">
              <p className="text-xs tracking-wide text-muted uppercase">
                {e.crewName} · {jobTitle(e.jobId)}
              </p>
              <p className="mt-1 text-sm">“{e.note}”</p>
              <div className="mt-2 flex gap-2">
                <Btn onClick={() => approveJob(e.id)}>Approve</Btn>
                <Btn tone="ghost" onClick={() => rejectJob(e.id)}>
                  Send back
                </Btn>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <SectionLabel>Crew this week</SectionLabel>
        <ul className="mt-2 flex flex-col gap-1">
          {allSpecialists.map((c) => {
            const off = (c.offWeeks ?? []).includes(plan.week);
            const p = prog.crew.find((x) => x.crew.id === c.id);
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-2 border border-line bg-deep px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {c.name}
                  <StreakBadge crewId={c.id} />
                </span>
                {off ? (
                  <span className="text-xs text-muted">off this week</span>
                ) : p ? (
                  <span className={`text-xs ${p.complete ? "text-ok" : "text-muted"}`}>
                    jobs {p.jobsDone}/{p.jobsTotal}
                    {p.jobsPending ? ` (+${p.jobsPending} waiting)` : ""} · sparks {p.sparksDone}/{p.sparksTotal}
                  </span>
                ) : null}
                <button type="button" className="min-h-9 border border-line px-2 text-xs text-muted hover:text-fg" onClick={() => setCrewOff(c.id, plan.week, !off)}>
                  {off ? "Count them" : "Off this week"}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-muted">Mark vacations and leave as off so they do not hold up the Tune-Up.</p>
      </div>
    </section>
  );
}

function ShoutWall({ data, week }: { data: PitData; week: number }) {
  const { me } = useMe();
  const postShout = usePit((s) => s.postShout);
  const [to, setTo] = useState("");
  const [text, setText] = useState("");
  const shouts = [...data.shouts].filter((s) => s.week === week).sort((a, b) => b.at - a.at);
  const storeName = (id: string) => data.stores.find((s) => s.id === id)?.name ?? id;
  const paint = (id: string) => paintHex(data.stores.find((s) => s.id === id)?.paint ?? "amber");
  return (
    <section className="border border-line bg-surface">
      <div className="border-b border-line px-4 py-3">
        <SectionLabel>Shout-out wall</SectionLabel>
        <p className="text-sm text-muted">Catch someone being Remarkable. Every store can see it.</p>
      </div>
      {me ? (
        <form
          className="flex flex-col gap-2 border-b border-line p-4"
          onSubmit={(e) => {
            e.preventDefault();
            postShout(to, text);
            setTo("");
            setText("");
          }}
        >
          <TextInput value={to} onChange={(e) => setTo(e.target.value)} placeholder="Who are you shouting out?" aria-label="Who" maxLength={60} />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What did they do?"
            aria-label="What they did"
            rows={2}
            maxLength={240}
            className="w-full border border-line bg-bg p-2 text-fg outline-none focus:border-amber"
          />
          <Btn type="submit" disabled={!to.trim() || !text.trim()}>
            Post shout-out
          </Btn>
        </form>
      ) : null}
      <ul className="max-h-96 overflow-auto">
        {shouts.length === 0 ? <li className="p-4 text-sm text-muted">No shout-outs yet this week. Be the first.</li> : null}
        {shouts.map((s) => (
          <li key={s.id} className="border-b border-line px-4 py-3 last:border-b-0">
            <p className="text-sm">
              <span className="font-display text-base">{s.to}</span> <span className="text-muted">from {s.fromName}</span>
              <StreakBadge crewId={s.fromCrewId} />
            </p>
            <p className="mt-1 text-sm">{s.text}</p>
            <p className="mt-1 text-[11px] tracking-widest uppercase" style={{ color: paint(s.storeId) }}>
              {storeName(s.storeId)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PickEm({ data }: { data: PitData }) {
  const { me } = useMe();
  const makePick = usePit((s) => s.makePick);
  const card = useMemo(() => buildCard(data).filter((b) => b.teamA.length === 1 && b.teamB.length === 1), [data]);
  const posted = data.bouts.filter((b) => b.week === data.week && b.result);
  const name = (id: string) => data.stores.find((s) => s.id === id)?.name ?? id;
  const myPick = (boutId: string) => (me ? data.picks.find((p) => p.id === `${boutId}:${me.id}`)?.pick : undefined);
  const open = data.phase === "open";
  return (
    <section className="border border-line bg-surface">
      <div className="border-b border-line px-4 py-3">
        <SectionLabel>Monday pick&apos;em · week {data.week}</SectionLabel>
        <p className="text-sm text-muted">
          Call Monday&apos;s winners. +{BOLTS.pickCorrect} bolts for every right call. Picks close when the bots lock Saturday.
        </p>
      </div>
      <ul>
        {card.map((b) => {
          const result = posted.find((p) => p.id === b.id)?.result;
          const mine = myPick(b.id);
          return (
            <li key={b.id} className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2 last:border-b-0">
              {[b.teamA[0]!, b.teamB[0]!].map((sid, k) => {
                const chosen = mine === sid;
                const won = result?.winnerIds.includes(sid);
                return (
                  <span key={sid} className="contents">
                    {k === 1 ? <span className="text-xs text-muted">vs</span> : null}
                    <button
                      type="button"
                      disabled={!open || !me}
                      className={`min-h-11 flex-1 border px-3 text-left font-display ${chosen ? "border-amber bg-amber/15 text-amber" : "border-line"} ${won ? "outline outline-2 outline-ok" : ""} disabled:cursor-default`}
                      onClick={() => makePick(b.id, sid)}
                    >
                      {name(sid)}
                      {won ? <span className="ml-1 text-xs text-ok">won</span> : null}
                    </button>
                  </span>
                );
              })}
            </li>
          );
        })}
      </ul>
      {!me ? (
        <button type="button" className="px-4 py-3 text-sm text-amber" onClick={openClipboard}>
          Sign in to make picks →
        </button>
      ) : null}
    </section>
  );
}

function LeagueBoard({ data, week }: { data: PitData; week: number }) {
  const rows = data.stores
    .map((s) => ({ store: s, prog: weekProgress(data, s.id, week), bolts: boltsOf(data, s.id).earned }))
    .sort((a, b) => b.prog.pct - a.prog.pct || b.bolts - a.bolts);
  return (
    <section className="border border-line bg-surface">
      <div className="border-b border-line px-4 py-3">
        <SectionLabel>League board · week {week}</SectionLabel>
        <p className="text-sm text-muted">Who is putting in the work. Tuned bays get the edge Monday.</p>
      </div>
      <ol className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ store, prog, bolts }, i) => (
          <li key={store.id} className="flex items-center gap-3 bg-surface px-4 py-3">
            <span className="w-5 font-display text-lg text-muted">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate font-display">{store.name}</span>
                {prog.tuned ? (
                  <span className="flex items-center gap-1 text-[11px] tracking-widest text-amber uppercase">
                    <Wrench size={12} /> Tuned
                  </span>
                ) : (
                  <span className="text-xs text-muted">{prog.pct}%</span>
                )}
              </span>
              <span className="mt-1 block h-1.5 bg-deep">
                <span className="block h-full" style={{ width: `${prog.pct}%`, background: paintHex(store.paint) }} />
              </span>
            </span>
            <span className="text-xs text-muted">{bolts}⚙</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function BoltLocker({ data, storeId, canBuy }: { data: PitData; storeId: string; canBuy: boolean }) {
  const buyLocker = usePit((s) => s.buyLocker);
  const setStyle = usePit((s) => s.setStyle);
  const setPaint = usePit((s) => s.setPaint);
  const store = data.stores.find((s) => s.id === storeId)!;
  const bot = data.bots.find((b) => b.storeId === storeId);
  const owned = new Set(store.unlocks ?? []);
  const bolts = boltsOf(data, storeId);
  return (
    <section className="border border-line bg-surface">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <SectionLabel>Bolt Locker</SectionLabel>
          <p className="text-sm text-muted">Bolts buy looks, not wins. Jobs +{BOLTS.job}, Spark answers +{BOLTS.sparkCorrect}, right picks +{BOLTS.pickCorrect}.</p>
        </div>
        <p className="font-display text-xl">
          {bolts.balance} <span className="text-sm text-muted">bolts</span>
        </p>
      </div>
      <ul className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
        {LOCKER.map((item) => {
          const have = owned.has(item.id);
          const equipped =
            item.kind === "walkout" ? bot?.style?.walkout === item.id : item.kind === "victory" ? bot?.style?.victory === item.id : store.paint === item.id.replace("paint-", "");
          return (
            <li key={item.id} className="flex flex-col gap-2 bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] tracking-widest text-muted uppercase">{item.kind === "walkout" ? "Walk-out" : item.kind === "victory" ? "Victory" : "Paint"}</p>
                  <p className="font-display text-lg leading-tight">{item.name}</p>
                </div>
                {item.hex ? <span className="h-8 w-8 border border-line" style={{ background: item.hex }} /> : null}
              </div>
              <p className="flex-1 text-sm text-muted">{item.blurb}</p>
              {have ? (
                canBuy ? (
                  <Btn
                    tone={equipped ? "line" : "amber"}
                    onClick={() => {
                      if (item.kind === "paint") setPaint(storeId, item.id.replace("paint-", ""));
                      else if (item.kind === "walkout") setStyle(storeId, { walkout: equipped ? undefined : item.id });
                      else setStyle(storeId, { victory: equipped ? undefined : item.id });
                    }}
                  >
                    {equipped ? (item.kind === "paint" ? "On the bot" : "Equipped · take off") : "Use it"}
                  </Btn>
                ) : (
                  <p className="text-xs text-ok">Owned{equipped ? " · on the bot" : ""}</p>
                )
              ) : (
                <Btn disabled={!canBuy || bolts.balance < item.price} onClick={() => buyLocker(storeId, item.id)}>
                  {item.price} bolts
                </Btn>
              )}
            </li>
          );
        })}
      </ul>
      {!canBuy ? <p className="px-4 py-3 text-xs text-muted">The captain spends the bolts.</p> : null}
    </section>
  );
}
