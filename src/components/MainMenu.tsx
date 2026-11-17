import { ChevronLeft, ChevronRight, Globe, ShoppingBag, User } from 'lucide-react';
import { motion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import salvadorBackdrop from '../assets/images/salvador_arena_cinematic_1794790674658.jpg';
import { gameAudio } from '../game/audio';
import { ARENAS, FIGHTERS, PLAYABLE_ARENAS, PLAYABLE_FIGHTERS } from '../game/catalog';

export type MenuOption = 'arcade' | 'versus' | 'torneio' | 'treino' | 'config' | 'creditos';

const OPTIONS: Array<{ id: MenuOption; label: string; hint: string }> = [
  { id: 'arcade', label: 'MODO ARCADE', hint: 'Enfrente a CPU por Salvador' },
  { id: 'versus', label: 'VERSUS', hint: 'Dois jogadores no mesmo celular' },
  { id: 'torneio', label: 'TORNEIO', hint: 'Chave eliminatória até a final' },
  { id: 'treino', label: 'TREINO', hint: 'Pratique combos sem pressão' },
  { id: 'config', label: 'CONFIGURAÇÕES', hint: 'Som, controles e dificuldade' },
  { id: 'creditos', label: 'CRÉDITOS', hint: 'Quem fez o Bahia Stretat' },
];

interface MainMenuProps {
  onSelect: (option: MenuOption) => void;
  onOpenShop: () => void;
  onOpenProfile: () => void;
  onOpenOnline: () => void;
}

/** Logo do jogo (tipografia própria, sem escudos de clubes). */
export function StretatLogo({ size = 1 }: { size?: number }) {
  return (
    <div className="relative leading-[0.82] select-none" style={{ fontSize: `${size}rem` }}>
      <div
        aria-hidden="true"
        className="absolute -left-[10%] top-[18%] w-[130%] h-[46%] -skew-x-12 bg-[repeating-linear-gradient(0deg,#e11d2e_0,#e11d2e_14%,#fff_14%,#fff_28%)] opacity-90"
        style={{ clipPath: 'polygon(0 30%, 100% 0, 92% 100%, 4% 85%)' }}
      />
      <div
        className="relative font-display italic font-black text-[3.6em] tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-[#7fb0ff] via-[#2f6bff] to-[#0b2a8a]"
        style={{ WebkitTextStroke: '0.06em #ffffff', filter: 'drop-shadow(0.06em 0.08em 0 #000)' }}
      >
        BAHIA
      </div>
      <div
        className="relative ml-[0.9em] -mt-[0.35em] font-display italic font-black text-[2.7em] tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-[#ff6b75] via-[#e11d2e] to-[#7f0d16]"
        style={{ WebkitTextStroke: '0.05em #ffffff', filter: 'drop-shadow(0.06em 0.08em 0 #000)' }}
      >
        STRETAT
      </div>
    </div>
  );
}

export function MainMenu({ onSelect, onOpenShop, onOpenProfile, onOpenOnline }: MainMenuProps) {
  const [index, setIndex] = useState(0);

  const move = useCallback((dir: number) => {
    gameAudio.playClick();
    setIndex((i) => (i + dir + OPTIONS.length) % OPTIONS.length);
  }, []);

  const confirm = useCallback(
    (i: number) => {
      gameAudio.unlockAudio();
      gameAudio.ui('confirm');
      onSelect(OPTIONS[i].id);
    },
    [onSelect],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 's') move(1);
      else if (e.key === 'ArrowUp' || e.key === 'w') move(-1);
      else if (e.key === 'Enter' || e.key === ' ' || e.key === 'j') confirm(index);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, move, confirm]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0a1f8f] text-white select-none">
      <img src={salvadorBackdrop} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover opacity-55 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-br from-[#0b2fb8]/85 via-[#0a1f8f]/40 to-[#061566]/90 pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none opacity-25 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.35)_0px,rgba(0,0,0,0.35)_1px,transparent_1px,transparent_3px)]" />

      <div className="relative h-full grid grid-cols-[minmax(0,38%)_1fr] grid-rows-[1fr_auto] gap-x-3 px-3 sm:px-6 pt-2 sm:pt-4" style={{ paddingLeft: 'max(12px, env(safe-area-inset-left))' }}>
        {/* Coluna esquerda: logo + lista de modos */}
        <div className="flex flex-col min-h-0 gap-2">
          <motion.div initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.35 }}>
            <StretatLogo size={0.95} />
          </motion.div>

          <nav aria-label="Menu principal" className="relative flex-1 min-h-0 flex flex-col justify-center bg-[#071043]/85 border-2 border-white/40 rounded-md px-2 py-1.5 max-w-[300px]">
            {OPTIONS.map((opt, i) => {
              const sel = i === index;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onPointerEnter={() => setIndex(i)}
                  onClick={() => confirm(i)}
                  className={`relative flex items-center gap-1 min-h-[30px] px-2 text-left font-display italic font-black tracking-wide text-[clamp(0.85rem,4.4vh,1.35rem)] leading-none focus-visible:outline-2 focus-visible:outline-white ${
                    sel ? 'text-[#ffd400]' : 'text-white'
                  }`}
                >
                  {sel && (
                    <motion.span
                      layoutId="menu-sel"
                      className="absolute inset-0 border-[3px] border-[#ffd400] rounded shadow-[0_0_14px_rgba(255,212,0,0.6)]"
                      transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                    />
                  )}
                  {sel && <ChevronLeft className="absolute -left-5 w-5 h-5 text-[#ffd400]" strokeWidth={4} />}
                  <span className="relative">{opt.label}</span>
                  {sel && <ChevronRight className="absolute -right-5 w-5 h-5 text-[#ffd400]" strokeWidth={4} />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Direita: slogan + atalhos + cartões */}
        <div className="relative flex flex-col justify-between min-h-0">
          <div className="flex items-start justify-end gap-2">
            <div className="mr-auto mt-1 font-display italic font-black text-[clamp(1rem,5.5vh,2rem)] leading-[0.95] -rotate-6 text-white drop-shadow-[0_3px_0_#000] text-right ml-auto">
              A BAHIA É<br />O NOSSO RINGUE!
              <div className="h-1 mt-1 bg-[#e11d2e] -skew-x-12" />
            </div>
            <div className="flex gap-1.5">
              {[
                { label: 'Loja', icon: ShoppingBag, fn: onOpenShop },
                { label: 'Perfil', icon: User, fn: onOpenProfile },
                { label: 'Online', icon: Globe, fn: onOpenOnline },
              ].map(({ label, icon: Icon, fn }) => (
                <button
                  key={label}
                  type="button"
                  aria-label={label}
                  onClick={() => {
                    gameAudio.playClick();
                    fn();
                  }}
                  className="grid place-items-center w-11 h-11 rounded-full bg-black/50 border-2 border-white/40 active:scale-95 focus-visible:outline-2 focus-visible:outline-white"
                >
                  <Icon className="w-5 h-5" />
                </button>
              ))}
            </div>
          </div>

          <div className="text-right text-xs sm:text-sm font-bold text-white/85 drop-shadow-[0_2px_0_#000] pr-1">{OPTIONS[index].hint}</div>

          {/* Cartões: personagens e cenários */}
          <div className="flex items-end gap-2 sm:gap-3 pb-1.5 justify-end">
            <div className="bg-[#071043]/85 border-2 border-white/30 rounded-md p-1.5">
              <div className="inline-block -mt-4 mb-1 px-2 bg-[#e11d2e] font-display italic font-black text-[clamp(0.7rem,3vh,1rem)] -skew-x-6 shadow">SELEÇÃO DE PERSONAGEM</div>
              <div className="flex gap-1.5">
                {PLAYABLE_FIGHTERS.map((id, i) => (
                  <div key={id} className={`relative w-[clamp(64px,14vh,104px)] aspect-[4/5] overflow-hidden border-2 ${i === 0 ? 'border-[#4c86ff] bg-[#1d4ed8]' : 'border-[#ff5a66] bg-[#b3121f]'}`}>
                    {FIGHTERS[id].portraitUrl && <img src={FIGHTERS[id].portraitUrl} alt="" className="absolute inset-0 w-full h-full object-cover object-top" />}
                    <span className={`absolute top-0 left-0 px-1 text-[10px] font-black ${i === 0 ? 'bg-[#1d4ed8]' : 'bg-[#e11d2e]'}`}>{i === 0 ? '1P' : '2P'}</span>
                    <span className="absolute inset-x-0 bottom-0 bg-black/80 font-display italic font-black text-[clamp(0.55rem,2.2vh,0.8rem)] text-center leading-tight truncate px-0.5">
                      {FIGHTERS[id].name.replace(/^O /, '')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="hidden min-[700px]:block bg-[#071043]/85 border-2 border-white/30 rounded-md p-1.5">
              <div className="inline-block -mt-4 mb-1 px-2 bg-[#e11d2e] font-display italic font-black text-[clamp(0.7rem,3vh,1rem)] -skew-x-6 shadow">SELEÇÃO DE CENÁRIO</div>
              <div className="flex gap-1.5">
                {PLAYABLE_ARENAS.map((id, i) => (
                  <div key={id} className={`relative w-[clamp(84px,19vh,140px)] aspect-[4/3] overflow-hidden border-2 ${i === 0 ? 'border-[#ffd400]' : 'border-white/40'}`}>
                    {ARENAS[id].thumbUrl && <img src={ARENAS[id].thumbUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                    <span className="absolute inset-x-0 bottom-0 bg-black/80 font-display italic font-black text-[clamp(0.55rem,2.2vh,0.8rem)] text-center leading-tight truncate">{ARENAS[id].name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Barra de comandos */}
        <div className="col-span-2 -mx-6 flex items-center justify-center gap-4 sm:gap-8 py-1 bg-gradient-to-r from-[#e11d2e] via-[#060b2b] to-[#e11d2e] text-[11px] sm:text-sm font-black tracking-wide">
          <span className="flex items-center gap-1.5"><span className="text-base">✥</span> SELECIONAR</span>
          <span className="flex items-center gap-1.5"><span className="grid place-items-center w-5 h-5 rounded-full bg-[#22c55e] text-black">A</span> CONFIRMAR</span>
          <span className="flex items-center gap-1.5"><span className="grid place-items-center w-5 h-5 rounded-full bg-[#e11d2e]">B</span> VOLTAR</span>
        </div>
      </div>
    </div>
  );
}
