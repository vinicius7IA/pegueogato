import { ArrowLeft, ChevronLeft, ChevronRight, Swords, Vote } from 'lucide-react';
import mapaSalvador from '../assets/images/stages/mapa_salvador.jpg';
import { gameAudio } from '../game/audio';
import { ARENAS, isPlayableArena, PLAYABLE_ARENAS } from '../game/catalog';
import { ArenaId } from '../game/types';

interface StageSelectScreenProps {
  selectedArenaId: ArenaId;
  onSelectArena: (id: ArenaId) => void;
  onConfirmFight: () => void;
  onBack: () => void;
  onlineVoteMode?: boolean;
  onOnlineVote?: (id: ArenaId) => void;
}

/** Áreas clicáveis sobre a arte do mapa (em % da imagem 1448x710). */
const HOTSPOTS: Partial<Record<ArenaId, { left: number; top: number; w: number; h: number }>> = {
  farol_barra: { left: 12, top: 28, w: 15, h: 37 },
  favela_salvador: { left: 33.5, top: 59, w: 22, h: 31 },
  pituba: { left: 66, top: 41, w: 25, h: 31 },
};

export function StageSelectScreen({
  selectedArenaId,
  onSelectArena,
  onConfirmFight,
  onBack,
  onlineVoteMode = false,
  onOnlineVote,
}: StageSelectScreenProps) {
  const selected = isPlayableArena(selectedArenaId) ? selectedArenaId : PLAYABLE_ARENAS[0];
  const active = ARENAS[selected];
  const idx = PLAYABLE_ARENAS.indexOf(selected);

  const pick = (id: ArenaId) => {
    gameAudio.playSelectSnap();
    onSelectArena(id);
  };
  const step = (dir: -1 | 1) => pick(PLAYABLE_ARENAS[(idx + dir + PLAYABLE_ARENAS.length) % PLAYABLE_ARENAS.length]);
  const confirm = () => {
    if (selected !== selectedArenaId) onSelectArena(selected);
    gameAudio.ui('confirm');
    if (onlineVoteMode && onOnlineVote) onOnlineVote(selected);
    else onConfirmFight();
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#001ca8] text-white flex flex-col select-none">
      <style>{`
        @keyframes spotPulse { 0%,100% { box-shadow: 0 0 0 3px #ffd400, 0 0 22px 6px rgba(255,212,0,.65) } 50% { box-shadow: 0 0 0 3px #fff, 0 0 34px 12px rgba(255,212,0,.9) } }
        .spot-sel { animation: spotPulse 0.9s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .spot-sel { animation: none; box-shadow: 0 0 0 3px #ffd400 } }
      `}</style>

      {/* Mapa (arte) com áreas clicáveis */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center">
        <div className="relative h-full max-w-full aspect-[1448/710]">
          <img src={mapaSalvador} alt="Mapa de Salvador" className="absolute inset-0 w-full h-full object-contain" draggable={false} />
          {PLAYABLE_ARENAS.map((id) => {
            const spot = HOTSPOTS[id];
            if (!spot) return null;
            const sel = id === selected;
            return (
              <button
                key={id}
                type="button"
                aria-label={ARENAS[id].name}
                aria-pressed={sel}
                onClick={() => pick(id)}
                onDoubleClick={confirm}
                className={`absolute rounded-xl focus-visible:outline-2 focus-visible:outline-white ${sel ? 'spot-sel' : ''}`}
                style={{ left: `${spot.left}%`, top: `${spot.top}%`, width: `${spot.w}%`, height: `${spot.h}%` }}
              />
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            gameAudio.ui('back');
            onBack();
          }}
          aria-label="Voltar"
          className="absolute top-2 left-2 z-10 grid place-items-center w-11 h-11 rounded-full bg-black/55 border border-white/30 active:scale-95 focus-visible:outline-2 focus-visible:outline-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Carrossel inferior */}
      <div className="relative z-10 shrink-0 bg-[#07123f] border-t-4 border-[#1d3fbf] px-2 sm:px-4 pt-2 pb-1.5 flex flex-col items-center gap-1.5">
        <div className="flex items-center justify-center gap-2 sm:gap-3 w-full">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Local anterior"
            className="grid place-items-center w-10 h-14 text-[#ffd400] active:scale-90 focus-visible:outline-2 focus-visible:outline-white"
          >
            <ChevronLeft className="w-9 h-9" strokeWidth={3.5} />
          </button>

          {PLAYABLE_ARENAS.map((id) => {
            const arena = ARENAS[id];
            const sel = id === selected;
            return (
              <button
                key={id}
                type="button"
                onClick={() => pick(id)}
                onDoubleClick={confirm}
                aria-pressed={sel}
                className={`relative w-[clamp(100px,min(19vw,32vh),240px)] aspect-[2/1] overflow-hidden border-[3px] transition focus-visible:outline-2 focus-visible:outline-white ${
                  sel ? 'border-[#ffd400] shadow-[0_0_18px_rgba(255,212,0,0.7)] scale-[1.04]' : 'border-[#ffd400]/40 brightness-75'
                }`}
              >
                {arena.thumbUrl && <img src={arena.thumbUrl} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />}
                <span className="absolute inset-x-0 bottom-0 bg-black/80 font-display italic font-black text-[clamp(0.75rem,2.4vh,1.25rem)] leading-tight py-0.5 text-center uppercase">
                  {arena.name}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Próximo local"
            className="grid place-items-center w-10 h-14 text-[#ffd400] active:scale-90 focus-visible:outline-2 focus-visible:outline-white"
          >
            <ChevronRight className="w-9 h-9" strokeWidth={3.5} />
          </button>
        </div>

        <button
          type="button"
          onClick={confirm}
          className="min-h-10 px-8 flex items-center gap-2 bg-[#ffd400] text-black font-display italic font-black text-lg tracking-wider active:scale-95 focus-visible:outline-2 focus-visible:outline-white shadow-[0_3px_0_rgba(0,0,0,0.6)]"
          style={{ clipPath: 'polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)' }}
        >
          {onlineVoteMode ? <Vote className="w-5 h-5" /> : <Swords className="w-5 h-5" />}
          {onlineVoteMode ? 'VOTAR EM' : 'LUTAR EM'} {active.name.toUpperCase()}
        </button>
      </div>

      <span className="sr-only">Os demais locais estão bloqueados.</span>
    </div>
  );
}
