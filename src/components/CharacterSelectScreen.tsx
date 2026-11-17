import { ArrowLeft, Box, MapPin, Package, Shirt, Shuffle, Sparkles, Swords, X } from 'lucide-react';
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
import { SegmentedTabs } from './ui/FightingUI';

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
  const emptySlots = Math.max(0, FIGHTER_ROSTER_CAPACITY - FIGHTERS_LIST.length - 1);

  return (
    <div className="relative w-full h-full overflow-hidden bg-sf-bg text-slate-100 flex flex-col">
      <img src={salvadorBackdrop} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover opacity-35 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(7,8,13,0.2),rgba(7,8,13,0.92))] pointer-events-none" />

      {/* Topo */}
      <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-2 px-3 sm:px-5 pt-1.5 pointer-events-none [&>*]:pointer-events-auto">
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

      {/* Palco: arte 2D dos dois lutadores, virados para o centro */}
      <main className="relative z-10 flex-1 min-h-0">
        {sides.map(({ slot, id, meta, tone }, idx) => {
          const def = FIGHTERS[id];
          const left = idx === 0;
          const active = slotTab === slot;
          const accent = tone === 'gold' ? 'text-sf-gold' : 'text-sf-cyan';
          const fade = left
            ? 'linear-gradient(to right, black 62%, transparent 100%)'
            : 'linear-gradient(to left, black 62%, transparent 100%)';
          return (
            <motion.div
              key={`${slot}_${id}`}
              initial={{ x: left ? -40 : 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.25 }}
              className={`absolute inset-y-0 w-[56%] ${left ? 'left-0' : 'right-0'}`}
            >
              <button
                type="button"
                aria-label={`Editar ${slot === 'p1' ? 'jogador 1' : 'jogador 2'}`}
                onClick={() => setSlotTab(slot)}
                className={`absolute inset-0 ${active ? '' : 'saturate-50 brightness-75'} transition`}
                style={{ WebkitMaskImage: fade, maskImage: fade }}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(${left ? '100deg' : '260deg'}, ${def.badgeColor}cc, transparent 80%)`,
                  }}
                />
                {meta.showPortraitPhoto && def.portraitUrl ? (
                  <img
                    src={def.portraitUrl}
                    alt={meta.name}
                    referrerPolicy="no-referrer"
                    className={`absolute bottom-0 ${left ? 'left-0' : 'right-0'} h-[94%] w-auto max-w-full object-contain ${left ? 'object-left-bottom' : 'object-right-bottom'}`}
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className={`absolute bottom-[12%] ${left ? 'left-[6%]' : 'right-[6%]'} font-display italic font-black text-white/30 text-[min(46vh,24vw)] leading-none select-none`}
                  >
                    {meta.name.slice(0, 2)}
                  </span>
                )}
              </button>

              <div className={`absolute bottom-1.5 sm:bottom-3 ${left ? 'left-3 sm:left-6' : 'right-3 sm:right-6 text-right'} max-w-[85%] pointer-events-none`}>
                <div className={`text-[11px] font-black tracking-[0.25em] ${accent} drop-shadow-[0_2px_0_rgba(0,0,0,0.9)]`}>
                  {slot === 'p1' ? 'JOGADOR 1' : 'DESAFIANTE'}
                </div>
                <div className="font-display italic font-black text-white uppercase leading-[0.9] text-[clamp(1.8rem,9vh,4.6rem)] drop-shadow-[0_4px_0_rgba(0,0,0,0.95)] break-words">
                  {meta.name.replace(/^O /, '')}
                </div>
                <div className="text-[11px] sm:text-xs text-slate-300 font-semibold mt-0.5 truncate">
                  {ARCHETYPE_NAMES[def.archetype]} · {def.title}
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* Centro: título, VS e ações */}
        <div className="absolute left-1/2 -translate-x-1/2 top-1 z-20 flex flex-col items-center gap-1.5 w-[min(34vw,260px)]">
          <div className="flex items-center gap-1.5 font-display italic font-black text-sm sm:text-base tracking-[0.2em] text-white drop-shadow-[0_2px_0_rgba(0,0,0,0.9)]">
            SELEÇÃO DE PERSONAGEM
          </div>
          <div className="font-display italic font-black text-5xl sm:text-6xl leading-none text-transparent bg-clip-text bg-gradient-to-b from-sf-gold to-sf-crimson drop-shadow-[0_3px_0_rgba(0,0,0,0.9)]">
            VS
          </div>
          <div className="font-mono-num text-xs font-black text-sf-gold">{String(countdown).padStart(2, '0')}</div>
          <button
            type="button"
            onClick={() => {
              gameAudio.playSelectSnap();
              onStartFight('vs_ai', difficulty);
            }}
            className="w-full min-h-11 sf-chamfer-sm bg-gradient-to-r from-sf-gold to-sf-amber text-black font-display italic font-black text-xl tracking-wide flex items-center justify-center gap-2 active:scale-95 focus-visible:outline-2 focus-visible:outline-white sf-cta-glow"
          >
            <Swords className="w-5 h-5" /> LUTAR
          </button>
          <button
            type="button"
            onClick={() => {
              gameAudio.playClick();
              onOpenStageSelect();
            }}
            className="w-full min-h-10 sf-chamfer-sm bg-black/70 border border-white/30 text-xs font-black uppercase flex items-center justify-center gap-1.5 active:scale-95 focus-visible:outline-2 focus-visible:outline-sf-gold"
          >
            <MapPin className="w-4 h-4 text-sf-gold" /> {ARENAS[arenaId].shortName}
          </button>
          <div className="flex gap-1">
            {(['easy', 'medium', 'hard'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDifficulty(d)}
                className={`min-h-9 px-2 text-[10px] font-black uppercase border active:scale-95 ${
                  difficulty === d ? 'bg-sf-gold text-black border-white' : 'bg-black/70 text-slate-300 border-white/25'
                }`}
              >
                {d === 'easy' ? 'Fácil' : d === 'medium' ? 'Médio' : 'Difícil'}
              </button>
            ))}
          </div>
        </div>

        {/* Ações do lutador ativo: coluna na lateral */}
        <div className={`absolute z-20 top-14 flex gap-1.5 ${slotTab === 'p1' ? 'left-2 sm:left-4' : 'right-2 sm:right-4'}`}>
          <button type="button" aria-label="Trocar skin" onClick={cycleActiveSkin} className="min-h-10 min-w-10 px-2 flex items-center gap-1.5 text-[11px] font-black uppercase text-sf-gold bg-black/80 border border-sf-gold/50 sf-chamfer-sm active:scale-95">
            <Shirt className="w-4 h-4" /><span className="hidden xl:inline">Skin</span>
          </button>
          <button type="button" aria-label="Trocar poder" onClick={cycleActivePower} className="min-h-10 min-w-10 px-2 flex items-center gap-1.5 text-[11px] font-black uppercase text-sf-cyan bg-black/80 border border-sf-cyan/50 sf-chamfer-sm active:scale-95">
            <Sparkles className="w-4 h-4" /><span className="hidden xl:inline">{POWERS[activePower].shortName}</span>
          </button>
          <button type="button" aria-label="Ver em 3D" onClick={() => setShow3D(true)} className="min-h-10 min-w-10 px-2 flex items-center gap-1.5 text-[11px] font-black uppercase text-white bg-black/80 border border-white/30 sf-chamfer-sm active:scale-95">
            <Box className="w-4 h-4" /><span className="hidden xl:inline">3D</span>
          </button>
          <button type="button" aria-label="Inventário" onClick={() => { gameAudio.playClick(); onOpenInventory(); }} className="min-h-10 min-w-10 px-2 flex items-center gap-1.5 text-[11px] font-black uppercase text-white bg-black/80 border border-white/30 sf-chamfer-sm active:scale-95">
            <Package className="w-4 h-4 text-sf-gold" /><span className="hidden xl:inline">Inventário</span>
          </button>
        </div>
      </main>

      {/* Grade de personagens: 2 fileiras x 8 vagas, como no jogo de referência */}
      <section className="relative z-30 px-2 sm:px-4 pb-1.5 pt-1 bg-gradient-to-t from-black via-black/80 to-transparent">
        <div className="mx-auto grid grid-cols-8 gap-1 w-[min(100%,calc(8*clamp(40px,11vh,72px)+7*4px))]">
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
                className={`relative aspect-square border-2 overflow-hidden transition active:scale-95 focus-visible:outline-2 focus-visible:outline-sf-gold ${
                  isP1 && isP2
                    ? 'border-sf-crimson'
                    : isP1
                      ? 'border-sf-gold shadow-[0_0_12px_rgba(255,200,21,0.7)] z-10'
                      : isP2
                        ? 'border-sf-cyan shadow-[0_0_12px_rgba(0,212,255,0.7)] z-10'
                        : 'border-white/25 hover:border-white/60'
                } ${!unlocked ? 'opacity-35 grayscale cursor-not-allowed' : ''}`}
              >
                {meta.showPortraitPhoto && def.portraitUrl ? (
                  <img src={def.portraitUrl} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover object-top" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-display italic text-base sm:text-xl font-black text-white" style={{ backgroundColor: def.badgeColor }}>
                    {meta.name.slice(0, 2)}
                  </div>
                )}
                {(isP1 || isP2) && (
                  <div className="absolute top-0 inset-x-0 flex justify-between font-mono-num pointer-events-none">
                    {isP1 && <span className="px-0.5 bg-sf-gold text-black text-[8px] font-black leading-tight">1P</span>}
                    {isP2 && <span className="ml-auto px-0.5 bg-sf-cyan text-black text-[8px] font-black leading-tight">2P</span>}
                  </div>
                )}
              </button>
            );
          })}
          {Array.from({ length: emptySlots }).map((_, i) => (
            <div key={`empty_${i}`} aria-hidden="true" className="aspect-square border-2 border-white/10 bg-black/60 grid place-items-center text-white/20 font-display italic font-black text-xl">
              ?
            </div>
          ))}
          <button
            type="button"
            onClick={handleRandomPick}
            aria-label="Escolha aleatória"
            className="aspect-square border-2 border-dashed border-sf-gold/60 bg-black/70 text-sf-gold grid place-items-center active:scale-95 hover:border-sf-gold focus-visible:outline-2 focus-visible:outline-sf-gold"
          >
            <Shuffle className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Pré-visualização 3D */}
      {show3D && (
        <div className="absolute inset-0 z-40 bg-black/85 flex items-center justify-center p-4" onClick={() => setShow3D(false)}>
          <div className="relative w-full max-w-md h-full max-h-[80%] sf-chamfer-lg border border-sf-gold/50 bg-sf-ink overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <FighterPreview3D fighterId={activeId} skinId={activeSkin} authorizationMode={authorizationMode} />
            <div className="absolute bottom-3 left-4 font-display italic font-black text-2xl text-white drop-shadow-[0_2px_0_rgba(0,0,0,0.9)]">{activeMeta.name}</div>
            <button type="button" onClick={() => setShow3D(false)} aria-label="Fechar" className="absolute top-2 right-2 grid place-items-center w-11 h-11 rounded-full bg-black/80 border border-white/30">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
