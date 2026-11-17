import thumbFarol from '../assets/images/stages/thumb_farol.jpg';
import thumbFavela from '../assets/images/stages/thumb_favela.jpg';
import thumbShopping from '../assets/images/stages/thumb_shopping.jpg';
import {
  FIGHTER_ROSTER_CAPACITY,
  FIGHTERS,
  FIGHTERS_LIST,
  getDisplayFighterMeta,
  getMasteryLevel,
  MOVES,
  SKINS,
} from './fighters';
import {
  ArenaDefinition,
  ArenaId,
  DailyChallenge,
  FighterId,
  FighterSkin,
  GameSettings,
  KeyBindings,
  PlayerProfile,
  PowerDefinition,
  PowerId,
} from './types';

export {
  FIGHTER_ROSTER_CAPACITY,
  FIGHTERS,
  FIGHTERS_LIST,
  getDisplayFighterMeta,
  getMasteryLevel,
  MOVES,
  SKINS,
};

export const ARENAS: Record<ArenaId, ArenaDefinition> = {
  pelourinho: {
    id: 'pelourinho',
    name: 'Largo do Pelourinho',
    shortName: 'Pelourinho',
    district: 'Centro Histórico · Salvador',
    timeOfDay: 'manha',
    musicStyle: 'samba_reggae',
    interactiveFeature: 'Tambores do Largo vibram e a platéia pula nos golpes fortes',
    accentHex: '#f59e0b',
    skyTopHex: 0x2b7bbb,
    skyBottomHex: 0xe6f3fa,
  },
  favela_salvador: {
    id: 'favela_salvador',
    name: 'Favela',
    shortName: 'Favela',
    district: 'Encosta de Salvador',
    timeOfDay: 'tarde',
    musicStyle: 'pagode_rua',
    interactiveFeature: 'Pipas coloridas cruzam o céu e moradores torcem das lajes',
    accentHex: '#ef4444',
    skyTopHex: 0x3b82f6,
    skyBottomHex: 0xfde68a,
    thumbUrl: thumbFavela,
  },
  cajazeira: {
    id: 'cajazeira',
    name: 'Quadra de Cajazeiras',
    shortName: 'Cajazeiras',
    district: 'Cajazeiras · Salvador',
    timeOfDay: 'por_do_sol',
    musicStyle: 'pagode_rua',
    interactiveFeature: 'Paredão gigante pulsa no grave a cada golpe pesado',
    accentHex: '#a855f7',
    skyTopHex: 0x7c3aed,
    skyBottomHex: 0xfb923c,
  },
  gamboa: {
    id: 'gamboa',
    name: 'Pier da Gamboa',
    shortName: 'Gamboa',
    district: 'Baía de Todos-os-Santos',
    timeOfDay: 'manha',
    musicStyle: 'ijexa',
    interactiveFeature: 'Barcos balançam na maré e respingos d’água sobem no impacto',
    accentHex: '#06b6d4',
    skyTopHex: 0x0284c7,
    skyBottomHex: 0xbae6fd,
  },
  pituba: {
    id: 'pituba',
    name: 'Shopping da Bahia',
    shortName: 'Shopping',
    district: 'Iguatemi · Salvador',
    timeOfDay: 'meio_dia',
    musicStyle: 'samba_reggae',
    interactiveFeature: 'Estacionamento lotado e movimento de compras na porta do shopping',
    accentHex: '#22c55e',
    skyTopHex: 0x1d4ed8,
    skyBottomHex: 0xe0f2fe,
    thumbUrl: thumbShopping,
  },
  elevador_lacerda: {
    id: 'elevador_lacerda',
    name: 'Elevador Lacerda',
    shortName: 'Elevador',
    district: 'Praça Municipal · Salvador',
    timeOfDay: 'tarde',
    musicStyle: 'percussao_baiana',
    interactiveFeature: 'Cabine panorâmica sobe e desce com vista para a Baía',
    accentHex: '#38bdf8',
    skyTopHex: 0x2563eb,
    skyBottomHex: 0xfef3c7,
  },
  farol_barra: {
    id: 'farol_barra',
    name: 'Farol da Barra',
    shortName: 'Farol',
    district: 'Barra · Pôr do Sol',
    timeOfDay: 'por_do_sol',
    musicStyle: 'samba_reggae',
    interactiveFeature: 'Facho luminoso do farol gira sobre o Atlântico dourado',
    accentHex: '#f97316',
    skyTopHex: 0x1e3a8a,
    skyBottomHex: 0xfb923c,
    thumbUrl: thumbFarol,
  },
  orla: {
    id: 'orla',
    name: 'Orla Atlântica',
    shortName: 'Orla',
    district: 'Avenida Oceânica · SSA',
    timeOfDay: 'manha',
    musicStyle: 'percussao_baiana',
    interactiveFeature: 'Ondas quebram na areia enquanto gaivotas e barracas vibram',
    accentHex: '#0ea5e9',
    skyTopHex: 0x0369a1,
    skyBottomHex: 0xfef9c3,
  },
  rio_vermelho: {
    id: 'rio_vermelho',
    name: 'Largo de Santana · RV',
    shortName: 'Rio Vermelho',
    district: 'Boemia · Rio Vermelho',
    timeOfDay: 'noite',
    musicStyle: 'pagode_rua',
    interactiveFeature: 'Neon do tabuleiro de acarajé pisca e faíscas de pimenta sobem',
    accentHex: '#ec4899',
    skyTopHex: 0x090d1f,
    skyBottomHex: 0x312e81,
  },
  dique_tororo: {
    id: 'dique_tororo',
    name: 'Dique do Tororó',
    shortName: 'Dique',
    district: 'Tororó · Arena Fonte Nova',
    timeOfDay: 'crepusculo',
    musicStyle: 'ijexa',
    interactiveFeature: 'Esculturas dos Orixás iluminadas e chafariz central ativo',
    accentHex: '#eab308',
    skyTopHex: 0x1e1b4b,
    skyBottomHex: 0xf59e0b,
  },
};

export const ARENAS_LIST: ArenaDefinition[] = Object.values(ARENAS);

export const POWERS: Record<PowerId, PowerDefinition> = {
  gatos_pretos: {
    id: 'gatos_pretos',
    name: 'Enxame dos Gatos Pretos',
    shortName: 'Gatos Pretos',
    description: 'Invoca 7 gatos pretos furiosos que avançam em onda pela arena!',
    energyCost: 45,
    damage: 32,
    durationSec: 1.05,
    priceCoins: 0,
    priceDiamonds: 0,
    colorHex: '#a855f7',
  },
  tapa_explosivo: {
    id: 'tapa_explosivo',
    name: 'Tapa Explosivo',
    shortName: 'Tapão Boom',
    description: 'Tapão sônico que deixa a cara do rival vermelha e arremessa longe.',
    energyCost: 45,
    damage: 28,
    durationSec: 0.72,
    priceCoins: 350,
    priceDiamonds: 10,
    colorHex: '#f59e0b',
  },
  super_soco: {
    id: 'super_soco',
    name: 'Super Soco',
    shortName: 'Super Soco',
    description: 'Direto demolidor de boxe que atravessa a defesa e causa alto dano.',
    energyCost: 50,
    damage: 30,
    durationSec: 0.78,
    priceCoins: 400,
    priceDiamonds: 12,
    colorHex: '#ef4444',
  },
  velocidade_extrema: {
    id: 'velocidade_extrema',
    name: 'Velocidade Extrema',
    shortName: 'Turbo',
    description: 'Aumenta velocidade de movimento e quadros de ataque em 45% por 6s.',
    energyCost: 40,
    damage: 12,
    durationSec: 0.45,
    priceCoins: 300,
    priceDiamonds: 10,
    colorHex: '#06b6d4',
  },
  escudo: {
    id: 'escudo',
    name: 'Escudo de Axé',
    shortName: 'Escudo',
    description: 'Reduz dano recebido em 60% e protege contra atordoamento por 5s.',
    energyCost: 40,
    damage: 10,
    durationSec: 0.45,
    priceCoins: 320,
    priceDiamonds: 10,
    colorHex: '#3b82f6',
  },
  combo_relampago: {
    id: 'combo_relampago',
    name: 'Combo Relâmpago',
    shortName: 'Relâmpago',
    description: 'Sequência ultrarrápida de 4 golpes em cadeia com descarga elétrica.',
    energyCost: 55,
    damage: 34,
    durationSec: 0.9,
    priceCoins: 480,
    priceDiamonds: 15,
    colorHex: '#eab308',
  },
  golpe_especial: {
    id: 'golpe_especial',
    name: 'Bahia Stretat Supremo',
    shortName: 'Supremo',
    description: 'Investida máxima com explosão dourada e impacto sísmico.',
    energyCost: 85,
    damage: 42,
    durationSec: 1.05,
    priceCoins: 600,
    priceDiamonds: 25,
    colorHex: '#f97316',
  },
};

export interface PaidShopBundle {
  id: string;
  name: string;
  description: string;
  coins: number;
  diamonds: number;
  priceBrl: string;
  badge: string;
}

export const PAID_BUNDLES: PaidShopBundle[] = [
  {
    id: 'pack_moedas_p',
    name: 'Punhado da Ribeira',
    description: 'Moedas e diamantes para liberar skins e poderes especiais.',
    coins: 600,
    diamonds: 15,
    priceBrl: 'R$ 4,90',
    badge: 'Oferta Inicial',
  },
  {
    id: 'pack_gato_ouro',
    name: 'Baú do Pelourinho',
    description: 'Pacote com bônus de diamantes para desbloquear todo o elenco.',
    coins: 1800,
    diamonds: 60,
    priceBrl: 'R$ 14,90',
    badge: 'Mais Vendido',
  },
  {
    id: 'pack_patrao',
    name: 'Maleta de Salvador',
    description: 'Reserva máxima para skins de campeonato e poderes lendários.',
    coins: 4500,
    diamonds: 160,
    priceBrl: 'R$ 29,90',
    badge: 'Melhor Custo',
  },
];

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  rewardCoins: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_win', title: 'Batismo na Ladeira', description: 'Vença sua primeira luta.', rewardCoins: 100 },
  { id: 'combo_5', title: 'Mão Pesada', description: 'Acerte um combo de 5+ hits.', rewardCoins: 150 },
  { id: 'perfect_round', title: 'Intocável de Salvador', description: 'Vença um round sem sofrer dano.', rewardCoins: 250 },
  { id: 'parry_master', title: 'Reflexo Felino', description: 'Execute 3 Defesas Perfeitas.', rewardCoins: 200 },
  { id: 'arcade_champ', title: 'Campeão Baiano', description: 'Complete o Modo Arcade.', rewardCoins: 400 },
  { id: 'finisher_ko', title: 'Cinema no Pelô', description: 'Finalize um oponente com Golpe Final.', rewardCoins: 220 },
];

export interface ArcadeStageDef {
  stage: number;
  opponentId: FighterId;
  arenaId: ArenaId;
  difficulty: 'easy' | 'medium' | 'hard';
  title: string;
}

/** Arenas liberadas nesta versão; as demais aparecem bloqueadas no mapa. */
export const PLAYABLE_ARENAS: ArenaId[] = ['farol_barra', 'favela_salvador', 'pituba'];
export const isPlayableArena = (id: ArenaId): boolean => PLAYABLE_ARENAS.includes(id);

/** Lutadores jogáveis nesta versão; os demais aparecem bloqueados (cinza) na seleção. */
export const PLAYABLE_FIGHTERS: FighterId[] = ['policial', 'maluco'];
export const isPlayableFighter = (id: FighterId): boolean => PLAYABLE_FIGHTERS.includes(id);

export const ARCADE_LADDER: ArcadeStageDef[] = [
  { stage: 1, opponentId: 'maluco', arenaId: 'favela_salvador', difficulty: 'easy', title: 'Abertura na Favela' },
  { stage: 2, opponentId: 'policial', arenaId: 'farol_barra', difficulty: 'medium', title: 'Chuta-Porta no Farol' },
  { stage: 3, opponentId: 'maluco', arenaId: 'pituba', difficulty: 'medium', title: 'Confusão no Shopping' },
  { stage: 4, opponentId: 'policial', arenaId: 'farol_barra', difficulty: 'hard', title: 'Final no Farol da Barra' },
];

/** Torneio Baiano: chave eliminatória com 4 lutas contra adversários apelidados. */
export const TOURNAMENT_LADDER: ArcadeStageDef[] = [
  { stage: 1, opponentId: 'maluco', arenaId: 'favela_salvador', difficulty: 'easy', title: 'Oitavas · Gato da Ribeira' },
  { stage: 2, opponentId: 'policial', arenaId: 'pituba', difficulty: 'medium', title: 'Quartas · Segurança do Iguatemi' },
  { stage: 3, opponentId: 'maluco', arenaId: 'favela_salvador', difficulty: 'medium', title: 'Semifinal · Relâmpago da Laje' },
  { stage: 4, opponentId: 'policial', arenaId: 'farol_barra', difficulty: 'hard', title: 'Final · Rei da Barra' },
];

export function generateDailyChallenges(): DailyChallenge[] {
  return [
    {
      id: 'dc_wins',
      title: 'Vença 2 lutas em qualquer modo',
      target: 2,
      progress: 0,
      rewardCoins: 180,
      rewardDiamonds: 5,
      claimed: false,
      kind: 'wins',
    },
    {
      id: 'dc_combos',
      title: 'Encaixe um combo de 4+ hits',
      target: 1,
      progress: 0,
      rewardCoins: 140,
      rewardDiamonds: 4,
      claimed: false,
      kind: 'combos',
    },
    {
      id: 'dc_parries',
      title: 'Faça 2 Defesas Perfeitas',
      target: 2,
      progress: 0,
      rewardCoins: 220,
      rewardDiamonds: 8,
      claimed: false,
      kind: 'parries',
    },
  ];
}

const BANNED_NICKNAME_WORDS = [
  'puta', 'puto', 'caralho', 'porra', 'buceta', 'piroca', 'merda', 'viado',
  'fdp', 'corno', 'arrombado', 'desgraca', 'nazi', 'hitler', 'macaco', 'foda',
];

export function validateNickname(raw: string): { valid: boolean; cleaned: string; error?: string } {
  const cleaned = raw.trim().replace(/\s+/g, ' ');
  if (cleaned.length < 3) {
    return { valid: false, cleaned, error: 'Use pelo menos 3 caracteres.' };
  }
  if (cleaned.length > 18) {
    return { valid: false, cleaned: cleaned.slice(0, 18), error: 'Máximo de 18 caracteres.' };
  }
  if (!/^[a-zA-Z0-9À-ÿ _.-]+$/.test(cleaned)) {
    return { valid: false, cleaned, error: 'Use apenas letras, números, espaços ou _ . -' };
  }
  const lower = cleaned.toLowerCase();
  if (BANNED_NICKNAME_WORDS.some((w) => lower.includes(w))) {
    return { valid: false, cleaned, error: 'Apelido não permitido. Escolha outro nome.' };
  }
  return { valid: true, cleaned };
}

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  left: 'KeyA',
  right: 'KeyD',
  up: 'KeyW',
  down: 'KeyS',
  punchLight: 'KeyJ',
  punchHeavy: 'KeyU',
  kickLight: 'KeyK',
  kickHeavy: 'KeyI',
  block: 'KeyS',
  dodge: 'KeyL',
  grab: 'KeyO',
  special1: 'KeyH',
  superMove: 'Space',
  taunt: 'KeyT',
};

const PROFILE_STORAGE_KEY = 'bahia_street_profile_v1';
const SETTINGS_STORAGE_KEY = 'bahia_street_settings_v1';

const todayStamp = () => new Date().toISOString().slice(0, 10);

export const DEFAULT_PROFILE: PlayerProfile = {
  nickname: 'LutadorSSA',
  hasCompletedOnboarding: false,
  level: 1,
  xp: 0,
  xpToNext: 200,
  coins: 240,
  diamonds: 10,
  wins: 0,
  losses: 0,
  rankPoints: 1000,
  unlockedFighters: ['policial', 'maluco', 'roberto', 'torcedor_vitoria', 'torcedor', 'jesse', 'alo_juca', 'alo_dani'],
  unlockedSkins: [
    'policial_tatico',
    'maluco_classico',
    'roberto_branco',
    'vitoria_leao',
    'torcedor_tricolor',
    'jesse_rua',
    'juca_plantao',
    'dani_estudio',
  ],
  unlockedPowers: ['gatos_pretos', 'tapa_explosivo', 'super_soco', 'combo_relampago', 'velocidade_extrema', 'escudo'],
  equippedSkins: {
    policial: 'policial_tatico',
    maluco: 'maluco_classico',
    roberto: 'roberto_branco',
    torcedor_vitoria: 'vitoria_leao',
    torcedor: 'torcedor_tricolor',
    jesse: 'jesse_rua',
    alo_juca: 'juca_plantao',
    alo_dani: 'dani_estudio',
  },
  equippedPowers: {
    policial: 'gatos_pretos',
    maluco: 'tapa_explosivo',
    roberto: 'combo_relampago',
    torcedor_vitoria: 'escudo',
    torcedor: 'super_soco',
    jesse: 'super_soco',
    alo_juca: 'combo_relampago',
    alo_dani: 'velocidade_extrema',
  },
  fighterMasteryXp: {
    policial: 0,
    maluco: 0,
    roberto: 0,
    torcedor_vitoria: 0,
    torcedor: 0,
    jesse: 0,
    alo_juca: 0,
    alo_dani: 0,
  },
  achievements: [],
  dailyChallenges: generateDailyChallenges(),
  dailyChallengesDate: todayStamp(),
  matchHistory: [],
};

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.85,
  musicVolume: 0.55,
  sfxVolume: 0.9,
  voiceVolume: 0.9,
  sfxEnabled: true,
  cameraShake: true,
  showHitEffects: true,
  controlScheme: 'auto',
  mobileOrientation: 'landscape',
  commandAssist: true,
  hapticsEnabled: true,
  touchLayoutScale: 1.0,
  touchButtonsOffsetY: 0,
  authorizationMode: true,
  roundDurationSec: 99,
  aiDifficulty: 'medium',
  quality: 'auto',
  keyBindings: DEFAULT_KEY_BINDINGS,
};

const VALID_FIGHTER_IDS = new Set<FighterId>(Object.keys(FIGHTERS) as FighterId[]);
const VALID_POWER_IDS = new Set<PowerId>(Object.keys(POWERS) as PowerId[]);
const VALID_SKIN_IDS = new Set<string>(SKINS.map((s) => s.id));

function sanitizeEquippedSkins(raw: unknown): Record<FighterId, string> {
  const out = { ...DEFAULT_PROFILE.equippedSkins };
  if (!raw || typeof raw !== 'object') return out;
  for (const id of Object.keys(FIGHTERS) as FighterId[]) {
    const candidate = (raw as Record<string, unknown>)[id];
    if (typeof candidate === 'string' && VALID_SKIN_IDS.has(candidate)) {
      out[id] = candidate;
    }
  }
  return out;
}

function sanitizeEquippedPowers(raw: unknown): Record<FighterId, PowerId> {
  const out = { ...DEFAULT_PROFILE.equippedPowers };
  if (!raw || typeof raw !== 'object') return out;
  for (const id of Object.keys(FIGHTERS) as FighterId[]) {
    const candidate = (raw as Record<string, unknown>)[id];
    if (typeof candidate === 'string' && VALID_POWER_IDS.has(candidate as PowerId)) {
      out[id] = candidate as PowerId;
    }
  }
  return out;
}

function sanitizeMasteryXp(raw: unknown): Record<FighterId, number> {
  const out = { ...DEFAULT_PROFILE.fighterMasteryXp };
  if (!raw || typeof raw !== 'object') return out;
  for (const id of Object.keys(FIGHTERS) as FighterId[]) {
    const val = (raw as Record<string, unknown>)[id];
    if (typeof val === 'number' && Number.isFinite(val) && val >= 0) {
      out[id] = val;
    }
  }
  return out;
}

export function loadProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    const today = todayStamp();
    const sameDay = parsed.dailyChallengesDate === today;

    const unlockedFighters = Array.isArray(parsed.unlockedFighters)
      ? Array.from(
          new Set([
            ...DEFAULT_PROFILE.unlockedFighters,
            ...parsed.unlockedFighters.filter((id): id is FighterId => VALID_FIGHTER_IDS.has(id)),
          ]),
        )
      : DEFAULT_PROFILE.unlockedFighters;

    const unlockedSkins = Array.isArray(parsed.unlockedSkins)
      ? Array.from(
          new Set([
            ...DEFAULT_PROFILE.unlockedSkins,
            ...parsed.unlockedSkins.filter((id): id is string => typeof id === 'string' && VALID_SKIN_IDS.has(id)),
          ]),
        )
      : DEFAULT_PROFILE.unlockedSkins;

    const unlockedPowers = Array.isArray(parsed.unlockedPowers)
      ? Array.from(
          new Set([
            ...DEFAULT_PROFILE.unlockedPowers,
            ...parsed.unlockedPowers.filter((id): id is PowerId => VALID_POWER_IDS.has(id)),
          ]),
        )
      : DEFAULT_PROFILE.unlockedPowers;

    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      nickname:
        typeof parsed.nickname === 'string' && parsed.nickname.trim().length >= 3
          ? parsed.nickname.trim().slice(0, 18)
          : DEFAULT_PROFILE.nickname,
      coins: typeof parsed.coins === 'number' && Number.isFinite(parsed.coins) && parsed.coins >= 0 ? parsed.coins : DEFAULT_PROFILE.coins,
      diamonds:
        typeof parsed.diamonds === 'number' && Number.isFinite(parsed.diamonds) && parsed.diamonds >= 0
          ? parsed.diamonds
          : DEFAULT_PROFILE.diamonds,
      level: typeof parsed.level === 'number' && Number.isFinite(parsed.level) && parsed.level >= 1 ? parsed.level : DEFAULT_PROFILE.level,
      xp: typeof parsed.xp === 'number' && Number.isFinite(parsed.xp) && parsed.xp >= 0 ? parsed.xp : DEFAULT_PROFILE.xp,
      xpToNext:
        typeof parsed.xpToNext === 'number' && Number.isFinite(parsed.xpToNext) && parsed.xpToNext >= 50
          ? parsed.xpToNext
          : DEFAULT_PROFILE.xpToNext,
      equippedSkins: sanitizeEquippedSkins(parsed.equippedSkins),
      equippedPowers: sanitizeEquippedPowers(parsed.equippedPowers),
      fighterMasteryXp: sanitizeMasteryXp(parsed.fighterMasteryXp),
      unlockedFighters,
      unlockedSkins,
      unlockedPowers,
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
      dailyChallenges:
        sameDay && Array.isArray(parsed.dailyChallenges) && parsed.dailyChallenges.length > 0
          ? parsed.dailyChallenges
          : generateDailyChallenges(),
      dailyChallengesDate: today,
      matchHistory: Array.isArray(parsed.matchHistory) ? parsed.matchHistory : [],
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(profile: PlayerProfile): void {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore quota errors
  }
}

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    const validDiff = parsed.aiDifficulty === 'easy' || parsed.aiDifficulty === 'medium' || parsed.aiDifficulty === 'hard';
    const validQuality =
      parsed.quality === 'auto' || parsed.quality === 'high' || parsed.quality === 'medium' || parsed.quality === 'low';
    const validScheme =
      parsed.controlScheme === 'auto' ||
      parsed.controlScheme === 'touch' ||
      parsed.controlScheme === 'keyboard' ||
      parsed.controlScheme === 'xbox';
    const validOrientation =
      parsed.mobileOrientation === null ||
      parsed.mobileOrientation === 'landscape' ||
      parsed.mobileOrientation === 'portrait';

    const rawDuration = Number(parsed.roundDurationSec);
    const roundDurationSec = Number.isFinite(rawDuration)
      ? Math.max(30, Math.min(180, Math.round(rawDuration)))
      : DEFAULT_SETTINGS.roundDurationSec;

    const mergedBindings: KeyBindings = { ...DEFAULT_KEY_BINDINGS };
    if (parsed.keyBindings && typeof parsed.keyBindings === 'object') {
      (Object.keys(DEFAULT_KEY_BINDINGS) as Array<keyof KeyBindings>).forEach((k) => {
        const v = parsed.keyBindings?.[k];
        if (typeof v === 'string' && v.length > 0) mergedBindings[k] = v;
      });
    }

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      aiDifficulty: validDiff ? parsed.aiDifficulty! : DEFAULT_SETTINGS.aiDifficulty,
      quality: validQuality ? parsed.quality! : DEFAULT_SETTINGS.quality,
      controlScheme: validScheme ? parsed.controlScheme! : DEFAULT_SETTINGS.controlScheme,
      mobileOrientation: validOrientation ? parsed.mobileOrientation! : DEFAULT_SETTINGS.mobileOrientation,
      roundDurationSec,
      keyBindings: mergedBindings,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export function getSkinById(skinId: string): FighterSkin {
  return SKINS.find((s) => s.id === skinId) || SKINS[0];
}
