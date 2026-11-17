import { useMemo, useRef, useState } from "react";
import { usePit } from "@/lib/pit/store";
import { takeLeagueSeason } from "@/lib/pit/sync";
import { showcaseDemo, type ShowcaseEventId, type ShowcaseTape } from "@/lib/pit/showcase-model";
import { openShowcaseEvent, previewShowcaseEvent, publishShowcaseEvent, saveShowcaseEntryOrder } from "@/lib/pit/showcase-server";
import { ShowcaseOperations } from "./showcase-operations";
import { ShowcaseArena } from "./showcase-arena";
import { ShowcaseTeamJanelleOpening } from "./showcase-team-janelle-opening";
import { prepareEventCommentary } from "@/lib/pit/event-commentary-server";
import { SHOWCASE_EVENTS } from "@/lib/pit/showcase-model";
import { celebrationCast } from "@/lib/pit/celebration-cast";
import { acceptShowcaseTape, showcaseFinishVisible, updateShowcaseClock } from "./playback-lifecycle";

const EVENTS: {id: ShowcaseEventId; title: string; eyebrow: string; detail: string; prize: string}[] = [
  {id:"striker-race", title:"Striker Stakes", eyebrow:"01 / RACE", detail:"Three laps on the oval. Strikers race for the finish.", prize:"Rocket Tail · +2 Speed when equipped for the Rumble"},
  {id:"tank-pull", title:"Iron Pull", eyebrow:"02 / TRACTOR PULL", detail:"Tanks haul a weighted sled as far as they can.", prize:"Battle Tank · +2 Armor when equipped for the Rumble"},
  {id:"specialist-rescue", title:"Reactor Rescue", eyebrow:"03 / RECOVERY", detail:"Specialists recover three energy cores through the gate course.", prize:"Tesla Rig · +2 Heat when equipped for the Rumble"},
  {id:"team-gauntlet", title:"Team Gauntlet", eyebrow:"04 / CREW EVENT", detail:"Scout the route, pull the barrier, return three cores, then power the exit and cross together. Fastest crew wins.", prize:"Winning crew earns Rumble entry slots 9–12"},
];

function PinGate() {
  const sign = usePit(s => s.signCommissioner); const [pin,setPin] = useState(""); const [error,setError] = useState("");
  return <section className="mx-auto max-w-lg border border-line bg-deep p-6"><p className="text-xs tracking-widest text-amber">DESK ACCESS</p><h1 className="mt-2 font-display text-4xl">Showcase rehearsal</h1><p className="mt-3 text-muted">Enter the Desk PIN to review rehearsal and prepared event tapes.</p><form className="mt-5" onSubmit={e => {e.preventDefault(); void sign(pin).then(ok => {if (!ok) setError("That Desk PIN did not open rehearsal."); setPin("");});}}><label htmlFor="showcase-pin" className="block text-xs tracking-widest">DESK PIN</label><input id="showcase-pin" className="mt-2 w-full border border-line bg-black p-3 text-white" type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={e => setPin(e.target.value)}/><button className="mt-3 min-h-11 bg-amber px-5 font-display text-black">UNLOCK REHEARSAL</button></form>{error && <p className="mt-3 text-sm text-red-400">{error}</p>}</section>;
}

function CommentaryWarmup() {
  const [busy,setBusy]=useState(false); const [message,setMessage]=useState("");
  const warm=async()=>{setBusy(true);setMessage("");try{for(const event of SHOWCASE_EVENTS){let total=1;for(let index=0;index<total;index++){const r=await prepareEventCommentary({data:{event:event.id,index}});total=r.total;setMessage(`${event.title}: ${index+1} / ${total} clips`);if(r.status!=="ready" || !r.audioReady) throw new Error(`${event.title}: commentary or audio is not ready. Try again.`);}}setMessage("All showcase commentary clips are prepared.");}catch(e){setMessage(e instanceof Error?e.message:"Commentary preparation stopped.");}finally{setBusy(false);}};
  return <section className="border border-line bg-deep p-5"><button disabled={busy} className="min-h-11 border border-line px-4" onClick={()=>void warm()}>Prepare commentary</button>{message && <p role="status" className="mt-3 text-sm text-amber">{message}</p>}</section>;
}

export function ShowcasePage({ admin = false }: {admin?: boolean}) {
  const data = usePit(); const desk = data.session.role === "commissioner";
  const request = useRef(0);
  const activeGeneration = useRef(0);
  const [generation, setGeneration] = useState(0);
  const [opening, setOpening] = useState(false); const [openingSeen, setOpeningSeen] = useState(false);
  const [event,setEvent] = useState<ShowcaseEventId>("striker-race");
  const [tape,setTape] = useState<ShowcaseTape | null>(null); const [mode,setMode] = useState(""); const [time,setTime] = useState(0); const [busy,setBusy] = useState(false); const [error,setError] = useState(""); const [order,setOrder] = useState<string[]>([]);
  const setPlayerTime: React.Dispatch<React.SetStateAction<number>> = update => {
    setTime(current => updateShowcaseClock(current, generation, activeGeneration.current, update));
  };
  const done = Boolean(tape && showcaseFinishVisible(time, tape.duration));
  const selected = EVENTS.find(e => e.id === event)!;
  const posted = data.showcase?.events?.[event]?.tape ?? null;
  const winningCrew=tape?.teams?.find(team=>team.storeIds.length===4&&team.storeIds.every(id=>tape.winnerIds.includes(id)));
  const winners = useMemo(() => tape?.fighters.filter(f => tape.winnerIds.includes(f.id)) ?? [], [tape]);
  if (admin && !desk) return <PinGate/>;
  const load = async (source: "demo" | "live" | "rehearsal" | "prepared" | "posted") => {
    const token = ++request.current; const requestedEvent = event;
    setBusy(true); setError(""); setTime(0);
    try {
      let next: ShowcaseTape;
      if (source === "demo") next = showcaseDemo(requestedEvent);
      else if (source === "posted") { if (!posted) throw new Error("This event has not been posted yet."); next = posted; }
      else if (source === "live") next = (await openShowcaseEvent({data:{event:requestedEvent}})).tape;
      else next = (await previewShowcaseEvent({data:{event:requestedEvent,source}})).tape;
      const accepted = acceptShowcaseTape(request.current, token, next);
      if (!accepted) return;
      activeGeneration.current = accepted.generation;
      const saved = data.showcase?.entryOrder?.slice(-4);
      const validSaved = saved?.length === 4 && new Set(saved).size === 4 && saved.every(id => next.winnerIds.includes(id));
      setTape(accepted.tape); setTime(accepted.time); setGeneration(accepted.generation); setMode(source); setOrder(validSaved ? saved : next.winnerIds); if (!admin && ((source === "live" && !openingSeen) || source === "demo")) { setOpening(true); if (source === "live") setOpeningSeen(true); }
    } catch (e) { if (token === request.current) setError(e instanceof Error ? e.message : "The tape could not be opened."); } finally {if (token === request.current) setBusy(false);}
  };
  const post = async () => {if (!tape || mode !== "live") return; const event = tape.eventId; setBusy(true); setError(""); try {await publishShowcaseEvent({data:{event}}); await takeLeagueSeason(); setMode("posted");} catch(e) {setError(e instanceof Error ? e.message : "The result could not be posted.");} finally {setBusy(false);}};
  const saveOrder = async () => {setBusy(true); setError(""); try {await saveShowcaseEntryOrder({data:{order}}); await takeLeagueSeason();} catch(e) {setError(e instanceof Error ? e.message : "The entry order could not be saved.");} finally {setBusy(false);}};
  return <main className="mx-auto flex max-w-6xl flex-col gap-6" data-testid={admin ? "showcase-admin" : "showcase-page"}>
    <header className="border-b border-line pb-6"><p className="text-xs font-bold tracking-[.24em] text-amber">PIT NIGHT / SPECIAL EVENT</p><h1 className="mt-2 font-display text-5xl sm:text-6xl">{admin ? "Showcase rehearsal" : "The Showcase"}</h1><p className="mt-3 max-w-3xl text-muted">{admin ? "Desk-only, read-only tape review. Rehearsals and prepared tapes do not post results or award prizes." : "Four events. Twelve contenders. One more way to make a mark before the Rumble."}</p>{!admin && <p className="mt-3 text-sm text-[#e5c892]">Builds lock Saturday, November 21 at 6 PM Central · Watch Tuesday, November 24 · Rumble prep continues after the Showcase through Friday, November 27.</p>}</header>
    {desk && (admin ? <CommentaryWarmup/> : <ShowcaseOperations/>)}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{EVENTS.map(e => <button key={e.id} disabled={busy} onClick={() => {request.current++; setEvent(e.id); setTape(null); setTime(0); setError("");}} className={`min-h-40 border p-4 text-left transition-colors ${event === e.id ? "border-amber bg-[#302b20]" : "border-line bg-deep hover:border-[#a88a57]"}`}><span className="text-[10px] font-bold tracking-[.2em] text-amber">{e.eyebrow}</span><strong className="mt-3 block font-display text-2xl">{e.title}</strong><span className="mt-2 block text-sm text-muted">{e.detail}</span></button>)}</div>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs tracking-widest text-amber">{selected.eyebrow}</p><h2 className="font-display text-3xl">{selected.title}</h2><p className="mt-1 text-sm text-muted">{selected.prize}</p></div><div className="flex flex-wrap gap-2">{admin ? <><button disabled={busy} onClick={() => void load("rehearsal")} className="min-h-11 bg-amber px-4 font-display text-black">REHEARSAL TAPE</button><button disabled={busy} onClick={() => void load("prepared")} className="min-h-11 border border-line px-4">Prepared tape</button></> : <><button disabled={busy} onClick={() => void load("demo")} className="min-h-11 border border-line px-4">House demo</button>{posted && <button disabled={busy} onClick={() => void load("posted")} className="min-h-11 bg-amber px-4 font-display text-black">WATCH REPLAY</button>}{desk && <button disabled={busy} onClick={() => void load("live")} className="min-h-11 border border-amber px-4 text-amber">Start event</button>}</>}</div></div>
    {!admin && <p className="text-sm text-muted">House demos use fictional competitors. They do not post results or award prizes.</p>}
    {error && <p role="alert" className="border border-red-500 p-3 text-sm text-red-300">{error}</p>}
    {tape && opening && <ShowcaseTeamJanelleOpening cast={mode === "demo" ? showcaseDemo("team-gauntlet").fighters : celebrationCast(data).filter(f => data.showcase?.field.includes(f.id))} onComplete={() => setOpening(false)} />}
    {tape && !opening && <><ShowcaseArena key={`${tape.eventId}-${tape.seed}-${generation}`} tape={tape} time={time} setTime={setPlayerTime} preview={desk} revealed={Boolean(data.showcase?.events[tape.eventId]?.revealedAt)} label={mode === "demo" ? "HOUSE DEMO · NO AWARDS" : admin ? `DESK REVIEW · ${mode.toUpperCase()}` : mode === "posted" ? "POSTED REPLAY" : "DESK BROADCAST"}/>{done && <section className="border border-amber bg-[#2b271d] p-5"><p className="text-xs tracking-widest text-amber">OFFICIAL TAPE / FINISH</p><h3 className="mt-2 font-display text-3xl">{tape.eventId === "team-gauntlet" ? winningCrew?.name ?? "Recorded crew result" : winners.map(f => f.botName).join(" · ") || "Event complete"}</h3>{tape.eventId === "team-gauntlet" && <p className="mt-2 text-sm">{winners.map(f=>f.botName).join(" · ")}</p>}<p className="mt-2 text-sm text-muted">{mode === "demo" ? "Fictional house result — no awards." : admin ? "Review only — no results or awards posted." : EVENTS.find(e => e.id === tape.eventId)?.prize}</p>{desk && mode === "live" && <button disabled={busy} className="mt-4 min-h-11 bg-amber px-4 font-display text-black" onClick={() => void post()}>POST EVENT RESULT</button>}</section>}{desk && !admin && tape.eventId === "team-gauntlet" && done && mode !== "demo" && order.length === 4 && <section className="border border-line p-5"><h3 className="font-display text-2xl">Winning crew entry order</h3><p className="mt-2 text-sm text-muted">Set the four captains’ agreed order for the final four slots.</p><ol className="mt-3 space-y-2">{order.map((id,i) => <li className="flex items-center gap-3" key={id}><span className="w-6">{i+1}.</span><span className="flex-1">{tape.fighters.find(f => f.id === id)?.botName ?? id}</span><button aria-label={`Move ${id} earlier`} disabled={i===0} onClick={() => setOrder(a => {const b=[...a]; [b[i-1],b[i]]=[b[i],b[i-1]]; return b;})} className="min-h-11 border border-line px-3">↑</button><button aria-label={`Move ${id} later`} disabled={i===3} onClick={() => setOrder(a => {const b=[...a]; [b[i+1],b[i]]=[b[i],b[i+1]]; return b;})} className="min-h-11 border border-line px-3">↓</button></li>)}</ol><button disabled={busy} className="mt-4 min-h-11 border border-amber px-4 text-amber" onClick={() => void saveOrder()}>Save agreed order</button></section>}</>}
  </main>;
}
