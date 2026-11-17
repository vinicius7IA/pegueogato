import { Footprints, Hand, Shield, Sparkles, Zap } from 'lucide-react';
import { ReactNode, useRef } from 'react';
import { createEmptyInput, FighterInputState } from '../game/arenaScene';

/**
 * Controle de toque de um jogador: direcional à esquerda + 4 botões grandes
 * (SOCO, CHUTE, DEFESA, ESPECIAL). Multitoque: dá para andar e bater ao mesmo tempo.
 *
 * Combinações:
 * - Direção + SOCO/CHUTE = golpe forte (sem direção = fraco)
 * - Direção + DEFESA = esquiva
 * - ESPECIAL = especial; com direção = segundo especial; ↑ + ESPECIAL = poder;
 *   barra cheia = SUPER
 */
interface TouchPadProps {
  side: 'p1' | 'p2';
  /** No versus no mesmo celular, cada jogador usa metade da tela. */
  split: boolean;
  scale: number;
  energy: number;
  canPower: boolean;
  haptics: boolean;
  state: { current: FighterInputState };
}

type Tone = 'gold' | 'sky' | 'cyan' | 'orange' | 'crimson';
const TONES: Record<Tone, string> = {
  gold: 'bg-gradient-to-b from-[#ffd400] to-[#ff9500] text-black border-white',
  sky: 'bg-[#0b1a4a]/90 text-sky-200 border-sky-300/80',
  cyan: 'bg-[#0b1a4a]/90 text-cyan-200 border-cyan-300/80',
  orange: 'bg-[#3a1405]/90 text-orange-200 border-orange-300/80',
  crimson: 'bg-gradient-to-b from-[#ff2b3a] to-[#8a0612] text-white border-[#ffd400]',
};

function PadButton({
  label,
  icon,
  size,
  style,
  tone,
  glow,
  onDown,
  onUp,
}: {
  label: string;
  icon: ReactNode;
  size: number;
  style: React.CSSProperties;
  tone: Tone;
  glow?: boolean;
  onDown: () => void;
  onUp: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onDown();
      }}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onLostPointerCapture={onUp}
      onContextMenu={(e) => e.preventDefault()}
      style={{ width: size, height: size, ...style }}
      className={`touch-control absolute rounded-full border-[3px] flex flex-col items-center justify-center gap-0.5 select-none active:scale-90 transition-transform shadow-[0_6px_16px_rgba(0,0,0,0.6),inset_0_2px_0_rgba(255,255,255,0.3)] ${TONES[tone]} ${
        glow ? 'ring-4 ring-[#ffd400]/80 animate-pulse' : ''
      }`}
    >
      {icon}
      <span className="text-[9px] font-black tracking-wide leading-none">{label}</span>
    </button>
  );
}

export function TouchPad({ side, split, scale, energy, canPower, haptics, state }: TouchPadProps) {
  const knobRef = useRef<HTMLDivElement | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const k = scale * (split ? 0.78 : 1);
  const pulse = (ms = 18) => {
    if (haptics) navigator.vibrate?.(ms);
  };
  const s = state.current;
  const horizontal = () => Math.abs(s.moveX) > 0.4;

  const release = (keys: Array<keyof Omit<FighterInputState, 'moveX'>>) => () => {
    keys.forEach((key) => {
      s[key] = false;
    });
  };

  const stickSize = 118 * k;
  const maxR = 42 * k;
  const resetStick = () => {
    origin.current = null;
    s.moveX = 0;
    s.jump = false;
    s.crouch = false;
    if (knobRef.current) knobRef.current.style.transform = 'translate(0px, 0px)';
  };

  const stick = (
    <div
      className="touch-control pointer-events-auto relative rounded-full bg-black/45 border-2 border-white/35 grid place-items-center shadow-[0_8px_24px_rgba(0,0,0,0.7)]"
      style={{ width: stickSize, height: stickSize }}
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        origin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!origin.current) return;
        const dx = Math.max(-maxR, Math.min(maxR, e.clientX - origin.current.x));
        const dy = Math.max(-maxR, Math.min(maxR, e.clientY - origin.current.y));
        s.moveX = Math.abs(dx) > maxR * 0.2 ? dx / maxR : 0;
        s.jump = dy < -maxR * 0.5;
        s.crouch = dy > maxR * 0.5;
        if (knobRef.current) knobRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
      }}
      onPointerUp={resetStick}
      onPointerCancel={resetStick}
    >
      {/* setas do direcional */}
      {['top-1 left-1/2 -translate-x-1/2 rotate-0', 'bottom-1 left-1/2 -translate-x-1/2 rotate-180', 'left-1 top-1/2 -translate-y-1/2 -rotate-90', 'right-1 top-1/2 -translate-y-1/2 rotate-90'].map((cls) => (
        <span key={cls} className={`absolute ${cls} text-white/50 text-xs leading-none pointer-events-none`}>
          ▲
        </span>
      ))}
      <div
        ref={knobRef}
        className={`rounded-full border-2 border-white transition-transform duration-75 pointer-events-none ${
          side === 'p1' ? 'bg-gradient-to-b from-[#4c86ff] to-[#1d4ed8]' : 'bg-gradient-to-b from-[#ff5a66] to-[#b3121f]'
        }`}
        style={{ width: 50 * k, height: 50 * k }}
      />
    </div>
  );

  const full = energy >= 100;
  const B = (n: number) => n * k;
  const buttons = (
    <div className="pointer-events-auto relative shrink-0" style={{ width: B(200), height: B(150) }}>
      <PadButton
        label="SOCO"
        icon={<Hand style={{ width: B(24), height: B(24) }} />}
        size={B(76)}
        style={{ right: 0, bottom: 0 }}
        tone="gold"
        onDown={() => {
          pulse();
          if (horizontal()) s.punchHeavy = true;
          else s.punchLight = true;
        }}
        onUp={release(['punchLight', 'punchHeavy'])}
      />
      <PadButton
        label="CHUTE"
        icon={<Footprints style={{ width: B(20), height: B(20) }} />}
        size={B(66)}
        style={{ right: B(86), bottom: 0 }}
        tone="sky"
        onDown={() => {
          pulse();
          if (horizontal()) s.kickHeavy = true;
          else if (s.crouch) s.kickMed = true;
          else s.kickLight = true;
        }}
        onUp={release(['kickLight', 'kickMed', 'kickHeavy'])}
      />
      <PadButton
        label="DEFESA"
        icon={<Shield style={{ width: B(20), height: B(20) }} />}
        size={B(62)}
        style={{ right: B(74), bottom: B(76) }}
        tone="cyan"
        onDown={() => {
          if (horizontal()) s.dodge = true;
          else {
            s.block = true;
            s.parry = true;
          }
        }}
        onUp={release(['block', 'parry', 'dodge'])}
      />
      <PadButton
        label={full ? 'SUPER' : 'ESPECIAL'}
        icon={full ? <Zap style={{ width: B(22), height: B(22) }} /> : <Sparkles style={{ width: B(20), height: B(20) }} />}
        size={B(64)}
        style={{ right: 0, bottom: B(86) }}
        tone={full ? 'crimson' : 'orange'}
        glow={full}
        onDown={() => {
          pulse(30);
          if (full) s.finisher = true;
          else if (s.jump && canPower) s.powerMove = true;
          else if (horizontal()) s.special2 = true;
          else s.special1 = true;
        }}
        onUp={release(['finisher', 'powerMove', 'special1', 'special2'])}
      />
    </div>
  );

  // P1: direcional na borda esquerda e botões à direita (em tela cheia, na borda direita).
  // P2 no versus: espelhado, botões perto do centro e direcional na borda direita.
  if (!split) {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between px-3 pb-3 sm:px-6 sm:pb-5" style={{ paddingLeft: 'max(12px, env(safe-area-inset-left))', paddingRight: 'max(12px, env(safe-area-inset-right))' }}>
        {stick}
        {buttons}
      </div>
    );
  }
  return (
    <div
      className={`pointer-events-none absolute bottom-0 w-1/2 flex items-end justify-between px-2 pb-2 ${
        side === 'p1' ? 'left-0' : 'right-0 flex-row-reverse'
      }`}
    >
      {stick}
      {buttons}
    </div>
  );
}

export function createTouchState() {
  return { current: createEmptyInput() };
}
