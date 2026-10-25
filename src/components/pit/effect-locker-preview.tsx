import { useState } from "react";
import { LOCKER, boltsOf } from "@/lib/pit/week";
import { usePit } from "@/lib/pit/store";
import { BotPortrait, useBotLook } from "./bot-portrait";
import { Btn, SectionLabel } from "./bits";

export function EffectLockerPreview({ storeId, canBuy }: { storeId: string; canBuy: boolean }) {
  const data = usePit();
  const look = useBotLook(storeId);
  const [effect, setEffect] = useState("");
  const store = data.stores.find((s) => s.id === storeId)!;
  const item = LOCKER.find((i) => i.id === effect);
  const owned = Boolean(item && store.unlocks?.includes(item.id));
  const balance = boltsOf(data, storeId).balance;
  return (
    <section className="border border-line bg-deep p-4" data-testid="effect-preview">
      <SectionLabel>Walkout & victory rehearsal</SectionLabel>
      <p className="mt-2 text-sm text-muted">
        Preview any effect before buying. Rehearsal spends no Bolts and changes no equipment or
        fight stats. Reduced motion uses the description below.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {LOCKER.filter((i) => i.kind === "walkout" || i.kind === "victory" || i.kind === "smoke").map((i) => (
          <Btn key={i.id} tone={effect === i.id ? "amber" : "line"} onClick={() => setEffect(i.id)}>
            {i.name}
          </Btn>
        ))}
        <Btn tone="ghost" onClick={() => setEffect("")}>
          Stop
        </Btn>
      </div>
      {item ? (
        <>
          <BotPortrait look={look} className="h-52 w-full" effect={effect} />
          <p className="text-sm">
            {item.name} · {item.price} Bolts · {owned ? "Owned" : `${balance} Bolts available`}
          </p>
          <p className="mt-1 text-sm text-muted">{item.blurb}</p>
          {canBuy ? (
            <div className="mt-3">
              <Btn
                disabled={!owned && balance < item.price}
                onClick={() =>
                  owned
                    ? data.setStyle(storeId, { [item.kind]: item.id })
                    : data.buyLocker(storeId, item.id)
                }
              >
                {owned ? "Equip effect" : `Buy for ${item.price} Bolts`}
              </Btn>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
