import { useState } from 'react';

function CheckInRichModal({ onConfirm, onSkip }: {
  onConfirm: (data: { mood: number; hadUrge: boolean; urgeIntensity: number; trigger: string }) => void;
  onSkip: () => void;
}) {
  const [mood, setMood] = useState(7);
  const [hadUrge, setHadUrge] = useState<boolean | null>(null);
  const [urgeIntensity, setUrgeIntensity] = useState(5);
  const [trigger, setTrigger] = useState("");
  const canConfirm = hadUrge !== null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onSkip()}>
      <div className="w-full max-w-md rounded-t-3xl p-6 pb-10 space-y-5"
        style={{ background: "oklch(0.12 0.02 145)" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Come stai oggi?</h2>
          <button onClick={onSkip} className="text-white/40 text-sm">salta</button>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-white/50">
            <span>Umore</span><span className="text-white font-semibold">{mood}/10</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg">Ã°ÂÂÂ</span>
            <input type="range" min={1} max={10} value={mood}
              onChange={e => setMood(Number(e.target.value))}
              className="flex-1 accent-emerald-400 h-2" />
            <span className="text-lg">Ã°ÂÂÂ</span>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs text-white/50">Hai sentito l'impulso oggi?</p>
          <div className="flex gap-2">
            {["SÃÂ¬","No"].map(opt => (
              <button key={opt} onClick={() => setHadUrge(opt === "SÃÂ¬")}
                className={"flex-1 py-2 rounded-xl text-sm font-medium border transition-all " + (
                  (opt === "SÃÂ¬" ? hadUrge === true : hadUrge === false)
                    ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                    : "border-white/10 text-white/50")}>
                {opt}
              </button>
            ))}
          </div>
        </div>
        {hadUrge === true && (<>
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-white/50">
              <span>IntensitÃÂ  impulso</span><span className="text-white font-semibold">{urgeIntensity}/10</span>
            </div>
            <input type="range" min={1} max={10} value={urgeIntensity}
              onChange={e => setUrgeIntensity(Number(e.target.value))}
              className="w-full accent-amber-400 h-2" />
          </div>
          <div className="space-y-2">
            <p className="text-xs text-white/50">Cosa l'ha scatenato?</p>
            <div className="flex flex-wrap gap-2">
              {CI_TRIGGERS.map(t => (
                <button key={t} onClick={() => setTrigger(trigger === t ? "" : t)}
                  className={"px-3 py-1 rounded-full text-xs font-medium border transition-all " + (
                    trigger === t ? "bg-amber-500/20 border-amber-500/50 text-amber-400" : "border-white/10 text-white/40")}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </>)}
        <button disabled={!canConfirm}
          onClick={() => onConfirm({ mood, hadUrge: hadUrge!, urgeIntensity: hadUrge ? urgeIntensity : 0, trigger: hadUrge ? trigger : "" })}
          className={"w-full py-3 rounded-xl font-semibold text-sm transition-all " + (canConfirm ? "bg-emerald-500 text-white" : "bg-white/5 text-white/20 cursor-not-allowed")}>
          Salva il check-in
        </button>
      </div>
    </div>
  );
}

export { CheckInRichModal };
