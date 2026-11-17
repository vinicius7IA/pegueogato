import {
  Award,
  CheckCircle2,
  Coins,
  Flame,
  Keyboard,
  Package,
  RotateCcw,
  Save,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trophy,
  User,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { gameAudio } from '../game/audio';
import {
  ACHIEVEMENTS,
  ARCADE_LADDER,
  DEFAULT_KEY_BINDINGS,
  FIGHTERS,
  FIGHTERS_LIST,
  getDisplayFighterMeta,
  getMasteryLevel,
  validateNickname,
} from '../game/catalog';
import { GameSettings, KeyBindings, MatchSummary, PlayerProfile } from '../game/types';
import { ActionButton, ScreenHeader, StatGauge, StreetPanel } from './ui/FightingUI';

interface ResultScreenProps {
  summary: MatchSummary;
  profile: PlayerProfile;
  leveledUp: boolean;
  authorizationMode: boolean;
  onRematch: () => void;
  onNextArcadeStage?: () => void;
  onBackToMenu: () => void;
}

export function ResultScreen({
  summary,
  profile,
  leveledUp,
  authorizationMode,
  onRematch,
  onNextArcadeStage,
  onBackToMenu,
}: ResultScreenProps) {
  const isWin = summary.winner === 'p1';
  const xpPct = Math.min(100, Math.round((profile.xp / profile.xpToNext) * 100));
  const p1Meta = getDisplayFighterMeta(summary.p1FighterId, authorizationMode);
  const p2Meta = getDisplayFighterMeta(summary.p2FighterId, authorizationMode);
  const hasNextArcade =
    summary.mode === 'arcade' &&
    isWin &&
    typeof summary.arcadeStage === 'number' &&
    summary.arcadeStage < ARCADE_LADDER.length &&
    Boolean(onNextArcadeStage);
  const arcadeComplete =
    summary.mode === 'arcade' && isWin && summary.arcadeStage === ARCADE_LADDER.length;

  return (
    <div className="w-full h-full overflow-y-auto bg-sf-bg flex items-center justify-center p-4 sf-halftone-bg">
      <StreetPanel
        tone={isWin ? 'gold' : 'crimson'}
        chamfer="lg"
        textured
        className="w-full max-w-md p-6 space-y-5"
      >
        <div className="text-center border-b border-white/12 pb-4 sf-speed-lines">
          <div
            className={`inline-flex items-center gap-1.5 text-xs font-black tracking-widest uppercase mb-1.5 ${
              isWin ? 'text-sf-gold' : 'text-sf-crimson'
            }`}
          >
            <Trophy className="w-4 h-4" />
            {arcadeComplete
              ? 'Campeão do Modo Arcade'
              : isWin
                ? 'Vitória na Arena'
                : summary.winner === 'draw'
                  ? 'Empate Técnico'
                  : 'Derrota'}
          </div>
          <h1 className="font-display italic text-5xl font-black text-white leading-none">
            {arcadeComplete ? 'REI DE SALVADOR!' : isWin ? 'MANDOU BEM!' : 'LEVANTA E VAI!'}
          </h1>
          <p className="text-xs font-semibold text-slate-300 mt-2">
            {p1Meta.name} ({summary.p1RoundsWon}) × ({summary.p2RoundsWon}) {p2Meta.name}
          </p>
          {summary.finisherUsed && (
            <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 sf-chamfer-sm bg-sf-crimson/20 border border-sf-crimson/60 text-xs font-black text-red-200">
              <Flame className="w-3.5 h-3.5" /> Golpe Final: {FIGHTERS[summary.p1FighterId].finisherName}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-center">
          <div className="p-3 sf-chamfer-sm bg-sf-ink border border-white/10">
            <div className="text-[11px] font-semibold text-slate-400">Pontuação</div>
            <div className="font-mono-num text-xl font-black text-white mt-0.5">{summary.score}</div>
          </div>
          <div className="p-3 sf-chamfer-sm bg-sf-ink border border-white/10">
            <div className="text-[11px] font-semibold text-slate-400">Combo Máx</div>
            <div className="font-mono-num text-xl font-black text-sf-gold mt-0.5">
              {summary.maxCombo} HITS
            </div>
          </div>
          <div className="p-3 sf-chamfer-sm bg-sf-ink border border-white/10">
            <div className="text-[11px] font-semibold text-slate-400">Defesas Perfeitas</div>
            <div className="font-mono-num text-xl font-black text-yellow-300 mt-0.5">
              {summary.perfectParries}
            </div>
          </div>
          <div className="p-3 sf-chamfer-sm bg-sf-ink border border-white/10">
            <div className="text-[11px] font-semibold text-slate-400">XP Geral</div>
            <div className="font-mono-num text-xl font-black text-sf-cyan mt-0.5">
              +{summary.xpEarned}
            </div>
          </div>
          <div className="p-3 sf-chamfer-sm bg-sf-ink border border-white/10">
            <div className="text-[11px] font-semibold text-slate-400">Maestria</div>
            <div className="font-mono-num text-xl font-black text-sf-violet mt-0.5">
              +{summary.masteryXpEarned}
            </div>
          </div>
          <div className="p-3 sf-chamfer-sm bg-sf-ink border border-white/10">
            <div className="text-[11px] font-semibold text-slate-400">Moedas</div>
            <div className="font-mono-num text-xl font-black text-emerald-400 flex items-center justify-center gap-1 mt-0.5">
              <Coins className="w-4 h-4" /> +{summary.coinsEarned}
            </div>
          </div>
        </div>

        <div className="p-3.5 sf-chamfer-sm bg-sf-ink border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-extrabold text-white flex items-center gap-1.5">
              <Award className="w-4 h-4 text-sf-gold" /> Nível {profile.level}
              {leveledUp && (
                <span className="text-[11px] font-black text-emerald-400">+NÍVEL!</span>
              )}
            </span>
            <span className="font-mono-num text-[11px] text-slate-400">
              {profile.xp} / {profile.xpToNext} XP
            </span>
          </div>
          <div className="h-2.5 bg-sf-ink -skew-x-12 border border-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sf-amber to-sf-gold transition-all duration-500"
              style={{ width: `${xpPct}%` }}
            />
          </div>
        </div>

        <div className="space-y-2.5">
          {hasNextArcade && onNextArcadeStage && (
            <ActionButton
              variant="emerald"
              size="lg"
              className="w-full"
              onClick={() => {
                gameAudio.playSelectSnap();
                onNextArcadeStage();
              }}
            >
              PRÓXIMA LUTA ({(summary.arcadeStage || 1) + 1}/{ARCADE_LADDER.length})
            </ActionButton>
          )}

          <ActionButton
            variant="gold"
            size="lg"
            className="w-full"
            onClick={() => {
              gameAudio.playClick();
              onRematch();
            }}
          >
            <RotateCcw className="w-5 h-5" /> JOGAR NOVAMENTE
          </ActionButton>

          <ActionButton
            variant="steel"
            className="w-full"
            onClick={() => {
              gameAudio.playClick();
              onBackToMenu();
            }}
          >
            Menu Principal
          </ActionButton>
        </div>
      </StreetPanel>
    </div>
  );
}

interface ProfileScreenProps {
  profile: PlayerProfile;
  authorizationMode: boolean;
  onChangeNickname: (name: string) => void;
  onClaimDailyChallenge: (challengeId: string) => void;
  onOpenInventory: () => void;
  onBack: () => void;
}

export function ProfileScreen({
  profile,
  authorizationMode,
  onChangeNickname,
  onClaimDailyChallenge,
  onOpenInventory,
  onBack,
}: ProfileScreenProps) {
  const [nameInput, setNameInput] = useState(profile.nickname);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  return (
    <div className="w-full h-full overflow-y-auto bg-sf-bg text-slate-100 flex flex-col sf-halftone-bg">
      <ScreenHeader
        title="PERFIL & MAESTRIA"
        subtitle="Progresso da conta, desafios diários e conquistas de Salvador"
        onBack={onBack}
        rightSlot={
          <span className="text-xs font-mono-num font-black text-sf-gold">
            Nível {profile.level}
          </span>
        }
      />

      <main className="flex-1 p-4 sm:p-5 max-w-5xl w-full mx-auto space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Player Identity & Currencies */}
          <StreetPanel tone="gold" chamfer="md" className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 sf-chamfer-sm bg-sf-gold/15 border border-sf-gold/50 flex items-center justify-center shrink-0">
                <User className="w-7 h-7 text-sf-gold" />
              </div>
              <div className="min-w-0">
                <h2 className="font-display italic text-3xl font-black text-white truncate leading-none">
                  {profile.nickname}
                </h2>
                <div className="text-xs text-sf-cyan font-mono-num font-bold mt-1">
                  {profile.rankPoints} PTS de Ranking
                </div>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const res = validateNickname(nameInput);
                if (!res.valid) {
                  setNameError(res.error || 'Apelido inválido.');
                  return;
                }
                setNameError(null);
                onChangeNickname(res.cleaned);
                gameAudio.playCoin();
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
              }}
              className="space-y-1.5"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={18}
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-2 sf-chamfer-sm bg-sf-ink border border-white/18 text-xs font-bold text-white focus:outline-none focus:border-sf-gold"
                />
                <ActionButton type="submit" variant="gold" size="sm">
                  <Save className="w-3.5 h-3.5" /> {saved ? 'Salvo' : 'Salvar'}
                </ActionButton>
              </div>
              {nameError && <p className="text-[11px] text-red-400 font-semibold">{nameError}</p>}
            </form>

            <StatGauge
              label={`Nível ${profile.level}`}
              value={profile.xp}
              max={profile.xpToNext}
              valueLabel={`${profile.xp}/${profile.xpToNext}`}
              tone="gold"
            />

            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 sf-chamfer-sm bg-sf-ink border border-white/10">
                <div className="text-[11px] font-semibold text-slate-400">Vitórias</div>
                <div className="font-mono-num text-xl font-black text-emerald-400 mt-0.5">
                  {profile.wins}
                </div>
              </div>
              <div className="p-3 sf-chamfer-sm bg-sf-ink border border-white/10">
                <div className="text-[11px] font-semibold text-slate-400">Derrotas</div>
                <div className="font-mono-num text-xl font-black text-red-400 mt-0.5">
                  {profile.losses}
                </div>
              </div>
              <div className="p-3 sf-chamfer-sm bg-sf-ink border border-white/10">
                <div className="text-[11px] font-semibold text-slate-400">Moedas</div>
                <div className="font-mono-num text-xl font-black text-sf-gold mt-0.5">
                  {profile.coins.toLocaleString('pt-BR')}
                </div>
              </div>
              <div className="p-3 sf-chamfer-sm bg-sf-ink border border-white/10">
                <div className="text-[11px] font-semibold text-slate-400">Diamantes</div>
                <div className="font-mono-num text-xl font-black text-sf-cyan mt-0.5">
                  {profile.diamonds}
                </div>
              </div>
            </div>

            <ActionButton
              variant="steel"
              className="w-full"
              onClick={() => {
                gameAudio.playClick();
                onOpenInventory();
              }}
            >
              <Package className="w-4 h-4 text-sf-gold" /> Inventário (Skins & Poderes)
            </ActionButton>
          </StreetPanel>

          {/* Daily Challenges */}
          <StreetPanel tone="cyan" chamfer="md" className="p-4 sm:p-5 space-y-3">
            <h3 className="font-display italic text-2xl font-black text-sf-gold flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> DESAFIOS DIÁRIOS
            </h3>
            <div className="space-y-2.5">
              {profile.dailyChallenges.map((dc) => {
                const done = dc.progress >= dc.target;
                const pct = Math.min(100, Math.round((dc.progress / dc.target) * 100));
                return (
                  <div
                    key={dc.id}
                    className="p-3.5 sf-chamfer-sm bg-sf-ink border border-white/10 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-extrabold text-white">{dc.title}</span>
                      <span className="font-mono-num font-black text-sf-gold shrink-0">
                        {Math.min(dc.progress, dc.target)}/{dc.target}
                      </span>
                    </div>
                    <div className="h-2 bg-sf-ink -skew-x-12 border border-white/10 overflow-hidden">
                      <div className="h-full bg-sf-gold" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-mono-num">
                        Recompensa: +{dc.rewardCoins}M · +{dc.rewardDiamonds}D
                      </span>
                      {dc.claimed ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Resgatado
                        </span>
                      ) : done ? (
                        <ActionButton
                          variant="emerald"
                          size="sm"
                          onClick={() => {
                            gameAudio.playCoin();
                            onClaimDailyChallenge(dc.id);
                          }}
                        >
                          RESGATAR
                        </ActionButton>
                      ) : (
                        <span className="text-slate-500">Em andamento</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </StreetPanel>
        </div>

        {/* Mastery per Fighter */}
        <StreetPanel chamfer="md" className="p-4 sm:p-5 space-y-3">
          <h3 className="font-display italic text-2xl font-black text-white">
            MAESTRIA DOS LUTADORES
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {FIGHTERS_LIST.map((f) => {
              const mxp = profile.fighterMasteryXp[f.id] || 0;
              const info = getMasteryLevel(mxp);
              const meta = getDisplayFighterMeta(f.id, authorizationMode);
              return (
                <div
                  key={f.id}
                  className="p-3.5 sf-chamfer-sm bg-sf-ink border border-white/10 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-white truncate">{meta.name}</span>
                    <span className="font-mono-num font-black text-sf-gold shrink-0">
                      Nv.{info.level}
                    </span>
                  </div>
                  <div className="text-[11px] text-sf-cyan font-bold truncate">
                    {f.masteryTitles[info.titleIdx]}
                  </div>
                  <div className="h-1.5 bg-sf-ink -skew-x-12 overflow-hidden">
                    <div className="h-full bg-sf-purple" style={{ width: `${info.pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </StreetPanel>

        {/* Achievements & Match History */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <StreetPanel chamfer="md" className="p-4 sm:p-5 space-y-3">
            <h3 className="font-display italic text-2xl font-black text-white">CONQUISTAS</h3>
            <div className="space-y-2">
              {ACHIEVEMENTS.map((ach) => {
                const unlocked = profile.achievements.includes(ach.id);
                return (
                  <div
                    key={ach.id}
                    className={`p-3 sf-chamfer-sm border flex items-center justify-between gap-2 text-xs ${
                      unlocked
                        ? 'bg-sf-gold/12 border-sf-gold/45'
                        : 'bg-sf-ink border-white/8 opacity-65'
                    }`}
                  >
                    <div>
                      <div className="font-extrabold text-white">{ach.title}</div>
                      <div className="text-[11px] text-slate-400">{ach.description}</div>
                    </div>
                    <span className="font-mono-num text-[11px] font-black text-sf-gold shrink-0">
                      {unlocked ? 'LIBERADA' : `+${ach.rewardCoins}M`}
                    </span>
                  </div>
                );
              })}
            </div>
          </StreetPanel>

          <StreetPanel chamfer="md" className="p-4 sm:p-5 space-y-3">
            <h3 className="font-display italic text-2xl font-black text-white">ÚLTIMAS LUTAS</h3>
            {profile.matchHistory.length === 0 ? (
              <p className="text-xs text-slate-400">Nenhuma luta registrada ainda.</p>
            ) : (
              <div className="space-y-2">
                {profile.matchHistory.slice(0, 6).map((m, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 p-3 sf-chamfer-sm bg-sf-ink border border-white/10 text-xs"
                  >
                    <div className="min-w-0 truncate">
                      <span
                        className={`font-black ${
                          m.winner === 'p1' ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {m.winner === 'p1' ? 'V' : 'D'}
                      </span>{' '}
                      · {getDisplayFighterMeta(m.p1FighterId, authorizationMode).name} ×{' '}
                      {getDisplayFighterMeta(m.p2FighterId, authorizationMode).name} (
                      {m.p1RoundsWon}–{m.p2RoundsWon})
                    </div>
                    <div className="font-mono-num text-[11px] font-bold text-sf-gold shrink-0">
                      {m.score} PTS
                    </div>
                  </div>
                ))}
              </div>
            )}
          </StreetPanel>
        </div>
      </main>
    </div>
  );
}

interface SettingsScreenProps {
  settings: GameSettings;
  onUpdate: (next: GameSettings) => void;
  onBack: () => void;
}

const BINDING_LABELS: Array<{ key: keyof KeyBindings; label: string }> = [
  { key: 'left', label: 'Esquerda' },
  { key: 'right', label: 'Direita' },
  { key: 'up', label: 'Pular' },
  { key: 'down', label: 'Agachar / Defesa' },
  { key: 'punchLight', label: 'Soco Leve' },
  { key: 'punchHeavy', label: 'Soco Forte' },
  { key: 'kickLight', label: 'Chute Leve' },
  { key: 'kickHeavy', label: 'Chute Forte' },
  { key: 'dodge', label: 'Esquiva' },
  { key: 'grab', label: 'Agarrão' },
  { key: 'special1', label: 'Especial' },
  { key: 'superMove', label: 'Super Poder' },
];

export function SettingsScreen({ settings, onUpdate, onBack }: SettingsScreenProps) {
  const [listeningKey, setListeningKey] = useState<keyof KeyBindings | null>(null);

  const update = (patch: Partial<GameSettings>) => {
    const next = { ...settings, ...patch };
    gameAudio.configureMix({
      masterVolume: next.masterVolume,
      musicVolume: next.musicVolume,
      sfxVolume: next.sfxVolume,
      voiceVolume: next.voiceVolume,
      sfxEnabled: next.sfxEnabled,
    });
    onUpdate(next);
  };

  useEffect(() => {
    if (!listeningKey) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.code !== 'Escape') {
        const nextBindings = { ...settings.keyBindings, [listeningKey]: e.code };
        onUpdate({ ...settings, keyBindings: nextBindings });
      }
      setListeningKey(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [listeningKey, onUpdate, settings]);

  return (
    <div className="w-full h-full overflow-y-auto bg-sf-bg text-slate-100 flex flex-col sf-halftone-bg">
      <ScreenHeader
        title="CONFIGURAÇÕES"
        subtitle="Mixagem de áudio, qualidade 3D, orientação mobile e controles"
        onBack={onBack}
        rightSlot={<Sliders className="w-4 h-4 text-sf-gold" />}
      />

      <main className="flex-1 p-4 sm:p-5 max-w-4xl w-full mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Audio & Display */}
        <StreetPanel tone="gold" chamfer="md" className="p-4 sm:p-5 space-y-4">
          <h2 className="font-display italic text-2xl font-black text-sf-gold">
            ÁUDIO & QUALIDADE
          </h2>

          {(
            [
              { key: 'masterVolume', label: 'Volume Geral' },
              { key: 'musicVolume', label: 'Música de Arena' },
              { key: 'sfxVolume', label: 'Efeitos de Golpes' },
              { key: 'voiceVolume', label: 'Voz Narrador (PT-BR)' },
            ] as const
          ).map((vol) => (
            <div key={vol.key}>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span>{vol.label}</span>
                <span className="font-mono-num text-sf-gold">
                  {Math.round(settings[vol.key] * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings[vol.key]}
                onChange={(e) => update({ [vol.key]: parseFloat(e.target.value) })}
                className="w-full accent-sf-gold"
              />
            </div>
          ))}

          <div className="grid grid-cols-2 gap-2">
            <ActionButton
              variant={settings.sfxEnabled ? 'gold' : 'steel'}
              size="sm"
              className="w-full"
              onClick={() => update({ sfxEnabled: !settings.sfxEnabled })}
            >
              Áudio: {settings.sfxEnabled ? 'Sim' : 'Não'}
            </ActionButton>
            <ActionButton
              variant={settings.cameraShake ? 'gold' : 'steel'}
              size="sm"
              className="w-full"
              onClick={() => update({ cameraShake: !settings.cameraShake })}
            >
              Tremor: {settings.cameraShake ? 'Sim' : 'Não'}
            </ActionButton>
            <ActionButton
              variant={settings.showHitEffects ? 'gold' : 'steel'}
              size="sm"
              className="w-full"
              onClick={() => update({ showHitEffects: !settings.showHitEffects })}
            >
              Partículas 3D: {settings.showHitEffects ? 'Sim' : 'Não'}
            </ActionButton>
            <ActionButton
              variant={settings.hapticsEnabled ? 'gold' : 'steel'}
              size="sm"
              className="w-full"
              onClick={() => update({ hapticsEnabled: !settings.hapticsEnabled })}
            >
              Vibração Touch: {settings.hapticsEnabled ? 'Sim' : 'Não'}
            </ActionButton>
          </div>

          <div>
            <div className="text-xs font-bold mb-1.5">Qualidade Gráfica 3D</div>
            <div className="grid grid-cols-4 gap-1.5">
              {(
                [
                  { id: 'auto', label: 'Auto' },
                  { id: 'high', label: 'Alta' },
                  { id: 'medium', label: 'Média' },
                  { id: 'low', label: 'Baixa' },
                ] as const
              ).map((q) => (
                <ActionButton
                  key={q.id}
                  variant={settings.quality === q.id ? 'gold' : 'steel'}
                  size="sm"
                  className="w-full"
                  onClick={() => update({ quality: q.id })}
                >
                  {q.label}
                </ActionButton>
              ))}
            </div>
          </div>

          {/* Authorization Mode Switch */}
          <div className="p-3.5 sf-chamfer-sm bg-sf-ink border border-white/12 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-sf-cyan" /> Modo de Imagem & Nomes
              </span>
              <ActionButton
                variant={settings.authorizationMode ? 'gold' : 'cyan'}
                size="sm"
                onClick={() => update({ authorizationMode: !settings.authorizationMode })}
              >
                {settings.authorizationMode ? 'Autorizados' : 'Fictícios'}
              </ActionButton>
            </div>
            <p className="text-[11px] text-slate-400">
              Permite alternar personagens inspirados em figuras públicas para nomes e visuais substitutos 100% fictícios.
            </p>
          </div>
        </StreetPanel>

        {/* Orientation, Touch Layout & Keyboard Remapping */}
        <StreetPanel tone="cyan" chamfer="md" className="p-4 sm:p-5 space-y-4">
          <h2 className="font-display italic text-2xl font-black text-sf-cyan">
            CONTROLES & ORIENTAÇÃO
          </h2>

          <div>
            <div className="text-xs font-bold mb-1.5">Orientação no Celular</div>
            <div className="grid grid-cols-2 gap-2">
              <ActionButton
                variant={settings.mobileOrientation === 'landscape' ? 'gold' : 'steel'}
                size="sm"
                className="w-full"
                onClick={() => update({ mobileOrientation: 'landscape' })}
              >
                Deitado (Paisagem)
              </ActionButton>
              <ActionButton
                variant={settings.mobileOrientation === 'portrait' ? 'gold' : 'steel'}
                size="sm"
                className="w-full"
                onClick={() => update({ mobileOrientation: 'portrait' })}
              >
                Em pé (Retrato)
              </ActionButton>
            </div>
          </div>

          <div>
            <div className="text-xs font-bold mb-1.5">Dispositivo de Entrada</div>
            <div className="grid grid-cols-4 gap-1.5">
              {(
                [
                  { id: 'auto', label: 'Auto' },
                  { id: 'touch', label: 'Touch' },
                  { id: 'keyboard', label: 'Teclado' },
                  { id: 'xbox', label: 'Controle' },
                ] as const
              ).map((c) => (
                <ActionButton
                  key={c.id}
                  variant={settings.controlScheme === c.id ? 'gold' : 'steel'}
                  size="sm"
                  className="w-full"
                  onClick={() => update({ controlScheme: c.id })}
                >
                  {c.label}
                </ActionButton>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between text-[11px] font-bold mb-1">
                <span>Tamanho Touch</span>
                <span className="font-mono-num text-sf-gold">
                  {Math.round(settings.touchLayoutScale * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.8}
                max={1.25}
                step={0.05}
                value={settings.touchLayoutScale}
                onChange={(e) => update({ touchLayoutScale: parseFloat(e.target.value) })}
                className="w-full accent-sf-gold"
              />
            </div>
            <div>
              <div className="flex justify-between text-[11px] font-bold mb-1">
                <span>Altura Touch</span>
                <span className="font-mono-num text-sf-gold">
                  {settings.touchButtonsOffsetY}px
                </span>
              </div>
              <input
                type="range"
                min={-36}
                max={24}
                step={4}
                value={settings.touchButtonsOffsetY}
                onChange={(e) => update({ touchButtonsOffsetY: parseInt(e.target.value, 10) })}
                className="w-full accent-sf-gold"
              />
            </div>
          </div>

          <ActionButton
            variant={settings.commandAssist ? 'gold' : 'steel'}
            size="sm"
            className="w-full"
            onClick={() => update({ commandAssist: !settings.commandAssist })}
          >
            Command Assist: {settings.commandAssist ? 'Simplificado' : 'Avançado'}
          </ActionButton>

          {/* Key Remapping */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-white">
              <span className="flex items-center gap-1.5">
                <Keyboard className="w-4 h-4 text-sf-gold" /> Teclas do PC (clique para mudar)
              </span>
              <button
                type="button"
                onClick={() => update({ keyBindings: DEFAULT_KEY_BINDINGS })}
                className="text-[11px] text-sf-cyan hover:underline font-bold"
              >
                Restaurar Padrão
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1">
              {BINDING_LABELS.map((item) => {
                const isWaiting = listeningKey === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setListeningKey(item.key)}
                    className={`flex items-center justify-between px-2.5 py-1.5 sf-chamfer-sm border text-[11px] transition-colors ${
                      isWaiting
                        ? 'bg-sf-gold text-black border-white font-black'
                        : 'bg-sf-ink border-white/12 text-slate-200 hover:border-sf-gold/50'
                    }`}
                  >
                    <span className="truncate">{item.label}</span>
                    <span className="font-mono-num text-[10px] font-bold text-sf-gold">
                      {isWaiting ? 'TECLE...' : settings.keyBindings[item.key].replace('Key', '')}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </StreetPanel>
      </main>
    </div>
  );
}
