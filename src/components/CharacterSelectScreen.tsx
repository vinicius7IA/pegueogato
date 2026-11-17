import { MapPin, Package, RotateCw, Shuffle, Sparkles, Swords } from 'lucide-react';
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
import {
  ActionButton,
  ScreenHeader,
  SegmentedTabs,
  StatGauge,
  StreetPanel,
} from './ui/FightingUI';

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

  return (
    <div className="w-full h-full overflow-y-auto bg-sf-bg text-slate-100 flex flex-col sf-halftone-bg">
      <ScreenHeader
        title="SELEÇÃO DE LUTADORES"
        subtitle={`${FIGHTERS_LIST.length}/${FIGHTER_ROSTER_CAPACITY} lutadores disponíveis`}
        onBack={onBack}
        centerSlot={
          <div className="px-3.5 py-1 sf-chamfer-sm bg-sf-ink border border-sf-gold/50 font-mono-num text-base font-black text-sf-gold">
            {String(countdown).padStart(2, '0')}s
          </div>
        }
        rightSlot={
          <SegmentedTabs
            items={[
              { id: 'p1', label: 'Edit P1' },
              { id: 'p2', label: 'Edit P2' },
            ]}
            value={slotTab}
            onChange={setSlotTab}
            tone={slotTab === 'p2' ? 'cyan' : 'gold'}
            className="min-w-[140px]"
          />
        }
      />

      <main className="flex-1 p-4 sm:p-5 max-w-6xl w-full mx-auto flex flex-col gap-4">
        {/* Fighting-Game Side Portraits + Center VS + Interactive 3D Stage */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr_1fr] gap-3.5 items-stretch">
          {/* P1 Side Card */}
          <motion.div
            key={`p1_${p1Fighter}`}
            initial={{ x: -16, opacity: 0.55 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.22 }}
            className="h-full"
          >
            <StreetPanel
              tone={slotTab === 'p1' ? 'gold' : 'neutral'}
              chamfer="md"
              className="h-full p-4 flex flex-col justify-between gap-3 bg-gradient-to-br from-sf-gold/14 via-sf-surface to-sf-ink"
            >
              <div className="flex items-center gap-3.5">
                {p1Meta.showPortraitPhoto && FIGHTERS[p1Fighter].portraitUrl ? (
                  <img
                    src={FIGHTERS[p1Fighter].portraitUrl}
                    alt={p1Meta.name}
                    referrerPolicy="no-referrer"
                    className="w-20 h-24 sf-chamfer-sm object-cover object-top border border-sf-gold/60 shrink-0"
                  />
                ) : (
                  <div
                    className="w-20 h-24 sf-chamfer-sm flex items-center justify-center font-display italic text-3xl font-black text-white shrink-0 border border-white/20"
                    style={{ backgroundColor: FIGHTERS[p1Fighter].badgeColor }}
                  >
                    {p1Meta.name.slice(0, 2)}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-[11px] font-black tracking-widest text-sf-gold">
                    JOGADOR 1
                  </div>
                  <div className="font-display italic text-2xl sm:text-3xl font-black text-white leading-none truncate mt-0.5">
                    {p1Meta.name}
                  </div>
                  <div className="text-xs text-slate-400 truncate mt-1">
                    {ARCHETYPE_NAMES[FIGHTERS[p1Fighter].archetype]} · {FIGHTERS[p1Fighter].title}
                  </div>
                </div>
              </div>
              <p className="text-xs text-amber-100/90 italic border-t border-white/10 pt-2.5 truncate">
                “{FIGHTERS[p1Fighter].catchphrase}”
              </p>
            </StreetPanel>
          </motion.div>

          {/* Center 3D Preview + VS Crest */}
          <StreetPanel
            tone={slotTab === 'p1' ? 'gold' : 'cyan'}
            chamfer="lg"
            className="relative h-64 lg:h-68 bg-sf-ink"
          >
            <img
              src={salvadorBackdrop}
              alt="Arena de Salvador"
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover opacity-38"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-black/55" />
            <FighterPreview3D
              fighterId={activeId}
              skinId={activeSkin}
              authorizationMode={authorizationMode}
            />

            <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
              <button
                type="button"
                onClick={cycleActiveSkin}
                className="flex items-center gap-1 text-[11px] font-black uppercase text-sf-gold bg-black/80 border border-sf-gold/45 px-2.5 py-1 sf-chamfer-sm hover:bg-black transition-colors"
              >
                Trocar Skin
              </button>
              <button
                type="button"
                onClick={cycleActivePower}
                className="flex items-center gap-1 text-[11px] font-black uppercase text-sf-cyan bg-black/80 border border-sf-cyan/45 px-2.5 py-1 sf-chamfer-sm hover:bg-black transition-colors"
              >
                <Sparkles className="w-3 h-3" /> {POWERS[activePower].shortName}
              </button>
            </div>

            <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
              <button
                type="button"
                onClick={() => {
                  gameAudio.playClick();
                  onOpenInventory();
                }}
                className="flex items-center gap-1 text-[11px] font-bold text-white bg-black/80 border border-white/22 px-2.5 py-1 sf-chamfer-sm hover:border-sf-gold"
              >
                <Package className="w-3 h-3 text-sf-gold" /> Inventário
              </button>
              <span className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-slate-300 bg-black/70 px-2 py-1 sf-chamfer-sm pointer-events-none">
                <RotateCw className="w-3 h-3" /> 3D
              </span>
            </div>

            <div className="absolute bottom-3 left-3.5 right-3.5 flex items-end justify-between gap-2 pointer-events-none z-10">
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-sf-gold truncate">
                  {slotTab === 'p1' ? 'Editando P1' : 'Editando Rival'} · Maestria Nv.{mastery.level} ·{' '}
                  {activeDef.masteryTitles[mastery.titleIdx]}
                </div>
                <div className="font-display italic text-3xl font-black text-white leading-none truncate">
                  {activeMeta.name}
                </div>
              </div>
              <div className="px-3 py-1 sf-chamfer-sm bg-gradient-to-br from-sf-crimson to-sf-gold text-black font-display italic text-2xl font-black shrink-0 shadow-lg">
                VS
              </div>
            </div>
          </StreetPanel>

          {/* P2 Side Card */}
          <motion.div
            key={`p2_${p2Fighter}`}
            initial={{ x: 16, opacity: 0.55 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.22 }}
            className="h-full"
          >
            <StreetPanel
              tone={slotTab === 'p2' ? 'cyan' : 'neutral'}
              chamfer="md"
              className="h-full p-4 flex flex-col justify-between gap-3 bg-gradient-to-bl from-sf-cyan/14 via-sf-surface to-sf-ink"
            >
              <div className="flex items-center flex-row-reverse text-right gap-3.5">
                {p2Meta.showPortraitPhoto && FIGHTERS[p2Fighter].portraitUrl ? (
                  <img
                    src={FIGHTERS[p2Fighter].portraitUrl}
                    alt={p2Meta.name}
                    referrerPolicy="no-referrer"
                    className="w-20 h-24 sf-chamfer-sm object-cover object-top border border-sf-cyan/60 shrink-0"
                  />
                ) : (
                  <div
                    className="w-20 h-24 sf-chamfer-sm flex items-center justify-center font-display italic text-3xl font-black text-white shrink-0 border border-white/20"
                    style={{ backgroundColor: FIGHTERS[p2Fighter].badgeColor }}
                  >
                    {p2Meta.name.slice(0, 2)}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-[11px] font-black tracking-widest text-sf-cyan">
                    DESAFIANTE (P2)
                  </div>
                  <div className="font-display italic text-2xl sm:text-3xl font-black text-white leading-none truncate mt-0.5">
                    {p2Meta.name}
                  </div>
                  <div className="text-xs text-slate-400 truncate mt-1">
                    {ARCHETYPE_NAMES[FIGHTERS[p2Fighter].archetype]} · {FIGHTERS[p2Fighter].title}
                  </div>
                </div>
              </div>
              <p className="text-xs text-cyan-100/90 italic text-right border-t border-white/10 pt-2.5 truncate">
                “{FIGHTERS[p2Fighter].catchphrase}”
              </p>
            </StreetPanel>
          </motion.div>
        </div>

        {/* Bottom Fighting Game Roster Grid (8 Fighters + Random "?") */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span className="font-bold text-white uppercase tracking-wide">Elenco Baiano</span>
            <span className="truncate">{activeDef.lore}</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2.5">
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
                  onClick={() => {
                    gameAudio.playSelectSnap();
                    if (slotTab === 'p1') onSelectP1(id);
                    else onSelectP2(id);
                  }}
                  className={`group relative sf-chamfer-sm border-2 overflow-hidden text-center transition-all duration-150 focus-visible:outline-2 focus-visible:outline-sf-gold active:scale-95 ${
                    isP1 && isP2
                      ? 'border-sf-crimson bg-[#1a1524] shadow-md'
                      : isP1
                        ? 'border-sf-gold bg-[#1b1a14] shadow-md'
                        : isP2
                          ? 'border-sf-cyan bg-[#101c24] shadow-md'
                          : 'border-white/14 bg-sf-surface hover:border-white/40'
                  } ${!unlocked ? 'opacity-35 grayscale cursor-not-allowed' : ''}`}
                >
                  {(isP1 || isP2) && (
                    <div className="absolute top-1 left-1 right-1 flex justify-between pointer-events-none z-10 font-mono-num">
                      {isP1 && (
                        <span className="px-1.5 py-0.5 bg-sf-gold text-black text-[9px] font-black leading-none">
                          P1
                        </span>
                      )}
                      {isP2 && (
                        <span className="ml-auto px-1.5 py-0.5 bg-sf-cyan text-black text-[9px] font-black leading-none">
                          P2
                        </span>
                      )}
                    </div>
                  )}
                  {meta.showPortraitPhoto && def.portraitUrl ? (
                    <img
                      src={def.portraitUrl}
                      alt={meta.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-18 object-cover object-top group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div
                      className="w-full h-18 flex items-center justify-center font-display italic text-2xl font-black text-white"
                      style={{ backgroundColor: def.badgeColor }}
                    >
                      {meta.name.slice(0, 2)}
                    </div>
                  )}
                  <div className="py-1.5 px-1 text-[11px] font-extrabold truncate bg-sf-ink text-white border-t border-white/10">
                    {meta.name.replace(/^O /, '')}
                  </div>
                </button>
              );
            })}

            {/* Random "?" Button */}
            <button
              type="button"
              onClick={handleRandomPick}
              className="sf-chamfer-sm border-2 border-dashed border-sf-gold/55 bg-sf-surface hover:bg-[#181d2c] hover:border-sf-gold flex flex-col items-center justify-center p-2 gap-1.5 text-sf-gold transition-colors focus-visible:outline-2 focus-visible:outline-sf-gold active:scale-95"
            >
              <Shuffle className="w-5 h-5" />
              <span className="font-display italic text-sm font-black tracking-wide">
                ALEATÓRIO ?
              </span>
            </button>
          </div>
        </div>

        {/* Stat Bars + Special Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StreetPanel chamfer="md" className="p-4 space-y-2">
            {STAT_LABELS.map(({ key, label }) => (
              <StatGauge
                key={key}
                label={label}
                value={activeDef.stats[key]}
                tone={slotTab === 'p1' ? 'gold' : 'cyan'}
              />
            ))}
          </StreetPanel>

          <StreetPanel chamfer="md" className="p-4 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-display italic text-lg font-black text-sf-gold tracking-wide">
                GOLPES ASSINATURA
              </span>
              <span className="text-slate-400 font-semibold truncate">{activeDef.style}</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 sf-chamfer-sm bg-sf-ink border border-white/10">
                <div className="font-black text-white truncate">
                  {activeDef.specialMoves.special_1.name}
                </div>
                <div className="text-sf-cyan font-mono-num text-[11px] font-bold mt-1">
                  {activeDef.specialMoves.special_1.command}
                </div>
              </div>
              <div className="p-3 sf-chamfer-sm bg-sf-ink border border-sf-crimson/35">
                <div className="font-black text-sf-crimson truncate">{activeDef.finisherName}</div>
                <div className="text-slate-300 font-mono-num text-[11px] font-bold mt-1">
                  100% Energia
                </div>
              </div>
            </div>
          </StreetPanel>
        </div>

        {/* Difficulty + Arena Picker + Start Fight CTA */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1.25fr] gap-3 items-center mt-auto pt-1">
          <SegmentedTabs
            items={[
              { id: 'easy', label: 'Fácil' },
              { id: 'medium', label: 'Médio' },
              { id: 'hard', label: 'Difícil' },
            ]}
            value={difficulty}
            onChange={setDifficulty}
            tone="gold"
          />

          <ActionButton
            variant="steel"
            onClick={() => {
              gameAudio.playClick();
              onOpenStageSelect();
            }}
          >
            <MapPin className="w-4 h-4 text-sf-gold" />
            Arena: {ARENAS[arenaId].shortName}
          </ActionButton>

          <ActionButton
            variant="gold"
            size="lg"
            className="w-full"
            onClick={() => {
              gameAudio.playSelectSnap();
              onStartFight('vs_ai', difficulty);
            }}
          >
            <Swords className="w-5 h-5" /> LUTAR EM {ARENAS[arenaId].shortName.toUpperCase()}
          </ActionButton>
        </div>
      </main>
    </div>
  );
}
