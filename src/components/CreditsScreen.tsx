import { ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { gameAudio } from '../game/audio';
import { StretatLogo } from './MainMenu';

const CREDITS: Array<{ role: string; names: string[] }> = [
  { role: 'Criação e Direção', names: ['Equipe Bahia Stretat'] },
  { role: 'Arte dos Personagens e Cenários', names: ['Fichas e cenários originais do projeto'] },
  { role: 'Programação e Game Design', names: ['Desenvolvido com Claude Code'] },
  { role: 'Motor', names: ['Three.js · React · Vite'] },
  { role: 'Áudio', names: ['Trilhas e efeitos originais gerados para o jogo', 'Vozes sintéticas em português (Piper TTS)'] },
  { role: 'Personagens', names: ['Beto Chuta-Porta', 'Maluco do Gato'] },
  { role: 'Agradecimento especial', names: ['Salvador, Bahia — o nosso ringue!'] },
  { role: 'Aviso', names: ['Obra de paródia e ficção.', 'Personagens e nomes são fictícios.'] },
];

export function CreditsScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="relative w-full h-full overflow-hidden bg-[#060b2b] text-white">
      <div className="absolute inset-0 pointer-events-none opacity-25 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.35)_0px,rgba(0,0,0,0.35)_1px,transparent_1px,transparent_3px)]" />
      <button
        type="button"
        onClick={() => {
          gameAudio.playClick();
          onBack();
        }}
        aria-label="Voltar"
        className="absolute top-3 left-3 z-10 grid place-items-center w-11 h-11 rounded-full bg-black/50 border-2 border-white/40 active:scale-95"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
      <motion.div
        className="absolute inset-x-0 flex flex-col items-center gap-6 text-center px-6"
        initial={{ y: '100vh' }}
        animate={{ y: '-120%' }}
        transition={{ duration: 28, ease: 'linear', repeat: Infinity }}
      >
        <StretatLogo size={0.8} />
        {CREDITS.map((c) => (
          <div key={c.role}>
            <div className="font-display italic font-black text-[#ffd400] text-xl tracking-wider">{c.role.toUpperCase()}</div>
            {c.names.map((n) => (
              <div key={n} className="text-base font-semibold">
                {n}
              </div>
            ))}
          </div>
        ))}
        <div className="font-display italic font-black text-3xl mt-6">A BAHIA É O NOSSO RINGUE!</div>
      </motion.div>
    </div>
  );
}
