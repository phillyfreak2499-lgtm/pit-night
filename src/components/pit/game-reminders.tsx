import { Link } from '@tanstack/react-router';
import { usePit } from '@/lib/pit/store';
import { gameReminders } from '@/lib/pit/game-reminders';
import { useNow } from './bits';
export function GameReminders() {
 const data=usePit(); const now=useNow(); const storeId=data.session.storeId;
 if(!now||!storeId||!['captain','crew'].includes(data.session.role)) return null;
 const reminders=gameReminders(data,storeId,now);
 if(!reminders.length) return null;
 return <aside aria-label="Store daily reminders" className="mb-5 space-y-3">{reminders.map(r=><section key={r.title} className="border border-amber/60 bg-surface p-4">
 <h2 className="font-display text-xl text-amber">{r.title}</h2>
 <ul className="my-3 list-disc space-y-1 pl-5 text-sm">{r.lines.map(line=><li key={line}>{line}</li>)}</ul>
 <p className="mb-3 text-sm text-muted">{r.closed?'This activity window has closed. Check Pit Week for current work; contact your captain about anything missed.':'Open Pit Week, select the indicated day, and complete your jobs and Daily Spark. Captains: review submitted jobs there too.'}</p>
 <Link to="/week" className="inline-flex min-h-11 items-center border border-amber px-4 font-display text-amber">Open Pit Week →</Link>
 </section>)}</aside>;
}
