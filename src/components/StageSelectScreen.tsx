import { MapPin, Music, Sparkles, Swords, Vote } from 'lucide-react';
import { motion } from 'motion/react';
import { gameAudio } from '../game/audio';
import { ARENAS, ARENAS_LIST } from '../game/catalog';
import { ArenaId } from '../game/types';
import { ActionButton, ScreenHeader, StreetPanel } from './ui/FightingUI';

interface StageSelectScreenProps {
  selectedArenaId: ArenaId;
  onSelectArena: (id: ArenaId) => void;
  onConfirmFight: () => void;
  onBack: () => void;
  onlineVoteMode?: boolean;
  onOnlineVote?: (id: ArenaId) => void;
}

const TIME_LABELS: Record<string, string> = {
  manha: 'Manhã Solar',
  meio_dia: 'Sol a Pino',
  tarde: 'Tarde Baiana',
  por_do_sol: 'Pôr do Sol',
  crepusculo: 'Crepúsculo',
  noite: 'Noite Boêmia',
};

const MUSIC_LABELS: Record<string, string> = {
  samba_reggae: 'Samba-Reggae',
  pagode_rua: 'Pagode de Rua',
  ijexa: 'Ijexá',
  percussao_baiana: 'Percussão SSA',
};

export function StageSelectScreen({
  selectedArenaId,
  onSelectArena,
  onConfirmFight,
  onBack,
  onlineVoteMode = false,
  onOnlineVote,
}: StageSelectScreenProps) {
  const activeArena = ARENAS[selectedArenaId];

  return (
    <div className="w-full h-full overflow-y-auto bg-sf-bg text-slate-100 flex flex-col sf-halftone-bg">
      <ScreenHeader
        title={onlineVoteMode ? 'VOTAR NA ARENA ONLINE' : 'ARENAS DE SALVADOR'}
        subtitle="10 cenários 3D com iluminação dinâmica e trilha percussiva própria"
        onBack={onBack}
        rightSlot={<MapPin className="w-5 h-5 text-sf-gold" />}
      />

      <main className="flex-1 p-4 sm:p-5 max-w-6xl w-full mx-auto flex flex-col gap-5">
        {/* Highlight Banner for Active Arena */}
        <motion.div
          key={activeArena.id}
          initial={{ opacity: 0.6, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <StreetPanel
            tone="gold"
            chamfer="lg"
            className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-20"
              style={{
                background: `radial-gradient(circle at 85% 40%, ${activeArena.accentHex}, transparent 60%)`,
              }}
            />
            <div className="relative z-10 space-y-2 min-w-0">
              {/* Unboxed typographic metadata strip */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-300">
                <span className="text-sf-gold">{activeArena.district}</span>
                <span aria-hidden="true" className="text-white/25">
                  ·
                </span>
                <span className="text-sf-cyan">{TIME_LABELS[activeArena.timeOfDay]}</span>
                <span aria-hidden="true" className="text-white/25">
                  ·
                </span>
                <span className="flex items-center gap-1 text-emerald-300">
                  <Music className="w-3.5 h-3.5" /> {MUSIC_LABELS[activeArena.musicStyle]}
                </span>
              </div>

              <h2 className="font-display italic text-3xl sm:text-5xl font-black text-white leading-none">
                {activeArena.name}
              </h2>

              <p className="text-xs sm:text-sm text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-sf-gold shrink-0" />
                {activeArena.interactiveFeature}
              </p>
            </div>

            <ActionButton
              variant="gold"
              size="lg"
              className="relative z-10"
              onClick={() => {
                gameAudio.playSelectSnap();
                if (onlineVoteMode && onOnlineVote) {
                  onOnlineVote(selectedArenaId);
                } else {
                  onConfirmFight();
                }
              }}
            >
              {onlineVoteMode ? (
                <>
                  <Vote className="w-5 h-5" /> VOTAR EM {activeArena.shortName.toUpperCase()}
                </>
              ) : (
                <>
                  <Swords className="w-5 h-5" /> LUTAR EM {activeArena.shortName.toUpperCase()}
                </>
              )}
            </ActionButton>
          </StreetPanel>
        </motion.div>

        {/* 10 Salvador Maps Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {ARENAS_LIST.map((arena) => {
            const active = arena.id === selectedArenaId;
            return (
              <motion.button
                key={arena.id}
                type="button"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  gameAudio.playSelectSnap();
                  onSelectArena(arena.id);
                }}
                className={`relative sf-chamfer border p-3.5 text-left flex flex-col justify-between gap-2.5 transition-all duration-150 focus-visible:outline-2 focus-visible:outline-sf-gold ${
                  active
                    ? 'bg-[#171d2c] border-sf-gold shadow-md'
                    : 'bg-sf-surface border-white/12 hover:border-white/35'
                }`}
              >
                <div className="space-y-1.5">
                  <div
                    className="w-full h-1.5"
                    style={{ backgroundColor: arena.accentHex }}
                  />
                  <div className="text-[11px] font-bold text-slate-400 truncate">
                    {TIME_LABELS[arena.timeOfDay]}
                  </div>
                </div>
                <div>
                  <div className="font-display italic text-xl font-black text-white leading-tight truncate">
                    {arena.shortName}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">{arena.district}</div>
                </div>
                <div className="text-[11px] font-bold text-sf-gold truncate">
                  {MUSIC_LABELS[arena.musicStyle]}
                </div>
              </motion.button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
