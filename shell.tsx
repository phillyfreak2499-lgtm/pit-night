import { Link, useRouterState } from "@tanstack/react-router";
import { ClipboardCheck, Newspaper, Play, Radio, ScrollText, Swords, Trophy, Tv, Volume2, VolumeX, Warehouse, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { applyHulen, usePit } from "@/lib/pit/store";
import { startSync, useSyncStatus } from "@/lib/pit/sync";
import { setSoundMuted, soundMuted, subscribeSound } from "@/lib/pit/sound";
import { formatRemain, nextLock, PERIOD_OPENS, TextInput, useNow } from "./bits";
import { Tutorial } from "./tutorial";

const NAV = [
  { to: "/", label: "Titantron", icon: Tv },
  { to: "/map", label: "Pit Map", icon: Warehouse },
  { to: "/week", label: "Pit Week", icon: ClipboardCheck },
  { to: "/broadcast", label: "Fight Day", icon: Swords },
  { to: "/preview", label: "Preview", icon: Play },
  { to: "/damage", label: "Damage", icon: Wrench },
  { to: "/gazette", label: "Gazette", icon: Newspaper },
  { to: "/honors", label: "Honors", icon: Trophy },
  { to: "/rules", label: "Rules", icon: ScrollText },
  { to: "/desk", label: "Desk", icon: Radio },
] as const;

export function PitShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [ready, setReady] = useState(false);
  const [passOpen, setPassOpen] = useState(false);
  useEffect(() => {
    const open = () => setPassOpen(true);
    window.addEventListener("pit:open-clipboard", open);
    return () => window.removeEventListener("pit:open-clipboard", open);
  }, []);
  const [guide, setGuide] = useState(false);
  const tutorialSeen = usePit((s) => s.tutorialSeen);
  const dismissTutorial = usePit((s) => s.dismissTutorial);
  const showTutorial = usePit((s) => s.showTutorial);
  const muted = useSoundMuted();
  useEffect(() => {
    let live = true;
    void Promise.resolve(usePit.persist.rehydrate()).finally(() => {
      if (!live) return;
      const data = usePit.getState();
      if (data.stores.some((store) => store.id === "bryant")) usePit.setState(applyHulen(data));
      setReady(true);
      startSync();
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="min-h-screen text-fg">
      <div className="md:grid md:grid-cols-[13.5rem_1fr]">
        <aside className="hidden border-r border-line bg-deep md:sticky md:top-0 md:flex md:h-screen md:flex-col md:justify-between md:p-4">
          <div>
            <Brand />
            <nav className="mt-8 flex flex-col gap-1">
              {NAV.map((item) => (
                <NavLink key={item.to} to={item.to} label={item.label} icon={item.icon} />
              ))}
            </nav>
          </div>
          <PhaseBlock />
        </aside>
        <div className="min-w-0">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-deep/95 px-4 py-3 backdrop-blur md:px-6">
            <div className="md:hidden">
              <Brand compact />
            </div>
            <div className="hidden min-w-0 md:block">
              <ClockLine />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <SyncDot />
              <button
                type="button"
                data-testid="mute-sound"
                aria-pressed={muted}
                aria-label={muted ? "Unmute" : "Mute"}
                className="inline-flex min-h-11 min-w-11 items-center justify-center border border-line"
                onClick={() => setSoundMuted(!muted)}
              >
                {muted ? <VolumeX className="size-4" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
              </button>
              <button
                type="button"
                data-testid="how-to-play"
                className="min-h-11 border border-line px-2.5 font-display text-xs tracking-wide uppercase md:px-3 md:text-sm"
                onClick={() => {
                  showTutorial();
                  setGuide(true);
                }}
              >
                How to play
              </button>
              <button
                type="button"
                className="min-h-11 border border-line px-2.5 font-display text-xs tracking-wide uppercase md:px-3 md:text-sm"
                onClick={() => setPassOpen(true)}
              >
                Clipboard
              </button>
            </div>
          </header>
          <Flash />
          {ready ? (
            <main key={pathname} className="page-in px-4 pt-5 pb-28 md:px-6 md:pb-10">
              {children}
            </main>
          ) : (
            <Boot />
          )}
          <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-deep md:hidden">
            {NAV.filter((item) => ["/", "/map", "/week", "/broadcast", "/desk"].includes(item.to)).map((item) => (
              <NavLink key={item.to} to={item.to} label={item.label} icon={item.icon} compact />
            ))}
          </nav>
        </div>
      </div>
      {passOpen ? <PassSheet onClose={() => setPassOpen(false)} /> : null}
      {ready && (tutorialSeen !== true || guide) ? (
        <Tutorial
          onClose={() => {
            dismissTutorial();
            setGuide(false);
          }}
        />
      ) : null}
    </div>
  );
}

function useSoundMuted() {
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    setMuted(soundMuted());
    return subscribeSound(() => setMuted(soundMuted()));
  }, []);
  return muted;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="block">
      {compact ? (
        <p className="font-display text-xl leading-none tracking-wide text-fg">LEAGUE</p>
      ) : (
        <>
          <p className="font-display text-xs tracking-[0.22em] text-amber uppercase">The Waterman</p>
          <p className="mt-1 font-display text-xl leading-[0.9] tracking-wide text-fg">Battle Bot League</p>
        </>
      )}
    </Link>
  );
}

function NavLink({
  to,
  label,
  icon: Icon,
  compact = false,
}: {
  to: (typeof NAV)[number]["to"];
  label: string;
  icon: typeof Tv;
  compact?: boolean;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const active = to === "/" ? path === "/" : path.startsWith(to);
  return (
    <Link
      to={to}
      className={`flex min-h-11 items-center gap-2 px-2 text-sm ${active ? "text-amber" : "text-muted"} ${compact ? "flex-col justify-center gap-0.5 px-1 text-[0.65rem]" : ""}`}
    >
      <Icon className="size-4" aria-hidden />
      <span className={compact ? "" : "font-medium"}>{label}</span>
    </Link>
  );
}

function PhaseBlock() {
  const phase = usePit((s) => s.phase);
  const week = usePit((s) => s.week);
  const weeks = usePit((s) => s.weeks);
  const meta = weeks.find((w) => w.number === week);
  return (
    <div className="border border-line p-3">
      <p className="font-display text-xs tracking-[0.2em] text-muted uppercase">Week {week}</p>
      <p className="font-display text-xl leading-none">{meta?.name ?? "Season"}</p>
      <p className="mt-2 text-xs tracking-widest text-amber uppercase">{phaseLabel(phase)}</p>
    </div>
  );
}

function ClockLine() {
  const phase = usePit((s) => s.phase);
  const week = usePit((s) => s.week);
  const now = useNow();
  const beforeOpen = Boolean(now && now.getTime() < PERIOD_OPENS.getTime());
  const remain = now ? formatRemain((beforeOpen ? PERIOD_OPENS : nextLock(now)).getTime() - now.getTime()) : "—";
  return (
    <p className="truncate text-sm text-muted">
      Week {week} · {phaseLabel(phase)}
      {phase === "open" ? (beforeOpen ? ` · Opens Oct 25 ${remain}` : ` · Saturday lock ${remain}`) : ""}
    </p>
  );
}

function SyncDot() {
  const sync = useSyncStatus();
  const shared = sync.mode === "live" || sync.mode === "preview";
  const bad = sync.state === "error" || sync.state === "mismatch";
  const label =
    sync.mode === "starting"
      ? "Connecting"
      : !shared
        ? "This device only"
        : bad
          ? "Not syncing"
          : sync.state === "saving"
            ? "Saving"
            : "Live";
  const color = !shared || bad ? "bg-bad" : sync.state === "saving" || sync.mode === "starting" ? "bg-amber" : "bg-ok";
  return (
    <Link
      to="/desk"
      hash="sync"
      data-testid="sync-dot"
      title={sync.error || (shared ? "Every device sees the same season." : "Changes stay on this device until the league database is connected.")}
      className="inline-flex min-h-11 items-center gap-2 border border-line px-2.5 text-xs text-muted"
    >
      <span className={`size-2 rounded-full ${color}`} aria-hidden />
      <span className="hidden lg:inline">{label}</span>
      <span className="sr-only lg:hidden">{label}</span>
    </Link>
  );
}

function Flash() {
  const flash = usePit((s) => s.flash);
  if (!flash) return null;
  return <p className="border-b border-line bg-surface px-4 py-2 text-sm text-amber md:px-6">{flash}</p>;
}

function Boot() {
  const stores = usePit((s) => s.stores);
  return (
    <main className="px-4 py-8">
      <p className="font-display text-xs tracking-[0.28em] text-amber uppercase">The Waterman Group</p>
      <h1 className="mt-2 font-display text-4xl leading-[0.9] md:text-5xl">
        THE WATERMAN
        <span className="block">BATTLE BOT LEAGUE</span>
      </h1>
      <p className="mt-3 max-w-xl text-muted">Opening the league. Eleven store doors. No personal bots.</p>
      <ul className="mt-6 grid grid-cols-2 gap-2">
        {stores.map((store) => (
          <li key={store.id} className="border border-line bg-surface px-3 py-3 text-sm">
            {store.name}
          </li>
        ))}
      </ul>
    </main>
  );
}

function phaseLabel(phase: string) {
  if (phase === "open") return "Floor open";
  if (phase === "locked") return "Locked for Monday";
  if (phase === "fought") return "Monday card";
  if (phase === "inspected") return "Damage posted";
  return "Season closed";
}

function PassSheet({ onClose }: { onClose: () => void }) {
  const stores = usePit((s) => s.stores);
  const crew = usePit((s) => s.crew);
  const session = usePit((s) => s.session);
  const signPublic = usePit((s) => s.signPublic);
  const signCrew = usePit((s) => s.signCrew);
  const signCaptain = usePit((s) => s.signCaptain);
  const signCommissioner = usePit((s) => s.signCommissioner);
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "plano");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [bad, setBad] = useState(false);
  const [crewOpen, setCrewOpen] = useState<string | null>(null);
  const bayCrew = crew.filter((c) => c.storeId === storeId && c.role === "specialist");

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-deep/80 p-3 md:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto border border-line bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-xs tracking-[0.22em] text-amber uppercase">Clipboard</p>
            <h2 className="font-display text-3xl leading-none">Who is in the pit</h2>
          </div>
          <button type="button" className="min-h-11 px-3 text-sm text-muted" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="mt-3 text-sm text-muted">
          Signed in as {session.role}
          {session.storeId ? ` · ${session.storeId}` : ""}. Specialists can propose. Captains lock. The desk runs Monday.
        </p>
        <label className="mt-4 block text-sm text-muted">
          Store
          <select
            className="mt-1 min-h-11 w-full border border-line bg-deep px-3"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
          >
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </label>
        <form
          className="mt-4 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const store = stores.find((row) => row.id === storeId);
            if (store && store.passcode.toLowerCase() === code.trim().toLowerCase()) setCrewOpen(storeId);
            else setBad(true);
          }}
        >
          <p className="text-sm text-muted">Bay code · from your captain or the desk</p>
          <TextInput
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setBad(false);
            }}
            placeholder="4-digit bay code"
            inputMode="numeric"
            type="password"
            autoComplete="off"
            aria-label="Bay code"
          />
          {bad ? <p className="text-sm text-bad">That code does not open this bay.</p> : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="submit" className="min-h-11 border border-line font-display tracking-wide uppercase">
              I&apos;m pit crew
            </button>
            <button
              type="button"
              className="min-h-11 bg-amber font-display tracking-wide text-deep uppercase"
              onClick={() => {
                if (signCaptain(storeId, code)) onClose();
                else setBad(true);
              }}
            >
              I&apos;m the captain
            </button>
          </div>
        </form>
        {crewOpen === storeId ? (
          <div className="mt-3">
            <p className="text-sm text-muted">Who are you?</p>
            <div className="mt-2 flex flex-col gap-2">
              {bayCrew.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  className="min-h-11 border border-line px-3 text-left"
                  onClick={() => {
                    signCrew(storeId, member.id);
                    onClose();
                  }}
                >
                  {member.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <form
          className="mt-4 flex flex-col gap-2 border-t border-line pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (signCommissioner(pin)) onClose();
          }}
        >
          <p className="text-sm text-muted">Commissioner · house PIN</p>
          <TextInput
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            inputMode="numeric"
            type="password"
            placeholder="PIN"
            aria-label="Commissioner PIN"
          />
          <button type="submit" className="min-h-11 border border-line font-display tracking-wide uppercase">
            Open the desk
          </button>
        </form>
        <button
          type="button"
          className="mt-4 min-h-11 text-sm text-muted"
          onClick={() => {
            signPublic();
            onClose();
          }}
        >
          Sign out to the public side
        </button>
      </div>
    </div>
  );
}
