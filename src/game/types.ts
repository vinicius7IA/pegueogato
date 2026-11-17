export type ScreenId =
  | 'splash'
  | 'login'
  | 'menu'
  | 'select'
  | 'stage_select'
  | 'arena'
  | 'shop'
  | 'inventory'
  | 'profile'
  | 'multiplayer'
  | 'result'
  | 'settings';

export type FighterId =
  | 'policial'
  | 'maluco'
  | 'roberto'
  | 'torcedor_vitoria'
  | 'torcedor'
  | 'jesse'
  | 'alo_juca'
  | 'alo_dani';

export type FighterArchetype = 'rapido' | 'bruto' | 'tecnico' | 'trapaceiro' | 'zoneador';

export type ArenaId =
  | 'pelourinho'
  | 'favela_salvador'
  | 'cajazeira'
  | 'gamboa'
  | 'pituba'
  | 'elevador_lacerda'
  | 'farol_barra'
  | 'orla'
  | 'rio_vermelho'
  | 'dique_tororo';

export type MatchMode = 'vs_ai' | 'arcade' | 'training' | 'local_2p' | 'online';

export type AiDifficulty = 'easy' | 'medium' | 'hard';

export type InputMethod = 'keyboard' | 'touch' | 'xbox';

export type MobileOrientation = 'landscape' | 'portrait';

export type QualityPreset = 'auto' | 'high' | 'medium' | 'low';

export type MoveId =
  | 'idle'
  | 'walk_fwd'
  | 'walk_back'
  | 'crouch'
  | 'jump'
  | 'block'
  | 'crouch_block'
  | 'parry'
  | 'dodge'
  | 'taunt'
  | 'intro'
  | 'punch_light'
  | 'punch_med'
  | 'punch_heavy'
  | 'kick_light'
  | 'kick_med'
  | 'kick_heavy'
  | 'crouch_punch'
  | 'crouch_kick'
  | 'air_punch'
  | 'air_kick'
  | 'quick_punch'
  | 'heavy_punch'
  | 'slap'
  | 'kick'
  | 'grab'
  | 'grabbed'
  | 'grab_break'
  | 'special_1'
  | 'special_2'
  | 'special_combo'
  | 'power_move'
  | 'finisher_move'
  | 'hitstun'
  | 'stun'
  | 'knockdown'
  | 'ko'
  | 'victory'
  | 'victory_1'
  | 'victory_2';

export type PowerId =
  | 'gatos_pretos'
  | 'tapa_explosivo'
  | 'super_soco'
  | 'velocidade_extrema'
  | 'escudo'
  | 'combo_relampago'
  | 'golpe_especial';

export interface ArenaDefinition {
  id: ArenaId;
  name: string;
  shortName: string;
  district: string;
  timeOfDay: 'manha' | 'meio_dia' | 'tarde' | 'por_do_sol' | 'crepusculo' | 'noite';
  musicStyle: 'samba_reggae' | 'pagode_rua' | 'ijexa' | 'percussao_baiana';
  interactiveFeature: string;
  accentHex: string;
  skyTopHex: number;
  skyBottomHex: number;
  /** Fundo 2D (arte) usado no lugar do cenário 3D. */
  backdropUrl?: string;
  /** Miniatura usada no carrossel da seleção de arena. */
  thumbUrl?: string;
}

export interface FighterStats {
  forca: number; // 1-100
  velocidade: number; // 1-100
  resistencia: number; // 1-100
  energia: number; // 1-100
  habilidadeEspecial: number; // 1-100
}

export interface FighterBalance {
  hp: number;
  walkSpeed: number;
  jumpForce: number;
  damageScale: number;
  rangeScale: number;
  recoveryScale: number;
}

export interface SilhouetteExaggeration {
  heightScale: number;
  shoulderScale: number;
  fistScale: number;
  headScale: number;
  /** Corpulência do tronco (1 = padrão). */
  girth?: number;
}

export interface FighterSkin {
  id: string;
  fighterId: FighterId;
  name: string;
  description: string;
  priceCoins: number;
  priceDiamonds: number;
  palette: {
    skin: number;
    hair: number;
    top: number;
    vestOrTrim: number;
    pants: number;
    glovesOrWraps: number;
    accent: number;
  };
}

export interface PowerDefinition {
  id: PowerId;
  name: string;
  shortName: string;
  description: string;
  energyCost: number;
  damage: number;
  durationSec: number;
  priceCoins: number;
  priceDiamonds: number;
  colorHex: string;
}

export interface FighterMoveOverride {
  name: string;
  command: string;
  damageScale?: number;
  knockbackScale?: number;
  vfxColor?: number;
  description: string;
}

export interface FighterDefinition {
  id: FighterId;
  name: string;
  fallbackAlias?: string;
  requiresAuthorization?: boolean;
  archetype: FighterArchetype;
  title: string;
  tagline: string;
  lore: string;
  catchphrase: string;
  quotes: string[];
  personality: string;
  style: string;
  signaturePowerId: PowerId;
  signaturePowerName: string;
  finisherName: string;
  portraitUrl?: string;
  badgeColor: string;
  stats: FighterStats;
  balance: FighterBalance;
  silhouette: SilhouetteExaggeration;
  masteryTitles: [string, string, string, string];
  specialMoves: {
    special_1: FighterMoveOverride;
    special_2: FighterMoveOverride;
    super_move: FighterMoveOverride;
    finisher_move: FighterMoveOverride;
  };
  unlockCoins: number;
  unlockDiamonds: number;
  defaultSkinId: string;
}

export interface MoveSpec {
  id: MoveId;
  label: string;
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  chipDamage: number;
  range: number;
  knockback: number;
  hitstun: number;
  stunDamage: number;
  energyGain: number;
  energyCost: number;
  hitHeight: 'high' | 'mid' | 'low' | 'overhead';
  cancellable?: boolean;
  isUnblockable?: boolean;
  isMultiHit?: boolean;
  vfxColor: number;
}

export interface DamagePopup {
  id: number;
  x: number;
  y: number;
  amount: number;
  kind: 'normal' | 'counter' | 'parry' | 'super' | 'finisher' | 'slap';
  life: number;
}

export interface HitboxDebugRect {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'hurt' | 'hit' | 'parry';
}

export interface MatchSummary {
  winner: 'p1' | 'p2' | 'draw';
  mode: MatchMode;
  arenaId: ArenaId;
  p1FighterId: FighterId;
  p2FighterId: FighterId;
  p1RoundsWon: number;
  p2RoundsWon: number;
  maxCombo: number;
  damageDealt: number;
  perfectRounds: number;
  perfectParries: number;
  finisherUsed: boolean;
  score: number;
  xpEarned: number;
  coinsEarned: number;
  masteryXpEarned: number;
  durationSec: number;
  timestamp: string;
  opponentName: string;
  arcadeStage?: number;
}

export interface DailyChallenge {
  id: string;
  title: string;
  target: number;
  progress: number;
  rewardCoins: number;
  rewardDiamonds: number;
  claimed: boolean;
  kind: 'wins' | 'combos' | 'parries' | 'specials';
}

export interface PlayerProfile {
  nickname: string;
  hasCompletedOnboarding: boolean;
  level: number;
  xp: number;
  xpToNext: number;
  coins: number;
  diamonds: number;
  wins: number;
  losses: number;
  rankPoints: number;
  unlockedFighters: FighterId[];
  unlockedSkins: string[];
  unlockedPowers: PowerId[];
  equippedSkins: Record<FighterId, string>;
  equippedPowers: Record<FighterId, PowerId>;
  fighterMasteryXp: Record<FighterId, number>;
  achievements: string[];
  dailyChallenges: DailyChallenge[];
  dailyChallengesDate: string;
  matchHistory: MatchSummary[];
}

export interface TouchButtonPosition {
  xPct: number;
  yPct: number;
  scale: number;
}

export interface KeyBindings {
  left: string;
  right: string;
  up: string;
  down: string;
  punchLight: string;
  punchHeavy: string;
  kickLight: string;
  kickHeavy: string;
  block: string;
  dodge: string;
  grab: string;
  special1: string;
  superMove: string;
  taunt: string;
}

export interface GameSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  sfxEnabled: boolean;
  cameraShake: boolean;
  showHitEffects: boolean;
  controlScheme: 'auto' | 'touch' | 'keyboard' | 'xbox';
  mobileOrientation: MobileOrientation | null;
  commandAssist: boolean;
  hapticsEnabled: boolean;
  touchLayoutScale: number;
  touchButtonsOffsetY: number;
  authorizationMode: boolean; // When false, hides real-person likeness behind fictional aliases
  roundDurationSec: number;
  aiDifficulty: AiDifficulty;
  quality: QualityPreset;
  keyBindings: KeyBindings;
}

export type TrainingDummyMode = 'stand' | 'crouch' | 'guard_all' | 'counter' | 'cpu';

export interface CombatHudSnapshot {
  p1Hp: number;
  p1MaxHp: number;
  p1Energy: number;
  p1Stun: number;
  p1Combo: number;
  p1Multiplier: number;
  p1Rounds: number;
  p1State: MoveId;
  p1Buff: 'speed' | 'shield' | null;
  p1Title: string;
  p2Hp: number;
  p2MaxHp: number;
  p2Energy: number;
  p2Stun: number;
  p2Combo: number;
  p2Multiplier: number;
  p2Rounds: number;
  p2State: MoveId;
  p2Buff: 'speed' | 'shield' | null;
  p2Title: string;
  timer: number;
  roundNumber: number;
  bannerText: string | null;
  calloutText: string | null;
  calloutSide: 'left' | 'right' | null;
  quoteText: string | null;
  quoteSide: 'left' | 'right' | null;
  damagePopups: DamagePopup[];
  hitboxRects: HitboxDebugRect[];
  showHitboxes: boolean;
  isFinisherSlowmo: boolean;
  isPaused: boolean;
  matchFinished: boolean;
}

export interface OnlineRoomInfo {
  code: string;
  hostName: string;
  playerCount: number;
  status: 'waiting' | 'fighting';
}

export interface LeaderboardEntry {
  nickname: string;
  rankPoints: number;
  wins: number;
  losses: number;
  favoriteFighter: FighterId;
}
