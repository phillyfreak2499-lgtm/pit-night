import {GauntletCourse,GauntletCrewCards,GauntletGuide} from "./gauntlet-course";
import { useEffect, useMemo, useState } from "react";
import { BotPortrait } from "./bot-portrait";
import { armSound, playBell, setSoundMuted, soundMuted } from "@/lib/pit/sound";
import { showcaseSegments } from "@/lib/pit/event-commentary";
import { useEventCommentary } from "./use-event-commentary";
import type { ShowcaseFrame, ShowcaseTape } from "@/lib/pit/showcase-model";
import { showcaseFinishVisible, showcaseFrameUpdate } from "./playback-lifecycle";

function frameAt(frames: ShowcaseFrame[], t: number, reduced: boolean): ShowcaseFrame | undefined {
  if (!frames.length) return undefined;
  let i = 0;
  while (i + 1 < frames.length && frames[i + 1].at <= t) i++;
  const a = frames[i], b = frames[i + 1];
  if (reduced || !b || b.at <= a.at) return a;
  const f = Math.max(0, Math.min(1, (t - a.at) / (b.at - a.at)));
  return { ...a, x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

export function ShowcaseArena({ tape, time, setTime, label = "RECORDED EVENT", onMoment, preview = false, revealed = false }: { tape: ShowcaseTape; time: number; setTime: React.Dispatch<React.SetStateAction<number>>; label?: string; preview?: boolean; revealed?: boolean; onMoment?: (moment: { eventId: ShowcaseTape["eventId"]; seed: string; at: number }) => void }) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [muted, setMuted] = useState(soundMuted);
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => { const mq = window.matchMedia("(prefers-reduced-motion: reduce)"); const change = () => setReduced(mq.matches); mq.addEventListener("change", change); return () => mq.removeEventListener("change", change); }, []);
  const segments = useMemo(() => showcaseSegments(tape), [tape]);
  const caption = useEventCommentary({event:tape.eventId, seed:tape.seed, segments, time, playing, muted, preview, revealed, closingReady: showcaseFinishVisible(time, tape.duration), allowStoppedClosing:true});
  useEffect(() => { setPlaying(false); }, [tape]);
  useEffect(() => {
    if (!playing) return;
    let last = 0, id = 0;
    const tick = (now: number) => {
      if (last) setTime(showcaseFrameUpdate(last,now,speed,tape.duration));
      last = now; id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing, speed, tape.duration]);
  useEffect(() => { if (time >= tape.duration && playing) setPlaying(false); }, [time, tape.duration, playing]);
  useEffect(() => { if (playing) onMoment?.({ eventId: tape.eventId, seed: tape.seed, at: Math.floor(time) }); }, [Math.floor(time), playing, tape.eventId, tape.seed, onMoment]);
  const actors = useMemo(() => tape.runs.map(run => ({ run, fighter: tape.fighters.find(f => f.id === run.storeId), frame: frameAt(run.frames, time, reduced) })).filter(a => a.frame && a.fighter), [tape, time, reduced]);
  const race = tape.eventId === "striker-race", pull = tape.eventId === "tank-pull", team = tape.eventId === "team-gauntlet";
  return <section className="overflow-hidden border border-line bg-[#10151c]" aria-label={`${tape.title} playback`}>
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-[#181e27] px-4 py-3"><div><span className="text-[10px] font-bold tracking-[.2em] text-amber">{label}</span><h2 className="font-display text-2xl">{tape.title}</h2></div><span className="font-mono text-sm text-[#d6dde1]">{time.toFixed(1)} / {tape.duration.toFixed(1)} SEC</span></div>
    {team&&<GauntletGuide/>}
    {team?<GauntletCourse tape={tape} time={time} reduced={reduced}/>:<svg viewBox="0 0 1000 560" className="block w-full bg-[#192125]" role="img" aria-label={`${tape.title} arena. Recorded positions at ${time.toFixed(1)} seconds.`}>
      <defs><pattern id="show-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#ffffff" strokeOpacity=".035"/></pattern><radialGradient id="show-glow"><stop stopColor="#7effeb" stopOpacity=".8"/><stop offset="1" stopColor="#7effeb" stopOpacity="0"/></radialGradient></defs>
      <rect width="1000" height="560" fill={race ? "#233d34" : pull ? "#3b3029" : "#172e36"}/><rect width="1000" height="560" fill="url(#show-grid)"/>
      {race ? <><ellipse cx="500" cy="280" rx="485" ry="235" fill="#c39662" stroke="#f4d99b" strokeWidth="8"/><ellipse cx="500" cy="280" rx="255" ry="100" fill="#243e34" stroke="#e1c28e" strokeWidth="5"/><rect x="491" y="45" width="18" height="135" fill="#f9edce"/><path d="M500 45v135" stroke="#252525" strokeWidth="8" strokeDasharray="13 13"/><text x="500" y="270" textAnchor="middle" fill="#c7d5bc" opacity=".55" fontSize="28" fontWeight="900" letterSpacing="8">STRIKER STAKES</text><text x="500" y="304" textAnchor="middle" fill="#c7d5bc" opacity=".5" fontSize="15" letterSpacing="5">THREE LAPS • ONE FINISH</text></> : pull ? <><rect x="44" y="50" width="912" height="460" rx="15" fill="#8a674b" stroke="#c8a57c" strokeWidth="5"/>{[1,2,3,4,5].map(i => <path key={i} d={`M55 ${50+i*76}H945`} stroke="#ddba88" strokeOpacity=".35" strokeWidth="3" strokeDasharray="12 12"/>)}<text x="500" y="38" textAnchor="middle" fill="#f0d6a6" fontSize="16" letterSpacing="5">IRON PULL • DISTANCE IN METRES</text></> : <><rect x="30" y="30" width="940" height="500" rx="24" fill="#17343a" stroke="#638f8e" strokeWidth="4"/><path d="M70 280H930" stroke="#6ad6ce" strokeOpacity=".2" strokeWidth="100" strokeDasharray="30 20"/><text x="500" y="60" textAnchor="middle" fill="#a8e9dd" fontSize="16" letterSpacing="5">{team ? "TEAM GAUNTLET • CONVOY COURSE" : "REACTOR RESCUE • THREE CORES"}</text></>}
      {!race && !pull && tape.course.objects.map(o => { const x=o.x*1000, y=o.y*560, w=o.w*1000, h=o.h*560; const gate = o.kind.toLowerCase().includes("gate"); const core = o.kind.toLowerCase().includes("core"); const open = o.openWindows?.some(window => time >= window.from && time <= window.to); return <g key={o.id} transform={`translate(${x} ${y})`} opacity={gate && open ? .35 : .9}>{core ? <><circle r={Math.max(18,w)} fill="url(#show-glow)"/><circle r="9" fill="#aaffeb" stroke="#fff" strokeWidth="3"/></> : <><rect x={-w/2} y={-h/2} width={Math.max(8,w)} height={Math.max(8,h)} rx="4" fill={gate ? "#ffb35a" : "#708b8a"} stroke="#e9e8bb" strokeWidth="3"/>{gate && <text y="-12" textAnchor="middle" fill="#fff" fontSize="12">{open ? "OPEN" : "GATE"}</text>}</>}</g> })}
      {actors.map(({run, fighter, frame}) => { if (!fighter || !frame) return null; const x=frame.x*1000, y=frame.y*560; const number=tape.fighters.findIndex(f=>f.id===fighter.id)+1; const crewIndex=tape.teams?.findIndex(t=>t.id===run.teamId) ?? -1; const color=["#7ce8db","#f4d99b","#bbacff"][crewIndex] ?? "#ffffff"; return <g key={run.storeId} transform={`translate(${x} ${y})`}><title>{`${number}. ${fighter.botName}${team ? ` · ${tape.teams?.find(t=>t.id===run.teamId)?.name} · ${tape.teams?.find(t=>t.id===run.teamId)?.roles?.[fighter.id]}` : ""}`}</title>
        {pull && <g><path d="M-14 5H-58" stroke="#eee2c3" strokeWidth="4"/><rect x="-95" y="-14" width="40" height="27" rx="3" fill="#343a3a" stroke="#e8c497" strokeWidth="3"/><rect x="-89" y="-22" width="28" height="10" fill="#c2a377"/></g>}
        <foreignObject x="-34" y="-21" width="68" height="42"><BotPortrait camera="top" floor={false} className="h-full w-full" look={{id:fighter.id, paint:fighter.paint, classId:fighter.classId, weapon:fighter.weaponFamily, weaponName:fighter.weaponName, look:fighter.look, number:fighter.number, hp:frame.hp, style:fighter.style, storeName:fighter.storeName, brainTier:fighter.brainTier, scars:fighter.scars, armorFamily:fighter.armorFamily, driveFamily:fighter.driveFamily, chassisFamily:fighter.chassisFamily, utilityFamily:fighter.utilityFamily}} /></foreignObject>{frame.carrying && <circle cx="20" cy="-18" r="7" fill="#aaffee" stroke="#fff" strokeWidth="2"/>}<circle cx="-54" r="20" fill="#0b1119" stroke={color} strokeWidth="2"/><text x="-54" y="8" textAnchor="middle" fill={color} fontSize="24" fontWeight="800">{number}</text></g> })}
    </svg>}
    <div className="space-y-3 p-4"><div className="flex flex-wrap items-center gap-2"><button className="min-h-11 bg-amber px-5 font-display text-[#161616]" onClick={() => { armSound(); if (time >= tape.duration) setTime(0); if (!playing && time === 0) playBell(); setPlaying(!playing); }}>{playing ? "PAUSE" : time >= tape.duration ? "REPLAY" : "PLAY"}</button><button className="min-h-11 border border-line px-4" onClick={() => setSpeed(speed === 1 ? 2 : 1)}>{speed}× speed</button><button className="min-h-11 border border-line px-4" onClick={() => { setSoundMuted(!muted); setMuted(!muted); }}>{muted ? "Unmute" : "Mute"}</button><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={reduced} onChange={e => setReduced(e.target.checked)}/> Reduced motion</label></div><label className="block text-xs text-muted">Seek through recorded event <input className="mt-2 block w-full accent-amber" type="range" min="0" max={tape.duration} step="0.1" value={time} onChange={e => {setTime(Number(e.target.value)); setPlaying(false);}} /></label><p className="text-xs text-muted" aria-live="polite">{time >= tape.duration ? "Event complete. Results are available below." : `Event time ${time.toFixed(1)} seconds. ${actors.length} competitors on course.`}</p></div>
    {caption && <p className="px-4 pb-3 text-sm text-[#f4d99b]" aria-live="polite">{caption}</p>}
    {team?<GauntletCrewCards tape={tape} time={time}/>:<div className="grid gap-px border-t border-line bg-line sm:grid-cols-2 lg:grid-cols-3">{actors.map(({run, fighter, frame}) => <div className="bg-[#151b22] px-3 py-2 text-xs" key={run.storeId}><strong><span className="mr-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-[#a5e6dd] px-1 font-mono" aria-label="Arena marker">{tape.fighters.findIndex(f=>f.id===run.storeId)+1}</span>{fighter?.botName}</strong><span className="float-right text-[#a5e6dd]">{race ? `Lap ${Math.min(3, (frame?.stage ?? 0) + 1)}` : pull ? `${Math.round((frame?.progress ?? 0) * 100)} m` : `${frame?.cargo ?? 0} cores`} · {Math.round((frame?.hp ?? 0))} HP</span><div className="mt-1 text-muted">{tape.course.stages[frame?.stage ?? 0] ?? "On course"}{team && run.teamId ? ` · ${tape.teams?.find(t => t.id === run.teamId)?.name ?? "Crew"} · ${tape.teams?.find(t=>t.id===run.teamId)?.roles?.[run.storeId]?.toUpperCase() ?? "CREW"}` : ""}</div></div>)}</div>}
  </section>;
}
