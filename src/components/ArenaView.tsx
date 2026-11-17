import { Eye, Home, Pause, Play, RotateCcw, Swords } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArenaCombatEngine, FighterInputState, OnlineSyncPacket } from '../game/arenaScene';
import { gameAudio } from '../game/audio';
import { FIGHTERS, getDisplayFighterMeta, POWERS } from '../game/catalog';
import {
  AiDifficulty,
  ArenaId,
  CombatHudSnapshot,
  FighterId,
  GameSettings,
  MatchMode,
  MatchSummary,
  PowerId,
  TrainingDummyMode,
} from '../game/types';
import { CombatControls } from './CombatControls';
import { ActionButton, StreetPanel } from './ui/FightingUI';

interface ArenaViewProps {
  arenaId: ArenaId;
  mode: MatchMode;
  aiDifficulty: AiDifficulty;
  p1FighterId: FighterId;
  p1SkinId: string;
  p1PowerId: PowerId;
  hasUnlockedPower: boolean;
  p2FighterId: FighterId;
  p2SkinId: string;
  p2PowerId: PowerId;
  p2Nickname: string;
  settings: GameSettings;
  arcadeStage?: number;
  onlineRole?: 'host' | 'guest';
  onlineSocket?: WebSocket | null;
  onMatchFinish: (summary: MatchSummary) => void;
  onExitArena: () => void;
}

export function ArenaView({
  arenaId,
  mode,
  aiDifficulty,
  p1FighterId,
  p1SkinId,
  p1PowerId,
  hasUnlockedPower,
  p2FighterId,
  p2SkinId,
  p2PowerId,
  p2Nickname,
  settings,
  arcadeStage,
  onlineRole,
  onlineSocket,
  onMatchFinish,
  onExitArena,
}: ArenaViewProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ArenaCombatEngine | null>(null);
  const [showMoveList, setShowMoveList] = useState(false);
  const [dummyMode, setDummyMode] = useState<TrainingDummyMode>('stand');
  const [showHitboxes, setShowHitboxes] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1024,
    h: typeof window !== 'undefined' ? window.innerHeight : 768,
  }));

  const onMatchFinishRef = useRef(onMatchFinish);
  onMatchFinishRef.current = onMatchFinish;
  const onlineSocketRef = useRef(onlineSocket);
  onlineSocketRef.current = onlineSocket;

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isNarrowViewport = viewport.w < viewport.h;
  const isPortraitLayout =
    settings.mobileOrientation === 'portrait' ||
    (settings.mobileOrientation === null && isNarrowViewport && viewport.w < 768);

  const [hud, setHud] = useState<CombatHudSnapshot>({
    p1Hp: 140,
    p1MaxHp: 140,
    p1Energy: 30,
    p1Stun: 0,
    p1Combo: 0,
    p1Multiplier: 1,
    p1Rounds: 0,
    p1State: 'idle',
    p1Buff: null,
    p1Title: FIGHTERS[p1FighterId].title,
    p2Hp: 140,
    p2MaxHp: 140,
    p2Energy: 30,
    p2Stun: 0,
    p2Combo: 0,
    p2Multiplier: 1,
    p2Rounds: 0,
    p2State: 'idle',
    p2Buff: null,
    p2Title: FIGHTERS[p2FighterId].title,
    timer: mode === 'training' ? 99 : settings.roundDurationSec,
    roundNumber: 1,
    bannerText: mode === 'training' ? 'MODO TREINO' : 'ROUND 1',
    calloutText: null,
    calloutSide: null,
    quoteText: null,
    quoteSide: null,
    damagePopups: [],
    hitboxRects: [],
    showHitboxes: false,
    isFinisherSlowmo: false,
    isPaused: false,
    matchFinished: false,
  });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;
    setEngineError(null);

    const activeEl = document.activeElement as HTMLElement | null;
    if (activeEl && typeof activeEl.blur === 'function') {
      activeEl.blur();
    }

    let engine: ArenaCombatEngine | null = null;
    try {
      engine = new ArenaCombatEngine({
        container,
        arenaId,
        mode,
        aiDifficulty,
        roundDurationSec: settings.roundDurationSec,
        p1FighterId,
        p1SkinId,
        p1PowerId,
        p2FighterId,
        p2SkinId,
        p2PowerId,
        p2Nickname,
        onlineRole,
        quality: settings.quality,
        cameraShake: settings.cameraShake,
        showHitEffects: settings.showHitEffects,
        authorizationMode: settings.authorizationMode,
        arcadeStage,
        onHudUpdate: (snapshot) => setHud(snapshot),
        onMatchFinish: (summary) => onMatchFinishRef.current(summary),
        onContextLost: (lost) => {
          setEngineError(
            lost
              ? 'O contexto gráfico 3D (WebGL) foi interrompido pelo navegador. Clique em Tentar Novamente.'
              : null,
          );
        },
        onSendOnlineState: (packet) => {
          const sock = onlineSocketRef.current;
          if (sock && sock.readyState === WebSocket.OPEN) {
            sock.send(JSON.stringify(packet));
          }
        },
      });
      engineRef.current = engine;
    } catch (err) {
      setEngineError(
        err instanceof Error && err.message
          ? err.message
          : 'Não foi possível iniciar o renderizador 3D da arena.',
      );
      engineRef.current = null;
    }

    return () => {
      engine?.dispose();
      engineRef.current = null;
    };
  }, [
    arenaId,
    mode,
    aiDifficulty,
    p1FighterId,
    p1SkinId,
    p1PowerId,
    p2FighterId,
    p2SkinId,
    p2PowerId,
    p2Nickname,
    arcadeStage,
    onlineRole,
    settings.roundDurationSec,
    settings.quality,
    settings.cameraShake,
    settings.showHitEffects,
    settings.authorizationMode,
    retryNonce,
  ]);

  useEffect(() => {
    if (mode !== 'online' || !onlineSocket) return;
    const onMessage = (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(ev.data) as OnlineSyncPacket;
        if (msg.type === 'fighter_sync') {
          engineRef.current?.applyOnlineRemotePacket(msg);
        }
      } catch {
        // ignore
      }
    };
    onlineSocket.addEventListener('message', onMessage);
    return () => onlineSocket.removeEventListener('message', onMessage);
  }, [mode, onlineSocket]);

  const handleP1Input = useCallback(
    (input: FighterInputState) => {
      if (mode === 'online' && onlineRole === 'guest') {
        engineRef.current?.setPlayerInput('p2', input);
      } else {
        engineRef.current?.setPlayerInput('p1', input);
      }
    },
    [mode, onlineRole],
  );

  const handleP2Input = useCallback((input: FighterInputState) => {
    engineRef.current?.setPlayerInput('p2', input);
  }, []);

  const togglePause = useCallback(() => {
    setHud((prev) => {
      const nextPaused = !prev.isPaused;
      engineRef.current?.setPaused(nextPaused);
      if (!nextPaused) setShowMoveList(false);
      return { ...prev, isPaused: nextPaused };
    });
  }, []);

  const p1Def = FIGHTERS[p1FighterId];
  const p2Def = FIGHTERS[p2FighterId];
  const p1Meta = getDisplayFighterMeta(p1FighterId, settings.authorizationMode);
  const p2Meta = getDisplayFighterMeta(p2FighterId, settings.authorizationMode);
  const p1Power = POWERS[p1PowerId];
  const p1Pct = Math.max(0, Math.min(100, (hud.p1Hp / hud.p1MaxHp) * 100));
  const p2Pct = Math.max(0, Math.min(100, (hud.p2Hp / hud.p2MaxHp) * 100));
  const p1Low = p1Pct <= 28;
  const p2Low = p2Pct <= 28;

  const stageViewport = (
    <div className="relative flex-1 min-h-0 w-full overflow-hidden bg-[#0b0d14]">
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {engineError && (
        <div className="absolute inset-0 z-40 bg-[#07080d]/95 flex items-center justify-center p-4">
          <StreetPanel tone="crimson" chamfer="lg" className="w-full max-w-sm p-6 text-center space-y-4">
            <h3 className="font-display italic text-2xl font-black text-white">
              ERRO AO CARREGAR ARENA 3D
            </h3>
            <p className="text-xs text-slate-300">{engineError}</p>
            <div className="flex flex-col gap-2">
              <ActionButton
                variant="gold"
                className="w-full"
                onClick={() => setRetryNonce((n) => n + 1)}
              >
                <RotateCcw className="w-4 h-4" /> Tentar Novamente
              </ActionButton>
              <ActionButton variant="steel" className="w-full" onClick={onExitArena}>
                <Home className="w-4 h-4" /> Voltar ao Menu
              </ActionButton>
            </div>
          </StreetPanel>
        </div>
      )}

      {/* Finisher Cinematic Letterbox */}
      {hud.isFinisherSlowmo && (
        <>
          <div className="pointer-events-none absolute top-0 inset-x-0 h-10 bg-black z-10 border-b border-[#ff462e]/60" />
          <div className="pointer-events-none absolute bottom-0 inset-x-0 h-10 bg-black z-10 border-t border-[#ff462e]/60" />
        </>
      )}

      {/* Training Debug Hitboxes */}
      {hud.showHitboxes && hud.hitboxRects.length > 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
          {hud.hitboxRects.map((rect, idx) => (
            <div
              key={idx}
              className={`absolute border-2 ${
                rect.kind === 'hit'
                  ? 'border-[#ff462e] bg-[#ff462e]/20'
                  : rect.kind === 'parry'
                    ? 'border-[#ffc815] bg-[#ffc815]/25'
                    : 'border-[#00d4ff] bg-[#00d4ff]/15'
              }`}
              style={{
                left: `${rect.x}%`,
                top: `${rect.y}%`,
                width: `${rect.w}%`,
                height: `${rect.h}%`,
              }}
            />
          ))}
        </div>
      )}

      {/* Projected Floating Damage Popups */}
      <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
        {hud.damagePopups.map((pop) => (
          <div
            key={pop.id}
            className={`absolute -translate-x-1/2 -translate-y-1/2 font-display italic font-black tracking-tight drop-shadow-[0_3px_0_rgba(0,0,0,0.95)] ${
              pop.kind === 'parry'
                ? 'text-xl text-[#ffc815]'
                : pop.kind === 'finisher'
                  ? 'text-4xl text-[#ff462e]'
                  : pop.kind === 'super'
                    ? 'text-3xl text-[#c084fc]'
                    : pop.kind === 'counter'
                      ? 'text-2xl text-[#ff8800]'
                      : pop.kind === 'slap'
                        ? 'text-2xl text-[#ff5520]'
                        : 'text-xl text-white'
            }`}
            style={{
              left: `${pop.x}%`,
              top: `${pop.y}%`,
              opacity: Math.min(1, pop.life * 2),
            }}
          >
            {pop.kind === 'parry' ? 'PARRY!' : `-${pop.amount}`}
          </div>
        ))}
      </div>

      {/* Top AAA Street Fighting Combat HUD */}
      <div className="pointer-events-none absolute top-0 inset-x-0 z-20 px-2.5 sm:px-5 pt-2.5 max-w-5xl mx-auto">
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2 sm:gap-3">
          {/* P1 Slanted Gauge Block */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2 text-xs sm:text-sm font-display italic font-black text-white drop-shadow-[0_2px_0_rgba(0,0,0,0.95)]">
              <span className="truncate uppercase tracking-wide flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-3.5 bg-[#ffc815] -skew-x-12 shrink-0" />
                {p1Meta.name}
                {arcadeStage ? ` · FASE ${arcadeStage}/4` : ''}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                {[0, 1].map((i) => (
                  <span
                    key={i}
                    className={`w-2.5 h-2.5 rotate-45 border ${
                      hud.p1Rounds > i
                        ? 'bg-[#ffc815] border-white'
                        : 'bg-black/80 border-white/35'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Slanted P1 Vitality Bar with Trailing Red Drain */}
            <div className="relative h-4 sm:h-5 w-full bg-[#06070b]/95 border-b-2 border-[#ffc815]/60 sf-hp-p1 overflow-hidden shadow-[0_4px_14px_rgba(0,0,0,0.85)]">
              <div
                className="absolute inset-y-0 left-0 bg-[#ff462e] transition-all duration-700 ease-out"
                style={{ width: `${p1Pct}%` }}
              />
              <div
                className={`relative h-full transition-all duration-100 ${
                  p1Low
                    ? 'bg-gradient-to-r from-red-600 via-[#ff462e] to-orange-400'
                    : 'bg-gradient-to-r from-[#ff8c00] via-[#ffc815] to-[#ffe66d]'
                }`}
                style={{ width: `${p1Pct}%` }}
              />
            </div>

            {/* P1 Segmented Super Drive Bar + Guard Stun */}
            <div className="flex items-center gap-2 pr-3">
              <div className="relative h-2 flex-1 bg-[#06070b]/95 border border-white/15 -skew-x-12 overflow-hidden">
                <div
                  className={`h-full transition-all duration-100 ${
                    hud.p1Energy >= 100
                      ? 'bg-gradient-to-r from-[#ff462e] via-[#ffc815] to-white'
                      : 'bg-gradient-to-r from-[#0ea5e9] to-[#00d4ff]'
                  }`}
                  style={{ width: `${hud.p1Energy}%` }}
                />
                {/* 3 Drive Bar Dividers */}
                <div className="pointer-events-none absolute inset-0 grid grid-cols-3">
                  <div className="border-r border-black/80" />
                  <div className="border-r border-black/80" />
                  <div />
                </div>
              </div>
              {hud.p1Energy >= 100 && (
                <span className="font-display italic text-[10px] font-black text-[#ffc815] tracking-wider whitespace-nowrap">
                  SUPER MAX
                </span>
              )}
              {hud.p1Stun > 5 && (
                <div className="h-1.5 w-12 bg-black/90 border border-white/15 -skew-x-12 overflow-hidden">
                  <div className="h-full bg-[#ffc815]" style={{ width: `${hud.p1Stun}%` }} />
                </div>
              )}
            </div>
          </div>

          {/* Center Championship Timer + Pause */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="sf-chamfer-sm bg-[#090b12]/95 border-2 border-[#ffc815]/70 px-3.5 sm:px-4 py-1 shadow-[0_6px_18px_rgba(0,0,0,0.9)]">
              <div className="font-mono-num text-xl sm:text-2xl font-black text-white leading-none tracking-tight text-center">
                {mode === 'training' ? '∞' : String(hud.timer).padStart(2, '0')}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                gameAudio.playClick();
                togglePause();
              }}
              aria-label="Pausar"
              className="pointer-events-auto px-2.5 py-1 sf-chamfer-sm bg-[#10131c]/95 border border-white/20 hover:border-[#ffc815] text-slate-200 hover:text-[#ffc815] transition-colors focus-visible:outline-2 focus-visible:outline-[#ffc815]"
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* P2 Slanted Gauge Block */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center flex-row-reverse justify-between gap-2 text-xs sm:text-sm font-display italic font-black text-white drop-shadow-[0_2px_0_rgba(0,0,0,0.95)]">
              <span className="truncate uppercase tracking-wide flex items-center flex-row-reverse gap-1.5">
                <span className="inline-block w-1.5 h-3.5 bg-[#00d4ff] skew-x-12 shrink-0" />
                {p2Meta.name}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                {[0, 1].map((i) => (
                  <span
                    key={i}
                    className={`w-2.5 h-2.5 rotate-45 border ${
                      hud.p2Rounds > i
                        ? 'bg-[#00d4ff] border-white'
                        : 'bg-black/80 border-white/35'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Slanted P2 Vitality Bar with Trailing Red Drain */}
            <div className="relative h-4 sm:h-5 w-full bg-[#06070b]/95 border-b-2 border-[#00d4ff]/60 sf-hp-p2 overflow-hidden shadow-[0_4px_14px_rgba(0,0,0,0.85)]">
              <div
                className="ml-auto h-full bg-[#ff462e] transition-all duration-700 ease-out"
                style={{ width: `${p2Pct}%` }}
              />
              <div
                className={`absolute inset-y-0 right-0 transition-all duration-100 ${
                  p2Low
                    ? 'bg-gradient-to-l from-red-600 via-[#ff462e] to-orange-400'
                    : 'bg-gradient-to-l from-[#0284c7] via-[#00d4ff] to-[#a5f3fc]'
                }`}
                style={{ width: `${p2Pct}%` }}
              />
            </div>

            {/* P2 Super Bar */}
            <div className="flex items-center flex-row-reverse gap-2 pl-3">
              <div className="relative h-2 flex-1 bg-[#06070b]/95 border border-white/15 skew-x-12 overflow-hidden">
                <div
                  className="ml-auto h-full bg-gradient-to-l from-[#9d4edd] to-[#00d4ff] transition-all duration-100"
                  style={{ width: `${hud.p2Energy}%` }}
                />
                <div className="pointer-events-none absolute inset-0 grid grid-cols-3">
                  <div className="border-r border-black/80" />
                  <div className="border-r border-black/80" />
                  <div />
                </div>
              </div>
              {hud.p2Stun > 5 && (
                <div className="h-1.5 w-12 bg-black/90 border border-white/15 skew-x-12 overflow-hidden">
                  <div className="ml-auto h-full bg-[#ffc815]" style={{ width: `${hud.p2Stun}%` }} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Training Toolbar */}
        {mode === 'training' && (
          <div className="pointer-events-auto mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
            {(
              [
                { id: 'stand', label: 'Parado' },
                { id: 'crouch', label: 'Agachado' },
                { id: 'guard_all', label: 'Defesa' },
                { id: 'counter', label: 'Contra-Ataque' },
                { id: 'cpu', label: 'IA Livre' },
              ] as const
            ).map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  setDummyMode(d.id);
                  engineRef.current?.setTrainingDummyMode(d.id);
                }}
                className={`px-2.5 py-1 sf-chamfer-sm text-[10px] font-black uppercase border transition-colors ${
                  dummyMode === d.id
                    ? 'bg-[#ffc815] text-black border-white'
                    : 'bg-[#090b12]/90 text-slate-300 border-white/18 hover:border-[#ffc815]/50'
                }`}
              >
                {d.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                const next = !showHitboxes;
                setShowHitboxes(next);
                engineRef.current?.setShowHitboxes(next);
              }}
              className={`px-2.5 py-1 sf-chamfer-sm text-[10px] font-black uppercase border flex items-center gap-1 transition-colors ${
                showHitboxes
                  ? 'bg-[#ff462e] text-white border-white/60'
                  : 'bg-[#090b12]/90 text-slate-300 border-white/18 hover:border-[#ff462e]/60'
              }`}
            >
              <Eye className="w-3 h-3" /> Hitbox
            </button>
          </div>
        )}
      </div>

      {/* Quote Speech Callout */}
      {hud.quoteText && (
        <div
          className={`pointer-events-none absolute top-22 z-20 max-w-xs px-3.5 py-2 sf-chamfer-sm bg-[#090b12]/92 border-2 border-[#ffc815]/65 text-xs font-bold text-amber-100 sf-arcade-shadow ${
            hud.quoteSide === 'right' ? 'right-4 text-right' : 'left-4 text-left'
          }`}
        >
          “{hud.quoteText}”
        </div>
      )}

      {/* High-Impact Combo & Callout Overlay */}
      {(hud.p1Combo >= 2 || hud.calloutText) && (
        <div className="pointer-events-none absolute top-24 left-4 sm:left-8 z-20 text-left">
          {hud.p1Combo >= 2 && (
            <div className="animate-hit-pop flex items-baseline gap-2">
              <span className="font-display italic text-5xl sm:text-6xl font-black text-[#ffc815] drop-shadow-[0_4px_0_rgba(0,0,0,0.95)] leading-none">
                {hud.p1Combo}
              </span>
              <span className="font-display italic text-2xl font-black text-white uppercase tracking-wider drop-shadow-[0_3px_0_rgba(0,0,0,0.95)]">
                HITS!
              </span>
            </div>
          )}
          {hud.calloutText && (
            <div className="mt-0.5 inline-block px-2.5 py-0.5 bg-[#ff462e] text-white font-display italic text-lg sm:text-xl font-black tracking-wider -skew-x-12 shadow-[3px_3px_0_rgba(0,0,0,0.9)]">
              {hud.calloutText}
            </div>
          )}
        </div>
      )}

      {/* Center Round / KO Impact Slash Banner */}
      {hud.bannerText && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-4">
          <div
            key={hud.bannerText}
            className="animate-hit-pop sf-chamfer-lg sf-speed-lines px-8 sm:px-12 py-4 bg-[#090b12]/92 border-y-4 border-[#ffc815] text-center shadow-[0_16px_48px_rgba(0,0,0,0.95)]"
          >
            <h2 className="font-display italic text-4xl sm:text-6xl font-black tracking-wider text-white drop-shadow-[0_4px_0_#ff462e]">
              {hud.bannerText}
            </h2>
          </div>
        </div>
      )}

      {/* Landscape / Desktop Controls Overlay */}
      {!isPortraitLayout && (
        <CombatControls
          controlScheme={settings.controlScheme}
          keyBindings={settings.keyBindings}
          mobileOrientation={settings.mobileOrientation}
          commandAssist={settings.commandAssist}
          hapticsEnabled={settings.hapticsEnabled}
          touchLayoutScale={settings.touchLayoutScale}
          touchButtonsOffsetY={settings.touchButtonsOffsetY}
          p1Energy={hud.p1Energy}
          powerName={p1Power.shortName}
          powerCost={p1Power.energyCost}
          finisherName={p1Def.finisherName}
          hasUnlockedPower={hasUnlockedPower}
          onP1Input={handleP1Input}
          onP2Input={handleP2Input}
          isLocal2P={mode === 'local_2p'}
          onTogglePause={togglePause}
        />
      )}

      {/* Pause Modal + Move List */}
      {hud.isPaused && (
        <div className="absolute inset-0 z-30 bg-black/84 flex items-center justify-center p-4">
          <StreetPanel tone="gold" chamfer="lg" textured className="w-full max-w-sm p-6 space-y-4">
            <h3 className="font-display italic text-3xl font-black text-white text-center uppercase tracking-wide border-b border-white/12 pb-3">
              {showMoveList ? `GOLPES — ${p1Meta.name}` : 'COMBATE PAUSADO'}
            </h3>

            {showMoveList ? (
              <div className="space-y-2.5 max-h-68 overflow-y-auto pr-1 text-xs">
                {(Object.values(p1Def.specialMoves) as Array<{ name: string; command: string; description: string }>).map(
                  (mv, i) => (
                    <div key={i} className="p-3 sf-chamfer-sm bg-[#090b12] border border-white/12">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black text-[#ffc815]">{mv.name}</span>
                        <span className="font-mono-num text-[10px] font-bold text-[#00d4ff] bg-black/70 px-2 py-0.5 sf-chamfer-sm border border-[#00d4ff]/30">
                          {mv.command}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{mv.description}</p>
                    </div>
                  ),
                )}
                <ActionButton
                  variant="steel"
                  className="w-full"
                  onClick={() => setShowMoveList(false)}
                >
                  Voltar
                </ActionButton>
              </div>
            ) : (
              <div className="space-y-2.5">
                <ActionButton variant="gold" size="lg" className="w-full" onClick={togglePause}>
                  <Play className="w-4 h-4" /> Continuar
                </ActionButton>
                <ActionButton
                  variant="cyan"
                  className="w-full"
                  onClick={() => {
                    gameAudio.playClick();
                    setShowMoveList(true);
                  }}
                >
                  <Swords className="w-4 h-4" /> Lista de Golpes
                </ActionButton>
                <ActionButton
                  variant="steel"
                  className="w-full"
                  onClick={() => {
                    gameAudio.playClick();
                    engineRef.current?.restartMatch();
                  }}
                >
                  <RotateCcw className="w-4 h-4" /> Reiniciar Luta
                </ActionButton>
                <ActionButton
                  variant="danger"
                  className="w-full"
                  onClick={() => {
                    gameAudio.playClick();
                    onExitArena();
                  }}
                >
                  <Home className="w-4 h-4" /> {mode === 'training' ? 'Encerrar Treino' : 'Sair da Arena'}
                </ActionButton>
              </div>
            )}
          </StreetPanel>
        </div>
      )}
    </div>
  );

  if (isPortraitLayout) {
    return (
      <div className="w-full h-full flex flex-col bg-[#07080d] overflow-hidden">
        {stageViewport}
        <div className="h-[225px] shrink-0 bg-[#0b0d15] border-t-2 border-[#ffc815]/40">
          <CombatControls
            controlScheme={settings.controlScheme}
            keyBindings={settings.keyBindings}
            mobileOrientation="portrait"
            commandAssist={settings.commandAssist}
            hapticsEnabled={settings.hapticsEnabled}
            touchLayoutScale={settings.touchLayoutScale}
            touchButtonsOffsetY={settings.touchButtonsOffsetY}
            p1Energy={hud.p1Energy}
            powerName={p1Power.shortName}
            powerCost={p1Power.energyCost}
            finisherName={p1Def.finisherName}
            hasUnlockedPower={hasUnlockedPower}
            isPortraitDock
            onP1Input={handleP1Input}
            onP2Input={handleP2Input}
            isLocal2P={mode === 'local_2p'}
            onTogglePause={togglePause}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[#0b0d14]">{stageViewport}</div>
  );
}
