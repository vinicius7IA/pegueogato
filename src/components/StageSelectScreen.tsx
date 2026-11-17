import { ArrowLeft, Music, Sparkles, Swords, Vote } from 'lucide-react';
import { gameAudio } from '../game/audio';
import { ARENAS, ARENAS_LIST } from '../game/catalog';
import { ArenaId } from '../game/types';
import { ActionButton } from './ui/FightingUI';

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

/** Posição de cada arena no mapa estilizado de Salvador (viewBox 600x400, norte para cima). */
const PINS: Record<ArenaId, { x: number; y: number; dx: number; dy: number; anchor: 'start' | 'end' }> = {
  farol_barra: { x: 128, y: 332, dx: 14, dy: 20, anchor: 'start' },
  gamboa: { x: 158, y: 264, dx: -16, dy: 4, anchor: 'end' },
  elevador_lacerda: { x: 176, y: 222, dx: -16, dy: 4, anchor: 'end' },
  pelourinho: { x: 214, y: 240, dx: 14, dy: 18, anchor: 'start' },
  dique_tororo: { x: 252, y: 204, dx: 14, dy: -4, anchor: 'start' },
  rio_vermelho: { x: 238, y: 288, dx: 12, dy: 26, anchor: 'start' },
  pituba: { x: 294, y: 258, dx: 12, dy: 26, anchor: 'start' },
  orla: { x: 416, y: 188, dx: 12, dy: 26, anchor: 'start' },
  cajazeira: { x: 322, y: 112, dx: 16, dy: 4, anchor: 'start' },
  favela_salvador: { x: 262, y: 152, dx: -16, dy: 4, anchor: 'end' },
};

const LAND =
  '110,350 170,335 215,310 250,296 300,272 350,246 400,214 450,184 500,152 545,118 575,82 570,50 520,40 440,34 360,38 290,50 240,72 232,92 218,112 222,128 205,140 190,165 176,195 160,225 140,262 122,300 108,330';

export function StageSelectScreen({
  selectedArenaId,
  onSelectArena,
  onConfirmFight,
  onBack,
  onlineVoteMode = false,
  onOnlineVote,
}: StageSelectScreenProps) {
  const active = ARENAS[selectedArenaId];

  const confirm = () => {
    gameAudio.playSelectSnap();
    if (onlineVoteMode && onOnlineVote) onOnlineVote(selectedArenaId);
    else onConfirmFight();
  };

  const pick = (id: ArenaId) => {
    gameAudio.playSelectSnap();
    onSelectArena(id);
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0a1a4a] text-slate-100 flex flex-col">
      <style>{`
        @keyframes pinBob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
        @keyframes pinPulse { 0% { opacity: .9; transform: scale(.6) } 100% { opacity: 0; transform: scale(1.8) } }
        .pin-sel { animation: pinBob .7s ease-in-out infinite; }
        .pin-ring { transform-box: fill-box; transform-origin: center; animation: pinPulse 1.1s ease-out infinite; }
        @media (prefers-reduced-motion: reduce) { .pin-sel, .pin-ring { animation: none } }
      `}</style>

      <header className="relative z-20 flex items-center gap-3 px-3 sm:px-5 py-1.5 sm:py-2.5">
        <button
          type="button"
          onClick={() => {
            gameAudio.playClick();
            onBack();
          }}
          aria-label="Voltar"
          className="grid place-items-center w-11 h-11 sf-chamfer-sm bg-black/60 border border-white/25 hover:border-sf-gold focus-visible:outline-2 focus-visible:outline-sf-gold"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display italic font-black text-xl sm:text-3xl tracking-wider text-white drop-shadow-[0_2px_0_rgba(0,0,0,0.9)]">
          {onlineVoteMode ? 'VOTE NA ARENA' : 'ESCOLHA O LOCAL DA LUTA'}
        </h1>
      </header>

      <main className="relative z-10 flex-1 min-h-0 flex flex-col landscape:flex-row md:flex-row gap-2 px-2 sm:px-4 pb-2">
        {/* Mapa */}
        <div className="relative flex-1 min-h-0 min-w-0 border-2 border-white/30 bg-gradient-to-b from-[#0b2a86] to-[#061a58] overflow-hidden">
          <svg
            viewBox="0 0 600 400"
            preserveAspectRatio="xMidYMid meet"
            className="absolute inset-0 w-full h-full"
            role="group"
            aria-label="Mapa de Salvador com as arenas"
          >
            <defs>
              <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse">
                <rect width="4" height="2" fill="#000" opacity="0.16" />
              </pattern>
              <pattern id="waves" width="24" height="12" patternUnits="userSpaceOnUse">
                <path d="M0 6 q6 -6 12 0 t12 0" stroke="#3a6bff" strokeWidth="1.2" fill="none" opacity="0.35" />
              </pattern>
            </defs>

            <rect width="600" height="400" fill="url(#waves)" />

            {/* Ilha de Itaparica */}
            <polygon
              points="30,250 70,225 105,236 110,272 85,310 50,322 28,290"
              fill="#c8a45a"
              stroke="#5a3a12"
              strokeWidth="3"
              strokeLinejoin="round"
              shapeRendering="crispEdges"
            />
            {/* Salvador (península) */}
            <polygon
              points={LAND}
              fill="#d8b46a"
              stroke="#5a3a12"
              strokeWidth="4"
              strokeLinejoin="round"
              shapeRendering="crispEdges"
            />
            <polygon points="300,272 350,246 400,214 450,184 500,152 545,118 575,82 560,90 520,125 470,160 420,195 370,228 320,260" fill="#f1d58f" opacity="0.7" />
            {/* Dique do Tororó */}
            <ellipse cx="238" cy="196" rx="9" ry="5" fill="#3a6bff" stroke="#1d3fa8" strokeWidth="1.5" />

            {/* Rótulos de água */}
            <g fontFamily="Barlow Condensed, sans-serif" fontWeight="800" fontStyle="italic" fill="#9fc0ff" opacity="0.9">
              <text x="40" y="150" fontSize="13">BAÍA DE</text>
              <text x="40" y="166" fontSize="13">TODOS OS SANTOS</text>
              <text x="44" y="342" fontSize="11">ILHA DE ITAPARICA</text>
              <text x="470" y="300" fontSize="15">OCEANO ATLÂNTICO</text>
            </g>
            <text x="560" y="385" fontSize="14" fontWeight="900" fill="#fff" fontFamily="Barlow Condensed, sans-serif">N ↑</text>

            {/* Marcadores */}
            {ARENAS_LIST.map((arena) => {
              const pin = PINS[arena.id];
              if (!pin) return null;
              const sel = arena.id === selectedArenaId;
              return (
                <g
                  key={arena.id}
                  role="button"
                  tabIndex={0}
                  aria-label={arena.name}
                  aria-pressed={sel}
                  onClick={() => pick(arena.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      pick(arena.id);
                    }
                  }}
                  className="cursor-pointer outline-none"
                >
                  <circle cx={pin.x} cy={pin.y - 10} r="26" fill="transparent" />
                  {sel && <circle className="pin-ring" cx={pin.x} cy={pin.y} r="14" fill="none" stroke="#ffc815" strokeWidth="3" />}
                  <g className={sel ? 'pin-sel' : ''}>
                    <line x1={pin.x} y1={pin.y} x2={pin.x} y2={pin.y - 26} stroke="#2a1a08" strokeWidth="3" />
                    <rect
                      x={pin.x}
                      y={pin.y - 28}
                      width={sel ? 26 : 20}
                      height={sel ? 17 : 13}
                      fill={arena.accentHex}
                      stroke="#fff"
                      strokeWidth="2"
                      shapeRendering="crispEdges"
                    />
                  </g>
                  <circle cx={pin.x} cy={pin.y} r="4" fill="#2a1a08" />
                  <text
                    x={pin.x + pin.dx}
                    y={pin.y + pin.dy}
                    textAnchor={pin.anchor}
                    fontFamily="Barlow Condensed, sans-serif"
                    fontWeight="900"
                    fontStyle="italic"
                    fontSize={sel ? 17 : 14}
                    fill={sel ? '#ffc815' : '#ffffff'}
                    stroke="#1a0f04"
                    strokeWidth="4"
                    paintOrder="stroke"
                    strokeLinejoin="round"
                  >
                    {arena.shortName.toUpperCase()}
                  </text>
                </g>
              );
            })}

            <rect width="600" height="400" fill="url(#scan)" pointerEvents="none" />
          </svg>
        </div>

        {/* Painel da arena escolhida */}
        <aside className="shrink-0 landscape:w-[34%] md:w-[34%] md:max-w-[340px] flex flex-col justify-between gap-2 sf-chamfer bg-black/70 border border-sf-gold/50 p-3 sm:p-4">
          <div className="min-w-0 space-y-1.5">
            <div className="text-[11px] font-bold text-sf-gold truncate">{active.district}</div>
            <h2 className="font-display italic font-black text-white leading-[0.95] text-[clamp(1.5rem,6vh,2.6rem)]">
              {active.name}
            </h2>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-bold">
              <span className="text-sf-cyan">{TIME_LABELS[active.timeOfDay]}</span>
              <span className="flex items-center gap-1 text-emerald-300">
                <Music className="w-3 h-3" /> {MUSIC_LABELS[active.musicStyle]}
              </span>
            </div>
            <p className="hidden [@media(min-height:420px)]:flex gap-1.5 text-xs text-slate-300">
              <Sparkles className="w-4 h-4 text-sf-gold shrink-0" />
              {active.interactiveFeature}
            </p>
          </div>

          <ActionButton variant="gold" size="lg" className="w-full" onClick={confirm}>
            {onlineVoteMode ? (
              <>
                <Vote className="w-5 h-5" /> VOTAR
              </>
            ) : (
              <>
                <Swords className="w-5 h-5" /> LUTAR AQUI
              </>
            )}
          </ActionButton>
        </aside>
      </main>

      {/* Faixa de atalhos, como a fileira de rostos do jogo clássico */}
      <nav
        aria-label="Arenas"
        className="relative z-20 flex gap-1.5 overflow-x-auto px-2 sm:px-4 pb-2 pt-1 bg-black/50"
      >
        {ARENAS_LIST.map((arena) => {
          const sel = arena.id === selectedArenaId;
          return (
            <button
              key={arena.id}
              type="button"
              onClick={() => pick(arena.id)}
              className={`shrink-0 min-h-10 px-3 sf-chamfer-sm border-2 text-[11px] font-black uppercase tracking-wide transition active:scale-95 focus-visible:outline-2 focus-visible:outline-sf-gold ${
                sel ? 'border-sf-gold bg-sf-gold/20 text-sf-gold' : 'border-white/20 bg-sf-ink/80 text-slate-200'
              }`}
            >
              <span
                aria-hidden="true"
                className="inline-block w-2.5 h-2.5 mr-1.5 align-middle"
                style={{ backgroundColor: arena.accentHex }}
              />
              {arena.shortName}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
