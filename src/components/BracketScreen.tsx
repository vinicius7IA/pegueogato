import { ArrowLeft, Swords, Trophy } from 'lucide-react';
import { motion } from 'motion/react';
import { gameAudio } from '../game/audio';
import { ARENAS, ArcadeStageDef, FIGHTERS } from '../game/catalog';
import { FighterId } from '../game/types';

interface BracketScreenProps {
  ladder: ArcadeStageDef[];
  currentStage: number; // 1-based: próxima luta
  p1Fighter: FighterId;
  p1Name: string;
  onFight: () => void;
  onBack: () => void;
}

/** Chave do Torneio Baiano: mostra o caminho até a final e a próxima luta. */
export function BracketScreen({ ladder, currentStage, p1Fighter, p1Name, onFight, onBack }: BracketScreenProps) {
  const next = ladder[Math.min(ladder.length, Math.max(1, currentStage)) - 1];
  return (
    <div className="relative w-full h-full overflow-hidden bg-gradient-to-b from-[#0b2fb8] to-[#060b2b] text-white flex flex-col">
      <header className="flex items-center gap-3 px-3 pt-2">
        <button
          type="button"
          onClick={() => {
            gameAudio.playClick();
            onBack();
          }}
          aria-label="Voltar ao menu"
          className="grid place-items-center w-11 h-11 rounded-full bg-black/50 border-2 border-white/40 active:scale-95"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display italic font-black text-2xl sm:text-4xl tracking-wide">TORNEIO BAIANO</h1>
        <Trophy className="w-7 h-7 text-[#ffd400] ml-auto" />
      </header>

      <main className="flex-1 min-h-0 flex items-center justify-center gap-2 sm:gap-4 px-3">
        {ladder.map((m, i) => {
          const done = i + 1 < currentStage;
          const cur = i + 1 === currentStage;
          const [phase, nick] = m.title.split(' · ');
          return (
            <motion.div
              key={m.stage}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.08 }}
              className={`relative flex-1 max-w-[190px] rounded-md border-[3px] p-2 text-center ${
                cur ? 'border-[#ffd400] bg-black/50 shadow-[0_0_18px_rgba(255,212,0,0.6)]' : done ? 'border-emerald-400/70 bg-black/40' : 'border-white/25 bg-black/30'
              }`}
            >
              <div className="font-display italic font-black text-[#ffd400] text-sm sm:text-lg">{phase.toUpperCase()}</div>
              <div className="relative mx-auto my-1 w-14 h-14 sm:w-20 sm:h-20 overflow-hidden rounded border-2 border-[#ff2b3a] bg-[#b3121f]">
                {FIGHTERS[m.opponentId].portraitUrl && <img src={FIGHTERS[m.opponentId].portraitUrl} alt="" className={`w-full h-full object-cover object-top ${done ? 'grayscale' : ''}`} />}
                {done && <span className="absolute inset-0 grid place-items-center text-2xl font-black text-emerald-300 bg-black/40">✓</span>}
              </div>
              <div className="text-xs sm:text-sm font-black truncate">{nick}</div>
              <div className="text-[10px] sm:text-xs text-white/70 truncate">{ARENAS[m.arenaId].name}</div>
            </motion.div>
          );
        })}
      </main>

      <footer className="flex items-center justify-center gap-3 pb-3 px-3">
        <div className="text-sm font-bold truncate">
          <span className="text-[#4c86ff]">{p1Name}</span> ({FIGHTERS[p1Fighter].name.replace(/^O /, '')}) vs{' '}
          <span className="text-[#ff5a66]">{next.title.split(' · ')[1]}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            gameAudio.playSelectSnap();
            onFight();
          }}
          className="min-h-11 px-8 flex items-center gap-2 bg-[#ffd400] text-black font-display italic font-black text-xl tracking-wider active:scale-95"
          style={{ clipPath: 'polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)' }}
        >
          <Swords className="w-5 h-5" /> LUTAR
        </button>
      </footer>
    </div>
  );
}
