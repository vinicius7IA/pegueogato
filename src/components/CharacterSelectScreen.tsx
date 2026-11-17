import { ArrowLeft, Lock, Shuffle } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import salvadorBackdrop from '../assets/images/salvador_arena_cinematic_1794790674658.jpg';
import { gameAudio } from '../game/audio';
import { FIGHTER_ROSTER_CAPACITY, FIGHTERS, FIGHTERS_LIST, getDisplayFighterMeta, isPlayableFighter } from '../game/catalog';
import { AiDifficulty, ArenaId, FighterId, MatchMode, PlayerProfile, PowerId } from '../game/types';

export type SelectFlow = 'arcade' | 'versus' | 'torneio' | 'treino';

interface CharacterSelectScreenProps {
  flow: SelectFlow;
  onStartLadder: () => void;
  profile: PlayerProfile;
  initialDifficulty: AiDifficulty;
  authorizationMode: boolean;
  arenaId: ArenaId;
  p1Fighter: FighterId;
  p2Fighter: FighterId;
  onSelectP1: (id: FighterId) => void;
  onSelectP2: (id: FighterId) => void;
  onEquipSkin: (fighterId: FighterId, skinId: string) => void;
  onEquipPower: (fighterId: FighterId, powerId: PowerId) => void;
  onOpenStageSelect: () => void;
  onStartFight: (mode: MatchMode, difficulty: AiDifficulty) => void;
  onOpenInventory: () => void;
  onBack: () => void;
}

type Step = 'p1' | 'p2';

const FLOW_LABEL: Record<SelectFlow, string> = {
  arcade: 'ARCADE',
  versus: 'VERSUS',
  torneio: 'TORNEIO',
  treino: 'TREINO',
};

const SIDE = {
  p1: { label: '1P', color: 'var(--color-sf-p1)', text: 'text-sf-p1', border: 'border-sf-p1', bg: 'bg-sf-p1' },
  p2: { label: '2P', color: 'var(--color-sf-p2)', text: 'text-sf-p2', border: 'border-sf-p2', bg: 'bg-sf-p2' },
} as const;

/** Silhueta usada quando o lutador ainda não tem arte 2D. */
function Silhouette({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 120" className={className} aria-hidden="true">
      <circle cx="50" cy="34" r="20" fill="currentColor" />
      <path d="M10 120 C10 82 28 64 50 64 C72 64 90 82 90 120 Z" fill="currentColor" />
    </svg>
  );
}

function FighterArt({ id, side, authorizationMode }: { id: FighterId; side: Step; authorizationMode: boolean }) {
  const def = FIGHTERS[id];
  const meta = getDisplayFighterMeta(id, authorizationMode);
  const left = side === 'p1';
  if (meta.showPortraitPhoto && def.portraitUrl) {
    return (
      <img
        src={def.portraitUrl}
        alt={meta.name}
        referrerPolicy="no-referrer"
        className={`absolute bottom-0 ${left ? 'left-0 object-left-bottom' : 'right-0 object-right-bottom'} h-full w-full object-contain`}
      />
    );
  }
  return <Silhouette className={`absolute bottom-0 ${left ? 'left-[8%]' : 'right-[8%]'} h-[85%] text-black/55`} />;
}

export function CharacterSelectScreen({
  flow,
  onStartLadder,
  profile,
  authorizationMode,
  p1Fighter,
  p2Fighter,
  onSelectP1,
  onSelectP2,
  onOpenStageSelect,
  onBack,
}: CharacterSelectScreenProps) {
  const [step, setStep] = useState<Step>('p1');
  const current = step === 'p1' ? p1Fighter : p2Fighter;
  const ui = SIDE[step];

  const choose = (id: FighterId) => {
    gameAudio.playSelectSnap();
    if (step === 'p1') onSelectP1(id);
    else onSelectP2(id);
  };

  // Arcade e Torneio: só o P1 escolhe; a CPU segue a escada de adversários.
  const ladderMode = flow === 'arcade' || flow === 'torneio';
  const confirm = () => {
    gameAudio.ui('confirm');
    if (step === 'p1') {
      if (ladderMode) onStartLadder();
      else setStep('p2');
    } else onOpenStageSelect();
  };

  const back = () => {
    gameAudio.ui('back');
    if (step === 'p2') setStep('p1');
    else onBack();
  };

  const random = () => {
    const pool = FIGHTERS_LIST.filter((f) => isPlayableFighter(f.id));
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) choose(pick.id);
  };

  const sides: Array<{ side: Step; id: FighterId; shown: boolean }> = [
    { side: 'p1', id: p1Fighter, shown: true },
    { side: 'p2', id: p2Fighter, shown: step === 'p2' },
  ];
  const emptySlots = Math.max(0, FIGHTER_ROSTER_CAPACITY - FIGHTERS_LIST.length - 1);

  return (
    <div className="relative w-full h-full overflow-hidden bg-sf-navy text-white flex flex-col select-none">
      <img src={salvadorBackdrop} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover opacity-25 mix-blend-luminosity pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(47,107,255,0.25),rgba(7,11,30,0.95)_70%)] pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none opacity-30 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.35)_0px,rgba(0,0,0,0.35)_1px,transparent_1px,transparent_3px)]" />

      {/* Palco */}
      <main className="relative flex-1 min-h-0">
        {sides.map(({ side, id, shown }) => {
          const def = FIGHTERS[id];
          const meta = getDisplayFighterMeta(id, authorizationMode);
          const left = side === 'p1';
          const s = SIDE[side];
          const fade = `linear-gradient(to ${left ? 'right' : 'left'}, black 55%, transparent 98%)`;
          return (
            <div key={side} className={`absolute inset-y-0 w-1/2 ${left ? 'left-0' : 'right-0'}`}>
              <motion.div
                key={`${side}_${id}_${shown}`}
                initial={{ x: left ? -50 : 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="absolute inset-0"
                style={{
                  WebkitMaskImage: `${fade}, linear-gradient(to top, transparent 0%, black 30%)`,
                  maskImage: `${fade}, linear-gradient(to top, transparent 0%, black 30%)`,
                  WebkitMaskComposite: 'source-in',
                  maskComposite: 'intersect',
                }}
              >
                <div
                  className="absolute inset-0"
                  style={{ background: `radial-gradient(ellipse at ${left ? '25%' : '75%'} 70%, ${s.color}66, transparent 65%)` }}
                />
                {shown ? (
                  <FighterArt id={id} side={side} authorizationMode={authorizationMode} />
                ) : (
                  <Silhouette className={`absolute bottom-0 right-[8%] h-[85%] text-black/60`} />
                )}
              </motion.div>

              <div className={`absolute bottom-2 ${left ? 'left-4 sm:left-8' : 'right-4 sm:right-8 text-right'} max-w-[90%]`}>
                <span className={`inline-block px-1.5 font-mono-num text-xs font-black text-white ${s.bg}`}>
                  {side === 'p2' && flow !== 'versus' ? 'CPU' : s.label}
                </span>
                <div className="font-display italic font-black uppercase leading-[0.88] text-[clamp(2rem,11vh,5rem)] drop-shadow-[0_4px_0_rgba(0,0,0,0.9)]">
                  {shown ? meta.name.replace(/^O /, '') : '???'}
                </div>
                {shown && <div className="text-xs text-white/70 font-semibold truncate">{def.title}</div>}
              </div>
            </div>
          );
        })}

        {/* Topo: voltar + título + instrução */}
        <button
          type="button"
          onClick={back}
          aria-label="Voltar"
          className="absolute top-2 left-2 z-20 grid place-items-center w-11 h-11 rounded-full bg-black/50 border border-white/25 active:scale-95 focus-visible:outline-2 focus-visible:outline-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="absolute top-2 inset-x-0 z-10 flex flex-col items-center pointer-events-none">
          <div className="font-display italic font-black tracking-[0.25em] text-base sm:text-lg drop-shadow-[0_2px_0_rgba(0,0,0,0.9)]">
            SELEÇÃO DE PERSONAGEM
          </div>
          <div className={`text-[11px] sm:text-xs font-black tracking-widest ${ui.text}`}>
            {step === 'p1'
              ? `${FLOW_LABEL[flow]} · JOGADOR 1, ESCOLHA SEU LUTADOR`
              : flow === 'versus'
                ? 'VERSUS · JOGADOR 2, ESCOLHA SEU LUTADOR'
                : flow === 'treino'
                  ? 'TREINO · ESCOLHA O BONECO'
                  : 'ESCOLHA O RIVAL'}
          </div>
        </div>
      </main>

      {/* Grade 2 x 8 + confirmar */}
      <section className="relative z-20 flex flex-col items-center gap-1.5 px-2 pb-2 pt-1 bg-gradient-to-t from-black/85 to-transparent">
        <div className="grid grid-cols-8 gap-[3px] p-[3px] bg-white/15 w-[min(100%,calc(8*clamp(38px,10vh,68px)+30px))]">
          {FIGHTERS_LIST.map((def) => {
            const id = def.id;
            const meta = getDisplayFighterMeta(id, authorizationMode);
            const locked = !isPlayableFighter(id);
            const isCursor = current === id;
            const isOther = step === 'p2' && p1Fighter === id;
            return (
              <button
                key={id}
                type="button"
                disabled={locked}
                aria-label={meta.name}
                aria-pressed={isCursor}
                onClick={() => choose(id)}
                onDoubleClick={confirm}
                title={locked ? 'Bloqueado' : meta.name}
                className={`relative aspect-square overflow-hidden bg-gradient-to-b from-[#1b2550] to-[#0b1030] focus-visible:outline-2 focus-visible:outline-white ${
                  locked ? 'grayscale opacity-40 cursor-not-allowed' : ''
                }`}
              >
                {meta.showPortraitPhoto && def.portraitUrl ? (
                  <img src={def.portraitUrl} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover object-top" />
                ) : (
                  <Silhouette className="w-full h-full p-1.5 text-white/25" />
                )}
                {locked && (
                  <span className="absolute inset-0 grid place-items-center bg-black/40">
                    <Lock className="w-4 h-4 text-white/80" />
                  </span>
                )}
                {isOther && <div className={`absolute inset-0 border-[3px] ${SIDE.p1.border}`} />}
                {isCursor && (
                  <div className={`absolute inset-0 border-[3px] ${ui.border} shadow-[inset_0_0_12px_rgba(255,255,255,0.35)]`}>
                    <span className={`absolute top-0 left-0 px-0.5 text-[9px] font-black leading-tight ${ui.bg}`}>{ui.label}</span>
                  </div>
                )}
              </button>
            );
          })}
          {Array.from({ length: emptySlots }).map((_, i) => (
            <div key={i} aria-hidden="true" className="aspect-square bg-[#0b1030]" />
          ))}
          <button
            type="button"
            onClick={random}
            aria-label="Aleatório"
            className="aspect-square bg-[#0b1030] grid place-items-center text-white/70 active:scale-95 focus-visible:outline-2 focus-visible:outline-white"
          >
            <Shuffle className="w-5 h-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={confirm}
          className={`min-h-11 w-[min(100%,320px)] font-display italic font-black text-xl tracking-wider text-white ${ui.bg} active:scale-95 focus-visible:outline-2 focus-visible:outline-white shadow-[0_4px_0_rgba(0,0,0,0.6)]`}
          style={{ clipPath: 'polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)' }}
        >
          {step === 'p1' ? (ladderMode ? 'CONFIRMAR E LUTAR' : 'CONFIRMAR') : 'CONFIRMAR E ESCOLHER CENÁRIO'}
        </button>
      </section>
    </div>
  );
}
