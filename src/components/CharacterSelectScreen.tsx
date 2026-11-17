import { ArrowLeft, Box, MapPin, Package, Shuffle, Sparkles, Swords, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import salvadorBackdrop from '../assets/images/salvador_arena_cinematic_1794790674658.jpg';
import { gameAudio } from '../game/audio';
import {
  ARENAS,
  FIGHTER_ROSTER_CAPACITY,
  FIGHTERS,
  FIGHTERS_LIST,
  getDisplayFighterMeta,
  getMasteryLevel,
  POWERS,
  SKINS,
} from '../game/catalog';
import { AiDifficulty, ArenaId, FighterId, MatchMode, PlayerProfile, PowerId } from '../game/types';
import { FighterPreview3D } from './FighterPreview3D';
import { ActionButton, SegmentedTabs, StatGauge } from './ui/FightingUI';

interface CharacterSelectScreenProps {
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

const STAT_LABELS: Array<{ key: keyof typeof FIGHTERS.policial.stats; label: string }> = [
  { key: 'forca', label: 'Força' },
  { key: 'velocidade', label: 'Velocidade' },
  { key: 'resistencia', label: 'Resistência' },
  { key: 'energia', label: 'Energia' },
  { key: 'habilidadeEspecial', label: 'Especial' },
];

const ARCHETYPE_NAMES: Record<string, string> = {
  rapido: 'Veloz',
  bruto: 'Bruto',
  tecnico: 'Técnico',
  trapaceiro: 'Trapaceiro',
  zoneador: 'Zoneador',
};

export function CharacterSelectScreen({
  profile,
  initialDifficulty,
  authorizationMode,
  arenaId,
  p1Fighter,
  p2Fighter,
  onSelectP1,
  onSelectP2,
  onEquipSkin,
  onEquipPower,
  onOpenStageSelect,
  onStartFight,
  onOpenInventory,
  onBack,
}: CharacterSelectScreenProps) {
  const [slotTab, setSlotTab] = useState<'p1' | 'p2'>('p1');
  const [difficulty, setDifficulty] = useState<AiDifficulty>(initialDifficulty);
  const [countdown, setCountdown] = useState(45);
  const [show3D, setShow3D] = useState(false);

  useEffect(() => {
    const t = window.setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const activeId = slotTab === 'p1' ? p1Fighter : p2Fighter;
  const activeDef = FIGHTERS[activeId];
  const activeMeta = getDisplayFighterMeta(activeId, authorizationMode);
  const p1Meta = getDisplayFighterMeta(p1Fighter, authorizationMode);
  const p2Meta = getDisplayFighterMeta(p2Fighter, authorizationMode);

  const activeSkin = profile.equippedSkins[activeId] || activeDef.defaultSkinId;
  const activePower = profile.equippedPowers[activeId] || activeDef.signaturePowerId;
  const unlockedSkinsForActive = SKINS.filter(
    (s) => s.fighterId === activeId && profile.unlockedSkins.includes(s.id),
  );
  const mastery = getMasteryLevel(profile.fighterMasteryXp[activeId] || 0);

  const handleRandomPick = () => {
    const pool =
      slotTab === 'p1'
        ? FIGHTERS_LIST.filter((f) => profile.unlockedFighters.includes(f.id))
        : FIGHTERS_LIST;
    const choice = pool[Math.floor(Math.random() * pool.length)];
    if (!choice) return;
    gameAudio.playSelectSnap();
    if (slotTab === 'p1') onSelectP1(choice.id);
    else onSelectP2(choice.id);
  };

  const cycleActiveSkin = () => {
    if (unlockedSkinsForActive.length <= 1) return;
    const idx = unlockedSkinsForActive.findIndex((s) => s.id === activeSkin);
    const next = unlockedSkinsForActive[(idx + 1) % unlockedSkinsForActive.length];
    gameAudio.playClick();
    onEquipSkin(activeId, next.id);
  };

  const cycleActivePower = () => {
    if (profile.unlockedPowers.length <= 1) return;
    const idx = profile.unlockedPowers.indexOf(activePower);
    const next = profile.unlockedPowers[(idx + 1) % profile.unlockedPowers.length];
    gameAudio.playClick();
    onEquipPower(activeId, next);
  };

  const sides = [
    { slot: 'p1' as const, id: p1Fighter, meta: p1Meta, tone: 'gold' as const },
    { slot: 'p2' as const, id: p2Fighter, meta: p2Meta, tone: 'cyan' as const },
  ];

  return (
    <div className="relative w-full h-full overflow-hidden bg-sf-bg text-slate-100 flex flex-col">
      <img
        src={salvadorBackdrop}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-sf-bg/70 to-black pointer-events-none" />
      <div className="absolute inset-0 sf-halftone-bg pointer-events-none" />

      {/* Barra superior */}
      <header className="relative z-20 flex items-center justify-between gap-2 px-3 sm:px-5 py-1.5 sm:py-2.5">
        <button
          type="button"
          onClick={() => {
            gameAudio.playClick();
            onBack();
          }}
          aria-label="Voltar"
          className="grid place-items-center w-11 h-11 sf-chamfer-sm bg-sf-ink/90 border border-white/20 hover:border-sf-gold focus-visible:outline-2 focus-visible:outline-sf-gold"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex flex-col items-center leading-none">
          <h1 className="font-display italic font-black text-xl sm:text-3xl tracking-wider text-white drop-shadow-[0_2px_0_rgba(0,0,0,0.9)]">
            SELEÇÃO DE PERSONAGEM
          </h1>
          <span className="font-mono-num text-xs font-black text-sf-gold mt-0.5">
            {String(countdown).padStart(2, '0')}
          </span>
        </div>
        <SegmentedTabs
          items={[
            { id: 'p1', label: 'P1' },
            { id: 'p2', label: 'P2' },
          ]}
          value={slotTab}
          onChange={setSlotTab}
          tone={slotTab === 'p2' ? 'cyan' : 'gold'}
          className="min-w-[110px]"
        />
      </header>

      {/* Palco: lutador P1 | grade | lutador P2 */}
      <main className="relative z-10 flex-1 min-h-0 grid grid-cols-[1fr_minmax(0,auto)_1fr] gap-0 items-stretch">
        {sides.map(({ slot, id, meta, tone }, idx) => {
          const def = FIGHTERS[id];
          const isLeft = idx === 0;
          const active = slotTab === slot;
          const accent = tone === 'gold' ? 'text-sf-gold' : 'text-sf-cyan';
          const glow = tone === 'gold' ? 'from-sf-gold/45' : 'from-sf-cyan/45';
          return (
            <motion.button
              key={`${slot}_${id}`}
              type="button"
              onClick={() => setSlotTab(slot)}
              initial={{ x: isLeft ? -24 : 24, opacity: 0.4 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.22 }}
              aria-label={`Editar ${slot === 'p1' ? 'jogador 1' : 'jogador 2'}`}
              className={`relative overflow-hidden min-w-0 text-left ${isLeft ? '' : 'text-right'} focus-visible:outline-2 focus-visible:outline-sf-gold ${
                active ? '' : 'saturate-50 brightness-75'
              } transition`}
              style={{
                clipPath: isLeft
                  ? 'polygon(0 0, 100% 0, calc(100% - 26px) 100%, 0 100%)'
                  : 'polygon(26px 0, 100% 0, 100% 100%, 0 100%)',
              }}
            >
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(${isLeft ? '120deg' : '240deg'}, ${def.badgeColor}, #07080d 75%)`,
                }}
              />
              {meta.showPortraitPhoto && def.portraitUrl ? (
                <img
                  src={def.portraitUrl}
                  alt={meta.name}
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover object-top"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 flex items-center justify-center font-display italic font-black text-white/25 text-[28vh] leading-none select-none"
                >
                  {meta.name.slice(0, 2)}
                </span>
              )}
              <div className={`absolute inset-0 bg-gradient-to-t ${glow} via-transparent to-black/40`} />
              <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/90 to-transparent" />

              <div className={`absolute top-2 ${isLeft ? 'left-3' : 'right-3'} font-display italic font-black text-sm tracking-widest ${accent} drop-shadow-[0_2px_0_rgba(0,0,0,0.9)]`}>
                {slot === 'p1' ? 'JOGADOR 1' : 'DESAFIANTE'}
              </div>

              <div className={`absolute bottom-2 sm:bottom-4 ${isLeft ? 'left-3 sm:left-5 pr-8' : 'right-3 sm:right-5 pl-8'}`}>
                <div className="font-display italic font-black text-white uppercase leading-[0.9] text-[clamp(1.4rem,6.5vh,3.4rem)] drop-shadow-[0_3px_0_rgba(0,0,0,0.95)] break-words">
                  {meta.name.replace(/^O /, '')}
                </div>
                <div className="text-[11px] sm:text-xs text-slate-300 font-semibold mt-1 truncate">
                  {ARCHETYPE_NAMES[def.archetype]} · {def.title}
                </div>
                <div className="hidden md:block text-[11px] italic text-amber-100/85 mt-0.5 truncate">
                  “{def.catchphrase}”
                </div>
              </div>
            </motion.button>
          );
        })}

        {/* Centro: grade de personagens (posicionada entre os dois painéis) */}
        <div className="col-start-2 row-start-1 relative z-20 flex flex-col items-center justify-center gap-2 px-2 sm:px-4 w-[min(48vw,440px)]">
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2 w-full">
            {FIGHTERS_LIST.map((def) => {
              const id = def.id;
              const meta = getDisplayFighterMeta(id, authorizationMode);
              const unlocked = slotTab === 'p2' || profile.unlockedFighters.includes(id);
              const isP1 = p1Fighter === id;
              const isP2 = p2Fighter === id;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={!unlocked}
                  aria-label={meta.name}
                  title={meta.name}
                  onClick={() => {
                    gameAudio.playSelectSnap();
                    if (slotTab === 'p1') onSelectP1(id);
                    else onSelectP2(id);
                  }}
                  className={`relative aspect-square sf-chamfer-sm border-2 overflow-hidden transition active:scale-95 focus-visible:outline-2 focus-visible:outline-sf-gold ${
                    isP1 && isP2
                      ? 'border-sf-crimson'
                      : isP1
                        ? 'border-sf-gold shadow-[0_0_14px_rgba(255,200,21,0.55)]'
                        : isP2
                          ? 'border-sf-cyan shadow-[0_0_14px_rgba(0,212,255,0.55)]'
                          : 'border-white/20 hover:border-white/60'
                  } ${!unlocked ? 'opacity-35 grayscale cursor-not-allowed' : ''}`}
                >
                  {meta.showPortraitPhoto && def.portraitUrl ? (
                    <img
                      src={def.portraitUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover object-top"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center font-display italic text-lg sm:text-2xl font-black text-white"
                      style={{ backgroundColor: def.badgeColor }}
                    >
                      {meta.name.slice(0, 2)}
                    </div>
                  )}
                  {(isP1 || isP2) && (
                    <div className="absolute top-0 inset-x-0 flex justify-between font-mono-num pointer-events-none">
                      {isP1 && <span className="px-1 bg-sf-gold text-black text-[9px] font-black leading-tight">P1</span>}
                      {isP2 && <span className="ml-auto px-1 bg-sf-cyan text-black text-[9px] font-black leading-tight">P2</span>}
                    </div>
                  )}
                </button>
              );
            })}
            <button
              type="button"
              onClick={handleRandomPick}
              aria-label="Escolha aleatória"
              className="aspect-square sf-chamfer-sm border-2 border-dashed border-sf-gold/60 bg-sf-ink/80 text-sf-gold grid place-items-center active:scale-95 hover:border-sf-gold focus-visible:outline-2 focus-visible:outline-sf-gold"
            >
              <Shuffle className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>

          {/* Ações do lutador ativo */}
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <button type="button" onClick={cycleActiveSkin} className="min-h-9 px-2.5 text-[11px] font-black uppercase text-sf-gold bg-black/80 border border-sf-gold/50 sf-chamfer-sm active:scale-95">
              Skin
            </button>
            <button type="button" onClick={cycleActivePower} className="min-h-9 px-2.5 flex items-center gap-1 text-[11px] font-black uppercase text-sf-cyan bg-black/80 border border-sf-cyan/50 sf-chamfer-sm active:scale-95">
              <Sparkles className="w-3 h-3" /> {POWERS[activePower].shortName}
            </button>
            <button type="button" onClick={() => setShow3D(true)} className="min-h-9 px-2.5 flex items-center gap-1 text-[11px] font-black uppercase text-white bg-black/80 border border-white/30 sf-chamfer-sm active:scale-95">
              <Box className="w-3 h-3" /> 3D
            </button>
            <button
              type="button"
              onClick={() => {
                gameAudio.playClick();
                onOpenInventory();
              }}
              className="min-h-9 px-2.5 flex items-center gap-1 text-[11px] font-black uppercase text-white bg-black/80 border border-white/30 sf-chamfer-sm active:scale-95"
            >
              <Package className="w-3 h-3 text-sf-gold" /> Inventário
            </button>
          </div>

          {/* Atributos (só quando há altura) */}
          <div className="hidden [@media(min-height:560px)]:block w-full max-w-[320px] space-y-1">
            {STAT_LABELS.map(({ key, label }) => (
              <StatGauge key={key} label={label} value={activeDef.stats[key]} tone={slotTab === 'p1' ? 'gold' : 'cyan'} />
            ))}
          </div>
        </div>
      </main>

      {/* Barra inferior: dificuldade, arena, lutar */}
      <footer className="relative z-20 flex items-center justify-center gap-2 sm:gap-3 px-3 sm:px-5 py-1.5 sm:py-3 bg-gradient-to-t from-black/90 to-transparent">
        <SegmentedTabs
          items={[
            { id: 'easy', label: 'Fácil' },
            { id: 'medium', label: 'Médio' },
            { id: 'hard', label: 'Difícil' },
          ]}
          value={difficulty}
          onChange={setDifficulty}
          tone="gold"
          className="hidden sm:flex"
        />
        <ActionButton
          variant="steel"
          onClick={() => {
            gameAudio.playClick();
            onOpenStageSelect();
          }}
        >
          <MapPin className="w-4 h-4 text-sf-gold" />
          {ARENAS[arenaId].shortName}
        </ActionButton>
        <ActionButton
          variant="gold"
          size="lg"
          className="flex-1 max-w-sm"
          onClick={() => {
            gameAudio.playSelectSnap();
            onStartFight('vs_ai', difficulty);
          }}
        >
          <Swords className="w-5 h-5" /> LUTAR
        </ActionButton>
      </footer>

      {/* Pré-visualização 3D */}
      {show3D && (
        <div className="absolute inset-0 z-40 bg-black/85 flex items-center justify-center p-4" onClick={() => setShow3D(false)}>
          <div className="relative w-full max-w-md h-full max-h-[80%] sf-chamfer-lg border border-sf-gold/50 bg-sf-ink overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <FighterPreview3D fighterId={activeId} skinId={activeSkin} authorizationMode={authorizationMode} />
            <div className="absolute bottom-3 left-4 font-display italic font-black text-2xl text-white drop-shadow-[0_2px_0_rgba(0,0,0,0.9)]">
              {activeMeta.name}
            </div>
            <button
              type="button"
              onClick={() => setShow3D(false)}
              aria-label="Fechar"
              className="absolute top-2 right-2 grid place-items-center w-11 h-11 rounded-full bg-black/80 border border-white/30"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
