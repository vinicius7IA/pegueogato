import { useScreenRouter } from './router';
import {
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flame,
  Globe,
  MapPin,
  Settings,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Swords,
  Trophy,
  User,
  Users,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Component, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import salvadorBackdrop from './assets/images/salvador_arena_cinematic_1794790674658.jpg';
import { ArenaView } from './components/ArenaView';
import { CharacterSelectScreen, type SelectFlow } from './components/CharacterSelectScreen';
import { FighterPreview3D } from './components/FighterPreview3D';
import { MainMenu, type MenuOption } from './components/MainMenu';
import { CreditsScreen } from './components/CreditsScreen';
import { BracketScreen } from './components/BracketScreen';
import { MultiplayerScreen } from './components/MultiplayerScreen';
import {
  ProfileScreen,
  ResultScreen,
  SettingsScreen,
} from './components/ProfileSettingsResultScreens';
import { InventoryScreen, ShopScreen } from './components/ShopAndInventoryScreens';
import { StageSelectScreen } from './components/StageSelectScreen';
import { ActionButton, CurrencyStrip, ModalFrame, StreetPanel } from './components/ui/FightingUI';
import { gameAudio } from './game/audio';
import {
  ACHIEVEMENTS,
  ARCADE_LADDER,
  TOURNAMENT_LADDER,
  isPlayableFighter,
  ARENAS,
  FIGHTERS,
  getDisplayFighterMeta,
  loadProfile,
  loadSettings,
  POWERS,
  saveProfile,
  saveSettings,
  SKINS,
  validateNickname,
} from './game/catalog';
import {
  AiDifficulty,
  ArenaId,
  FighterId,
  GameSettings,
  MatchMode,
  MatchSummary,
  MobileOrientation,
  PlayerProfile,
  PowerId,
  ScreenId,
} from './game/types';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, message: '' };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Erro inesperado durante a renderização.',
    };
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full bg-sf-bg flex items-center justify-center p-6 text-slate-100">
          <StreetPanel tone="crimson" chamfer="lg" className="max-w-md w-full p-6 text-center space-y-4">
            <h2 className="font-display italic text-3xl font-black text-white">
              PAUSA INESPERADA NA ARENA
            </h2>
            <p className="text-xs text-slate-300">{this.state.message}</p>
            <ActionButton
              variant="gold"
              className="w-full"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.reload();
              }}
            >
              Recarregar Jogo
            </ActionButton>
          </StreetPanel>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AppShell />
    </AppErrorBoundary>
  );
}

function AppShell() {
  const [profile, setProfile] = useState<PlayerProfile>(() => loadProfile());
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());

  const [screen, setScreen] = useScreenRouter(profile.hasCompletedOnboarding);
  const [inventoryReturnScreen, setInventoryReturnScreen] = useState<ScreenId>('menu');

  // Protagonista padrão P1: Beto Chuta-Porta; rival padrão P2: O Maluco
  const [p1Fighter, setP1Fighter] = useState<FighterId>('policial');
  const [p2Fighter, setP2Fighter] = useState<FighterId>('maluco');
  const [arenaId, setArenaId] = useState<ArenaId>('farol_barra');
  const [matchMode, setMatchMode] = useState<MatchMode>('vs_ai');
  /** Modo escolhido no menu: define o fluxo da seleção e da partida. */
  const [flow, setFlow] = useState<SelectFlow>('arcade');
  const ladder = flow === 'torneio' ? TOURNAMENT_LADDER : ARCADE_LADDER;
  const [aiDifficulty, setAiDifficulty] = useState<AiDifficulty>(settings.aiDifficulty);
  const [arcadeStage, setArcadeStage] = useState<number>(1);
  const [p2Nickname, setP2Nickname] = useState<string>('IA de Salvador');

  // Onboarding / Login state
  const [loginName, setLoginName] = useState<string>(() =>
    profile.hasCompletedOnboarding ? profile.nickname : '',
  );
  const [loginError, setLoginError] = useState<string | null>(null);

  // Mobile first-launch orientation modal state
  const [showOrientationPrompt, setShowOrientationPrompt] = useState(false);

  // Achievement / Toast feedback
  const [bannerToast, setBannerToast] = useState<string | null>(null);

  const onlineSocketRef = useRef<WebSocket | null>(null);
  const [onlineRole, setOnlineRole] = useState<'host' | 'guest'>('host');
  const [onlineLoadout, setOnlineLoadout] = useState<{
    p1Skin: string;
    p1Power: PowerId;
    p2Skin: string;
    p2Power: PowerId;
  } | null>(null);

  const [lastResult, setLastResult] = useState<MatchSummary | null>(null);
  const [leveledUp, setLeveledUp] = useState(false);

  const showToast = useCallback((msg: string) => {
    setBannerToast(msg);
    window.setTimeout(() => {
      setBannerToast((curr) => (curr === msg ? null : curr));
    }, 3200);
  }, []);

  // Configure Web Audio mix whenever settings change
  useEffect(() => {
    gameAudio.configureMix({
      masterVolume: settings.masterVolume,
      musicVolume: settings.musicVolume,
      sfxVolume: settings.sfxVolume,
      voiceVolume: settings.voiceVolume,
      sfxEnabled: settings.sfxEnabled,
    });
  }, [
    settings.masterVolume,
    settings.musicVolume,
    settings.sfxVolume,
    settings.voiceVolume,
    settings.sfxEnabled,
  ]);

  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024,
  );

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Global first-gesture audio unlock
  useEffect(() => {
    const unlock = () => {
      gameAudio.unlockAudio();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // Auto-advance animated Splash screen
  useEffect(() => {
    if (screen !== 'splash') return;
    const timer = window.setTimeout(() => {
      setScreen(profile.hasCompletedOnboarding ? 'menu' : 'login');
    }, 2000);
    return () => clearTimeout(timer);
  }, [screen, profile.hasCompletedOnboarding]);

  // Detect narrow/touch device without orientation preference chosen yet
  useEffect(() => {
    if (screen !== 'menu' || settings.mobileOrientation !== null) return;
    const isTouchOrNarrow =
      window.innerWidth < 860 ||
      'ontouchstart' in window ||
      (navigator.maxTouchPoints ?? 0) > 0;
    if (isTouchOrNarrow) {
      setShowOrientationPrompt(true);
    }
  }, [screen, settings.mobileOrientation]);

  const updateProfile = useCallback((updater: (prev: PlayerProfile) => PlayerProfile) => {
    setProfile((prev) => {
      const next = updater(prev);
      saveProfile(next);
      return next;
    });
  }, []);

  const handleUpdateSettings = useCallback((next: GameSettings) => {
    setSettings(next);
    saveSettings(next);
  }, []);

  const handleSelectOrientation = (orientation: MobileOrientation) => {
    gameAudio.unlockAudio();
    gameAudio.playClick();
    handleUpdateSettings({ ...settings, mobileOrientation: orientation });
    setShowOrientationPrompt(false);
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    gameAudio.unlockAudio();
    const res = validateNickname(loginName);
    if (!res.valid) {
      setLoginError(res.error || 'Nome inválido.');
      return;
    }
    setLoginError(null);
    gameAudio.playSpecial();
    updateProfile((prev) => ({
      ...prev,
      nickname: res.cleaned,
      hasCompletedOnboarding: true,
    }));
    setScreen('menu');
  };

  const handleMatchFinish = useCallback(
    (summary: MatchSummary) => {
      if (onlineSocketRef.current) {
        onlineSocketRef.current.close();
        onlineSocketRef.current = null;
      }

      // Modo Treino não infla ranking, vitórias ou moedas
      if (summary.mode === 'training') {
        setLastResult(summary);
        setLeveledUp(false);
        setScreen('result');
        return;
      }

      let didLevelUp = false;
      const unlockedNow: string[] = [];

      updateProfile((prev) => {
        let xp = prev.xp + summary.xpEarned;
        let level = prev.level;
        let xpToNext = prev.xpToNext;
        while (xp >= xpToNext) {
          xp -= xpToNext;
          level += 1;
          xpToNext = Math.round(xpToNext * 1.35);
          didLevelUp = true;
        }

        const isWin = summary.winner === 'p1';
        const isLoss = summary.winner === 'p2';

        // Maestria por lutador
        const nextMastery = {
          ...prev.fighterMasteryXp,
          [summary.p1FighterId]:
            (prev.fighterMasteryXp[summary.p1FighterId] || 0) + summary.masteryXpEarned,
        };

        // Progresso dos desafios diários
        const nextDaily = prev.dailyChallenges.map((dc) => {
          if (dc.claimed || dc.progress >= dc.target) return dc;
          let inc = 0;
          if (dc.kind === 'wins' && isWin) inc = 1;
          else if (dc.kind === 'combos' && summary.maxCombo >= 4) inc = 1;
          else if (dc.kind === 'parries') inc = summary.perfectParries;
          else if (dc.kind === 'specials' && summary.finisherUsed) inc = 1;
          if (inc <= 0) return dc;
          return { ...dc, progress: Math.min(dc.target, dc.progress + inc) };
        });

        // Avaliar conquistas desbloqueadas nesta luta
        const achievements = new Set(prev.achievements);
        let achievementBonusCoins = 0;
        const unlockAch = (id: string) => {
          if (!achievements.has(id)) {
            achievements.add(id);
            const def = ACHIEVEMENTS.find((a) => a.id === id);
            if (def) {
              achievementBonusCoins += def.rewardCoins;
              unlockedNow.push(def.title);
            }
          }
        };

        if (isWin) unlockAch('first_win');
        if (summary.maxCombo >= 5) unlockAch('combo_5');
        if (summary.perfectRounds > 0) unlockAch('perfect_round');
        if (summary.perfectParries >= 3) unlockAch('parry_master');
        if (summary.finisherUsed && isWin) unlockAch('finisher_ko');
        if (
          summary.mode === 'arcade' &&
          isWin &&
          summary.arcadeStage === ARCADE_LADDER.length
        ) {
          unlockAch('arcade_champ');
        }

        const rankDelta =
          summary.mode === 'local_2p'
            ? 0
            : isWin
              ? summary.mode === 'online'
                ? 35
                : 15
              : isLoss
                ? summary.mode === 'online'
                  ? -15
                  : -5
                : 0;

        return {
          ...prev,
          level,
          xp,
          xpToNext,
          coins: prev.coins + summary.coinsEarned + achievementBonusCoins,
          wins: prev.wins + (isWin ? 1 : 0),
          losses: prev.losses + (isLoss ? 1 : 0),
          rankPoints: Math.max(800, prev.rankPoints + rankDelta),
          fighterMasteryXp: nextMastery,
          dailyChallenges: nextDaily,
          achievements: Array.from(achievements),
          matchHistory: [summary, ...prev.matchHistory].slice(0, 25),
        };
      });

      if (unlockedNow.length > 0) {
        showToast(`Conquista desbloqueada: ${unlockedNow[0]}!`);
      }

      setLeveledUp(didLevelUp);
      setLastResult(summary);

      if (summary.mode !== 'local_2p') {
        fetch('/api/matches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerName: profile.nickname,
            opponentName: summary.opponentName,
            winner: summary.winner,
            p1FighterId: summary.p1FighterId,
            p2FighterId: summary.p2FighterId,
            p1RoundsWon: summary.p1RoundsWon,
            p2RoundsWon: summary.p2RoundsWon,
            maxCombo: summary.maxCombo,
            score: summary.score,
            mode: summary.mode,
          }),
        }).catch(() => {});
      }

      setScreen('result');
    },
    [profile.nickname, showToast, updateProfile],
  );

  const handleBuyFighter = (id: FighterId) => {
    const f = FIGHTERS[id];
    updateProfile((prev) => {
      if (
        !isPlayableFighter(id) ||
        prev.unlockedFighters.includes(id) ||
        prev.coins < f.unlockCoins ||
        prev.diamonds < f.unlockDiamonds
      ) {
        return prev;
      }
      return {
        ...prev,
        coins: prev.coins - f.unlockCoins,
        diamonds: prev.diamonds - f.unlockDiamonds,
        unlockedFighters: [...prev.unlockedFighters, id],
      };
    });
  };

  const handleBuySkin = (skinId: string) => {
    const sk = SKINS.find((s) => s.id === skinId);
    if (!sk) return;
    updateProfile((prev) => {
      if (
        prev.unlockedSkins.includes(skinId) ||
        prev.coins < sk.priceCoins ||
        prev.diamonds < sk.priceDiamonds
      ) {
        return prev;
      }
      return {
        ...prev,
        coins: prev.coins - sk.priceCoins,
        diamonds: prev.diamonds - sk.priceDiamonds,
        unlockedSkins: [...prev.unlockedSkins, skinId],
        equippedSkins: { ...prev.equippedSkins, [sk.fighterId]: skinId },
      };
    });
  };

  const handleBuyPower = (powerId: PowerId) => {
    const pw = POWERS[powerId];
    updateProfile((prev) => {
      if (
        prev.unlockedPowers.includes(powerId) ||
        prev.coins < pw.priceCoins ||
        prev.diamonds < pw.priceDiamonds
      ) {
        return prev;
      }
      return {
        ...prev,
        coins: prev.coins - pw.priceCoins,
        diamonds: prev.diamonds - pw.priceDiamonds,
        unlockedPowers: [...prev.unlockedPowers, powerId],
      };
    });
  };

  const handleClaimDailyChallenge = (challengeId: string) => {
    updateProfile((prev) => {
      const target = prev.dailyChallenges.find((dc) => dc.id === challengeId);
      if (!target || target.claimed || target.progress < target.target) return prev;
      gameAudio.playCoin();
      return {
        ...prev,
        coins: prev.coins + target.rewardCoins,
        diamonds: prev.diamonds + target.rewardDiamonds,
        dailyChallenges: prev.dailyChallenges.map((dc) =>
          dc.id === challengeId ? { ...dc, claimed: true } : dc,
        ),
      };
    });
  };

  const launchArcadeStage = (stageNum: number) => {
    const ladderStage = ladder[Math.max(0, Math.min(ladder.length - 1, stageNum - 1))];
    setArcadeStage(ladderStage.stage);
    setMatchMode('arcade');
    setP2Fighter(ladderStage.opponentId);
    setArenaId(ladderStage.arenaId);
    setAiDifficulty(ladderStage.difficulty);
    setOnlineLoadout(null);
    setP2Nickname(flow === 'torneio' ? ladderStage.title.split(' · ')[1] : `Arcade ${ladderStage.stage}/${ladder.length}`);
    setScreen('arena');
  };

  const handleMenuSelect = (opt: MenuOption) => {
    gameAudio.unlockAudio();
    if (opt === 'config') {
      setScreen('settings');
      return;
    }
    if (opt === 'creditos') {
      setScreen('credits');
      return;
    }
    setFlow(opt);
    setScreen('select');
  };

  /** Arcade começa direto; Torneio passa pela chave antes de cada luta. */
  const startLadder = () => {
    if (flow === 'torneio') {
      setArcadeStage(1);
      setScreen('bracket');
    } else {
      launchArcadeStage(1);
    }
  };

  const launchFromStageSelect = () => {
    if (flow === 'versus') launchQuickFight('local_2p');
    else if (flow === 'treino') launchQuickFight('training');
    else launchQuickFight('vs_ai', aiDifficulty);
  };

  const launchQuickFight = (mode: MatchMode, diff: AiDifficulty = settings.aiDifficulty) => {
    gameAudio.unlockAudio();
    gameAudio.playSpecial();
    if (mode === 'arcade') {
      launchArcadeStage(1);
      return;
    }
    setMatchMode(mode);
    setAiDifficulty(diff);
    setOnlineLoadout(null);
    setP2Nickname(
      mode === 'training'
        ? 'Boneco de Treino'
        : mode === 'local_2p'
          ? 'Jogador 2'
          : 'IA de Salvador',
    );
    setScreen('arena');
  };

  const cycleArena = () => {
    const ids = Object.keys(ARENAS) as ArenaId[];
    const idx = ids.indexOf(arenaId);
    setArenaId(ids[(idx + 1) % ids.length]);
    gameAudio.playClick();
  };

  const cycleFighter = (slot: 'p1' | 'p2', dir: -1 | 1) => {
    const allIds = Object.keys(FIGHTERS) as FighterId[];
    const pool =
      allIds.filter((id) => isPlayableFighter(id) && (slot === 'p2' || profile.unlockedFighters.includes(id)));
    const current = slot === 'p1' ? p1Fighter : p2Fighter;
    const idx = pool.indexOf(current);
    const next = pool[(idx + dir + pool.length) % pool.length];
    if (slot === 'p1') setP1Fighter(next);
    else setP2Fighter(next);
    gameAudio.playSelectSnap();
  };

  // Portrait shell only when mobile user explicitly chooses 'portrait' OR is on a narrow screen (<768px) before choosing
  const isPortraitLayout =
    settings.mobileOrientation === 'portrait' ||
    (settings.mobileOrientation === null && viewportWidth < 768);

  const p1Meta = getDisplayFighterMeta(p1Fighter, settings.authorizationMode);
  const p2Meta = getDisplayFighterMeta(p2Fighter, settings.authorizationMode);
  const readyDailyCount = profile.dailyChallenges.filter(
    (dc) => !dc.claimed && dc.progress >= dc.target,
  ).length;

  const renderScreen = () => {
    if (screen === 'splash') {
      return (
        <button
          type="button"
          onClick={() => {
            gameAudio.unlockAudio();
            gameAudio.playSelectSnap();
            setScreen(profile.hasCompletedOnboarding ? 'menu' : 'login');
          }}
          className="relative w-full h-full flex flex-col items-center justify-center bg-sf-ink text-center p-6 overflow-hidden cursor-pointer focus-visible:outline-2 focus-visible:outline-sf-gold"
        >
          <img
            src={salvadorBackdrop}
            alt="Pelourinho Salvador"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover opacity-45 pointer-events-none"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-sf-bg/65 to-black pointer-events-none sf-speed-lines" />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="relative z-10 space-y-3"
          >
            <div className="text-xs font-black tracking-[0.35em] text-sf-cyan">
              SALVADOR · BAHIA · LIGA DE RUA 3D
            </div>
            <h1 className="font-display italic text-6xl sm:text-8xl font-black tracking-wide text-white drop-shadow-[0_6px_0_#ff462e]">
              BAHIA STRETAT
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-200 max-w-md mx-auto">
              Luta de rua baiana em tempo real com 8 lutadores e 10 arenas de Salvador.
            </p>
            <motion.div
              animate={{ opacity: [0.45, 1, 0.45] }}
              transition={{ repeat: Infinity, duration: 1.4 }}
              className="pt-5 text-xs font-black tracking-[0.25em] text-sf-gold uppercase"
            >
              Toque ou pressione para entrar
            </motion.div>
          </motion.div>
        </button>
      );
    }

    if (screen === 'login') {
      return (
        <div className="relative w-full h-full flex bg-sf-bg p-4 overflow-y-auto sf-halftone-bg">
          <img
            src={salvadorBackdrop}
            alt="Pelourinho Salvador"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover opacity-38 pointer-events-none"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/72 via-sf-bg/82 to-black pointer-events-none" />

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10 w-full max-w-md m-auto"
          >
            <StreetPanel tone="gold" chamfer="lg" textured className="p-4 sm:p-6 space-y-3 sm:space-y-5">
              <form onSubmit={handleLoginSubmit} className="space-y-5">
                <div className="text-center space-y-1 border-b border-white/10 pb-4">
                  <div className="text-[11px] font-black tracking-[0.28em] text-sf-cyan uppercase">
                    Registro de Lutador
                  </div>
                  <h1 className="font-display italic text-5xl font-black text-white drop-shadow-[0_3px_0_#ff462e]">
                    BAHIA STRETAT
                  </h1>
                  <p className="text-xs text-slate-400">
                    Escolha seu apelido para o ranking de Salvador e salas online.
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="nickname-input" className="block text-xs font-extrabold text-slate-200">
                    Apelido de Combate
                  </label>
                  <input
                    id="nickname-input"
                    type="text"
                    maxLength={18}
                    value={loginName}
                    onChange={(e) => {
                      setLoginName(e.target.value);
                      if (loginError) setLoginError(null);
                    }}
                    placeholder="Ex: SoldadoSSA"
                    className="w-full px-3.5 py-3 sf-chamfer-sm bg-sf-ink border border-white/18 text-sm font-bold text-white focus:outline-none focus:border-sf-gold"
                  />
                  {loginError && <p className="text-xs text-red-400 font-bold">{loginError}</p>}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {['SoldadoSSA', 'ReiDoPelô', 'GatoPretoBA'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        gameAudio.playClick();
                        setLoginName(preset);
                        setLoginError(null);
                      }}
                      className="py-2 px-2 sf-chamfer-sm bg-sf-raised border border-white/14 text-[11px] font-bold text-slate-200 hover:border-sf-gold/60 truncate transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <ActionButton type="submit" variant="gold" size="lg" className="w-full">
                  <Swords className="w-6 h-6" /> ENTRAR NA ARENA
                </ActionButton>

                <button
                  type="button"
                  onClick={() => {
                    gameAudio.unlockAudio();
                    gameAudio.playClick();
                    updateProfile((prev) => ({ ...prev, hasCompletedOnboarding: true }));
                    setScreen('menu');
                  }}
                  className="w-full py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
                >
                  Continuar como {profile.nickname}
                </button>
              </form>
            </StreetPanel>
          </motion.div>
        </div>
      );
    }

    if (screen === 'arena') {
      const p1Skin =
        matchMode === 'online' && onlineLoadout
          ? onlineLoadout.p1Skin
          : profile.equippedSkins[p1Fighter] || FIGHTERS[p1Fighter].defaultSkinId;
      const p1Power =
        matchMode === 'online' && onlineLoadout
          ? onlineLoadout.p1Power
          : profile.equippedPowers[p1Fighter] || FIGHTERS[p1Fighter].signaturePowerId;

      const p2Skin =
        matchMode === 'online' && onlineLoadout
          ? onlineLoadout.p2Skin
          : profile.equippedSkins[p2Fighter] || FIGHTERS[p2Fighter].defaultSkinId;
      const p2Power =
        matchMode === 'online' && onlineLoadout
          ? onlineLoadout.p2Power
          : profile.equippedPowers[p2Fighter] || FIGHTERS[p2Fighter].signaturePowerId;

      const hasUnlockedPower = profile.unlockedPowers.includes(p1Power);

      return (
        <ArenaView
          arenaId={arenaId}
          mode={matchMode}
          aiDifficulty={aiDifficulty}
          p1FighterId={p1Fighter}
          p1SkinId={p1Skin}
          p1PowerId={p1Power}
          hasUnlockedPower={hasUnlockedPower}
          p2FighterId={p2Fighter}
          p2SkinId={p2Skin}
          p2PowerId={p2Power}
          p2Nickname={matchMode === 'online' && onlineRole === 'guest' ? profile.nickname : p2Nickname}
          settings={settings}
          arcadeStage={matchMode === 'arcade' ? arcadeStage : undefined}
          onlineRole={onlineRole}
          onlineSocket={onlineSocketRef.current}
          onMatchFinish={handleMatchFinish}
          onExitArena={() => {
            if (onlineSocketRef.current) {
              onlineSocketRef.current.close();
              onlineSocketRef.current = null;
            }
            setScreen('menu');
          }}
        />
      );
    }

    if (screen === 'select') {
      return (
        <CharacterSelectScreen
          profile={profile}
          initialDifficulty={aiDifficulty}
          authorizationMode={settings.authorizationMode}
          arenaId={arenaId}
          p1Fighter={p1Fighter}
          p2Fighter={p2Fighter}
          onSelectP1={setP1Fighter}
          onSelectP2={setP2Fighter}
          onEquipSkin={(fid, sid) =>
            updateProfile((prev) => ({
              ...prev,
              equippedSkins: { ...prev.equippedSkins, [fid]: sid },
            }))
          }
          onEquipPower={(fid, pid) =>
            updateProfile((prev) => ({
              ...prev,
              equippedPowers: { ...prev.equippedPowers, [fid]: pid },
            }))
          }
          flow={flow}
          onOpenStageSelect={() => setScreen('stage_select')}
          onStartLadder={startLadder}
          onStartFight={(mode, diff) => {
            launchQuickFight(mode, diff);
          }}
          onOpenInventory={() => {
            setInventoryReturnScreen('select');
            setScreen('inventory');
          }}
          onBack={() => setScreen('menu')}
        />
      );
    }

    if (screen === 'stage_select') {
      return (
        <StageSelectScreen
          selectedArenaId={arenaId}
          onSelectArena={setArenaId}
          onConfirmFight={launchFromStageSelect}
          onBack={() => setScreen('select')}
        />
      );
    }

    if (screen === 'shop') {
      return (
        <ShopScreen
          profile={profile}
          authorizationMode={settings.authorizationMode}
          onBuyFighter={handleBuyFighter}
          onBuySkin={handleBuySkin}
          onBuyPower={handleBuyPower}
          onClaimBundle={(coins, diamonds) =>
            updateProfile((prev) => ({
              ...prev,
              coins: prev.coins + coins,
              diamonds: prev.diamonds + diamonds,
            }))
          }
          onBack={() => setScreen('menu')}
        />
      );
    }

    if (screen === 'inventory') {
      return (
        <InventoryScreen
          profile={profile}
          authorizationMode={settings.authorizationMode}
          onEquipSkin={(fid, sid) =>
            updateProfile((prev) => ({
              ...prev,
              equippedSkins: { ...prev.equippedSkins, [fid]: sid },
            }))
          }
          onEquipPower={(fid, pid) =>
            updateProfile((prev) => ({
              ...prev,
              equippedPowers: { ...prev.equippedPowers, [fid]: pid },
            }))
          }
          onBack={() => setScreen(inventoryReturnScreen)}
        />
      );
    }

    if (screen === 'multiplayer') {
      return (
        <MultiplayerScreen
          profile={profile}
          authorizationMode={settings.authorizationMode}
          selectedFighter={p1Fighter}
          selectedArenaId={arenaId}
          onSelectFighter={setP1Fighter}
          onLaunchOnlineMatch={(cfg) => {
            onlineSocketRef.current = cfg.socket;
            setOnlineRole(cfg.role);
            setArenaId(cfg.arenaId);
            setMatchMode('online');
            setP1Fighter(cfg.p1FighterId);
            setP2Fighter(cfg.p2FighterId);
            setP2Nickname(cfg.p2Nickname);
            setOnlineLoadout({
              p1Skin: cfg.p1SkinId,
              p1Power: cfg.p1PowerId,
              p2Skin: cfg.p2SkinId,
              p2Power: cfg.p2PowerId,
            });
            setScreen('arena');
          }}
          onBack={() => setScreen('menu')}
        />
      );
    }

    if (screen === 'result' && lastResult) {
      return (
        <ResultScreen
          summary={lastResult}
          profile={profile}
          leveledUp={leveledUp}
          authorizationMode={settings.authorizationMode}
          onRematch={() => {
            if (lastResult.mode === 'online') {
              setScreen('multiplayer');
            } else if (lastResult.mode === 'arcade') {
              launchArcadeStage(lastResult.arcadeStage || 1);
            } else {
              setScreen('arena');
            }
          }}
          onNextArcadeStage={
            lastResult.mode === 'arcade' &&
            lastResult.winner === 'p1' &&
            (lastResult.arcadeStage || 1) < ARCADE_LADDER.length
              ? () => {
                  const next = (lastResult.arcadeStage || 1) + 1;
                  if (flow === 'torneio') {
                    setArcadeStage(next);
                    setScreen('bracket');
                  } else {
                    launchArcadeStage(next);
                  }
                }
              : undefined
          }
          onBackToMenu={() => setScreen('menu')}
        />
      );
    }

    if (screen === 'credits') {
      return <CreditsScreen onBack={() => setScreen('menu')} />;
    }

    if (screen === 'bracket') {
      return (
        <BracketScreen
          ladder={TOURNAMENT_LADDER}
          currentStage={arcadeStage}
          p1Fighter={p1Fighter}
          p1Name={profile.nickname}
          onFight={() => launchArcadeStage(arcadeStage)}
          onBack={() => setScreen('menu')}
        />
      );
    }

    if (screen === 'profile') {
      return (
        <ProfileScreen
          profile={profile}
          authorizationMode={settings.authorizationMode}
          onChangeNickname={(nickname) =>
            updateProfile((prev) => ({ ...prev, nickname }))
          }
          onClaimDailyChallenge={handleClaimDailyChallenge}
          onOpenInventory={() => {
            setInventoryReturnScreen('profile');
            setScreen('inventory');
          }}
          onBack={() => setScreen('menu')}
        />
      );
    }

    if (screen === 'settings') {
      return (
        <SettingsScreen
          settings={settings}
          onUpdate={handleUpdateSettings}
          onBack={() => setScreen('menu')}
        />
      );
    }

    // Menu principal BAHIA STRETAT
    return (
      <MainMenu
        onSelect={handleMenuSelect}
        onOpenShop={() => setScreen('shop')}
        onOpenProfile={() => setScreen('profile')}
        onOpenOnline={() => setScreen('multiplayer')}
      />
    );
  };

  return (
    <div className="w-full h-full bg-[#040508] flex items-center justify-center overflow-hidden">
      <div
        className={
          isPortraitLayout
            ? 'w-full h-full max-w-[440px] relative bg-sf-bg overflow-hidden md:border-x md:border-white/12 shadow-2xl'
            : 'w-full h-full relative bg-sf-bg overflow-hidden'
        }
      >
        {renderScreen()}

        {bannerToast && (
          <div className="pointer-events-none absolute top-14 left-1/2 -translate-x-1/2 z-50 px-5 py-2 sf-chamfer-sm bg-emerald-400 border border-white text-black text-xs font-black shadow-2xl animate-hit-pop">
            {bannerToast}
          </div>
        )}

        {showOrientationPrompt && screen === 'menu' && (
          <ModalFrame tone="gold" maxWidthClass="max-w-sm">
            <div className="text-center space-y-2">
              <Smartphone className="w-8 h-8 text-sf-gold mx-auto" />
              <h2 className="font-display italic text-3xl font-black text-white">
                COMO VOCÊ QUER JOGAR?
              </h2>
              <p className="text-xs text-slate-400">
                Escolha o formato da tela no celular. Você pode trocar depois em Ajustes.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <ActionButton
                variant="gold"
                className="w-full"
                onClick={() => handleSelectOrientation('landscape')}
              >
                Deitado (Paisagem)
              </ActionButton>
              <ActionButton
                variant="steel"
                className="w-full"
                onClick={() => handleSelectOrientation('portrait')}
              >
                Em Pé (Retrato)
              </ActionButton>
            </div>
          </ModalFrame>
        )}
      </div>
    </div>
  );
}
