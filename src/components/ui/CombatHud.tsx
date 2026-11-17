import { Pause } from 'lucide-react';

/* HUD de luta no estilo arcade moderno: retratos nos cantos, barras de vida
   com degradê por faixa de vida, timer hexagonal central e medidor de nível. */

export interface HudSide {
  name: string;
  subtitle?: string;
  photoUrl?: string | null;
  badgeColor: string;
  hpPct: number;
  energy: number; // 0-100
  rounds: number;
  stun: number;
}

function hpTone(pct: number, side: 'p1' | 'p2') {
  if (pct <= 28) return 'from-red-700 via-sf-crimson to-orange-400';
  if (pct <= 55) return 'from-amber-600 via-sf-gold to-yellow-200';
  return side === 'p1'
    ? 'from-emerald-600 via-emerald-400 to-lime-300'
    : 'from-emerald-600 via-emerald-400 to-lime-300';
}

function Portrait({ side, tone }: { side: HudSide; tone: 'p1' | 'p2' }) {
  const ring = tone === 'p1' ? 'border-sf-gold' : 'border-sf-cyan';
  return (
    <div
      className={`relative shrink-0 w-12 h-12 sm:w-16 sm:h-16 rounded-full border-[3px] ${ring} bg-sf-ink overflow-hidden shadow-[0_4px_14px_rgba(0,0,0,0.8)]`}
    >
      {side.photoUrl ? (
        <img
          src={side.photoUrl}
          alt={side.name}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-top"
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center font-display italic font-black text-white text-lg sm:text-2xl"
          style={{ backgroundColor: side.badgeColor }}
        >
          {side.name.slice(0, 2)}
        </div>
      )}
    </div>
  );
}

function Side({ side, tone }: { side: HudSide; tone: 'p1' | 'p2' }) {
  const mirror = tone === 'p2';
  const level = Math.min(3, Math.floor(side.energy / (100 / 3)));
  const maxed = side.energy >= 100;
  const accent = tone === 'p1' ? 'bg-sf-gold' : 'bg-sf-cyan';
  const pct = Math.max(0, Math.min(100, side.hpPct));
  return (
    <div className={`flex items-center gap-2 min-w-0 ${mirror ? 'flex-row-reverse' : ''}`}>
      <Portrait side={side} tone={tone} />
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div
          className={`flex items-center justify-between gap-2 font-display italic font-black text-white uppercase tracking-wide text-xs sm:text-base leading-none drop-shadow-[0_2px_0_rgba(0,0,0,0.95)] ${
            mirror ? 'flex-row-reverse' : ''
          }`}
        >
          <span className="truncate">
            {side.name}
            {side.subtitle ? <span className="text-white/60"> · {side.subtitle}</span> : null}
          </span>
          <span className={`flex gap-1 shrink-0 ${mirror ? 'flex-row-reverse' : ''}`}>
            {[0, 1].map((i) => (
              <span
                key={i}
                className={`w-2.5 h-2.5 rotate-45 border ${
                  side.rounds > i ? `${accent} border-white` : 'bg-black/80 border-white/35'
                }`}
              />
            ))}
          </span>
        </div>

        {/* Barra de vida */}
        <div
          className={`relative h-5 sm:h-6 bg-black/85 border-2 border-white/80 overflow-hidden shadow-[0_4px_14px_rgba(0,0,0,0.85)] ${
            mirror ? 'sf-hp-p2' : 'sf-hp-p1'
          }`}
        >
          <div
            className={`absolute inset-y-0 ${mirror ? 'right-0' : 'left-0'} bg-sf-crimson/80 transition-all duration-700 ease-out`}
            style={{ width: `${pct}%` }}
          />
          <div
            className={`absolute inset-y-0 ${mirror ? 'right-0 bg-gradient-to-l' : 'left-0 bg-gradient-to-r'} ${hpTone(
              pct,
              tone,
            )} transition-all duration-100`}
            style={{ width: `${pct}%` }}
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-white/25" />
        </div>

        {/* Medidor de nível (super) */}
        <div className={`flex items-center gap-1.5 ${mirror ? 'flex-row-reverse' : ''}`}>
          <span
            className={`font-display italic font-black text-[10px] sm:text-xs leading-none px-1.5 py-0.5 ${
              maxed ? 'bg-sf-gold text-black' : 'bg-black/80 text-white border border-white/25'
            }`}
          >
            NV {level}
          </span>
          <div
            className={`relative h-1.5 sm:h-2 flex-1 bg-black/85 border border-white/25 overflow-hidden ${
              mirror ? 'skew-x-12' : '-skew-x-12'
            }`}
          >
            <div
              className={`h-full transition-all duration-100 ${mirror ? 'ml-auto' : ''} ${
                maxed
                  ? 'bg-gradient-to-r from-sf-crimson via-sf-gold to-white'
                  : 'bg-gradient-to-r from-sky-500 to-sf-cyan'
              }`}
              style={{ width: `${side.energy}%` }}
            />
            <div className="pointer-events-none absolute inset-0 grid grid-cols-3">
              <div className="border-r border-black/80" />
              <div className="border-r border-black/80" />
              <div />
            </div>
          </div>
          {side.stun > 5 && (
            <div className="h-1.5 w-10 bg-black/90 border border-white/15 overflow-hidden">
              <div className="h-full bg-sf-gold" style={{ width: `${side.stun}%` }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface CombatHudProps {
  p1: HudSide;
  p2: HudSide;
  timer: string;
  round: number;
  onPause: () => void;
}

export function CombatHud({ p1, p2, timer, round, onPause }: CombatHudProps) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2 sm:gap-4">
      <Side side={p1} tone="p1" />

      <div className="flex flex-col items-center gap-1 shrink-0">
        <div
          className="w-14 h-16 sm:w-16 sm:h-[72px] bg-white flex items-center justify-center"
          style={{ clipPath: 'polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)' }}
        >
          <div
            className="w-[calc(100%-6px)] h-[calc(100%-6px)] bg-sf-ink flex items-center justify-center"
            style={{ clipPath: 'polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)' }}
          >
            <span className="font-mono-num text-2xl sm:text-3xl font-black text-pink-500 leading-none drop-shadow-[0_0_8px_rgba(236,72,153,0.7)]">
              {timer}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-display italic font-black text-[10px] tracking-widest text-white/70">
            ROUND {round}
          </span>
          <button
            type="button"
            onClick={onPause}
            aria-label="Pausar"
            className="pointer-events-auto grid place-items-center w-9 h-9 -my-1 rounded-full bg-sf-surface/90 border border-white/25 text-slate-200 active:scale-95 hover:border-sf-gold hover:text-sf-gold transition focus-visible:outline-2 focus-visible:outline-sf-gold"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      <Side side={p2} tone="p2" />
    </div>
  );
}
