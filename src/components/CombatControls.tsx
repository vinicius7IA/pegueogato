import { useEffect, useRef, useState, ReactNode } from 'react';
import { Flame, Footprints, Hand, Shield, Sparkles, Wind, Zap } from 'lucide-react';
import { createEmptyInput, FighterInputState } from '../game/arenaScene';
import { InputMethod, KeyBindings, MobileOrientation } from '../game/types';

interface CombatControlsProps {
  controlScheme: 'auto' | 'touch' | 'keyboard' | 'xbox';
  keyBindings: KeyBindings;
  mobileOrientation: MobileOrientation | null;
  commandAssist: boolean;
  hapticsEnabled: boolean;
  touchLayoutScale: number;
  touchButtonsOffsetY: number;
  p1Energy: number;
  powerName: string;
  powerCost: number;
  finisherName: string;
  hasUnlockedPower: boolean;
  isPortraitDock?: boolean;
  onP1Input: (input: FighterInputState) => void;
  onP2Input?: (input: FighterInputState) => void;
  isLocal2P: boolean;
  onTogglePause: () => void;
  onDetectedMethodChange?: (method: InputMethod) => void;
}

function formatKeyShort(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code === 'Space') return 'ESPAÇO';
  if (code.startsWith('Arrow')) return code.replace('Arrow', '');
  return code.slice(0, 5).toUpperCase();
}

const ROUND_TONES = {
  gold: 'bg-gradient-to-b from-sf-gold to-sf-amber text-black border-white',
  sky: 'bg-sf-raised/95 text-sky-300 border-sky-400/70',
  cyan: 'bg-sf-raised/95 text-sf-cyan border-sf-cyan/70',
  emerald: 'bg-sf-raised/95 text-emerald-300 border-emerald-400/70',
  crimson: 'bg-gradient-to-b from-sf-crimson to-red-800 text-white border-sf-gold',
  orange: 'bg-sf-raised/95 text-orange-300 border-orange-400/70',
} as const;

function RoundButton({
  label,
  icon,
  size,
  pos,
  tone,
  pulse = false,
  onDown,
  onUp,
}: {
  label: string;
  icon: ReactNode;
  size: number;
  pos: string;
  tone: keyof typeof ROUND_TONES;
  pulse?: boolean;
  onDown: () => void;
  onUp: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onContextMenu={(e) => e.preventDefault()}
      style={{ width: size, height: size }}
      className={`touch-control absolute ${pos} rounded-full border-2 flex flex-col items-center justify-center gap-0.5 shadow-[0_6px_16px_rgba(0,0,0,0.6),inset_0_2px_0_rgba(255,255,255,0.25)] active:scale-90 transition-transform ${ROUND_TONES[tone]} ${
        pulse ? 'animate-hit-pop ring-2 ring-sf-gold/70' : ''
      }`}
    >
      {icon}
      <span className="text-[8px] font-black tracking-wide leading-none">{label}</span>
    </button>
  );
}

export function CombatControls({
  controlScheme,
  keyBindings,
  commandAssist,
  hapticsEnabled,
  touchLayoutScale,
  touchButtonsOffsetY,
  p1Energy,
  powerName,
  powerCost,
  finisherName,
  hasUnlockedPower,
  isPortraitDock = false,
  onP1Input,
  onP2Input,
  isLocal2P,
  onTogglePause,
  onDetectedMethodChange,
}: CombatControlsProps) {
  const [detectedMethod, setDetectedMethod] = useState<InputMethod>(() => {
    if (typeof window !== 'undefined') {
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isNarrow = window.innerWidth < 860;
      return hasTouch || isNarrow ? 'touch' : 'keyboard';
    }
    return 'keyboard';
  });

  const activeMethod: InputMethod =
    controlScheme === 'auto' ? detectedMethod : controlScheme;

  useEffect(() => {
    onDetectedMethodChange?.(activeMethod);
  }, [activeMethod, onDetectedMethodChange]);

  const keysRef = useRef<Set<string>>(new Set());
  const touchStateRef = useRef<FighterInputState>(createEmptyInput());
  const stickKnobRef = useRef<HTMLDivElement | null>(null);
  const stickOriginRef = useRef<{ x: number; y: number } | null>(null);
  const swipeOriginRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const swipeTimerRef = useRef<number>(0);
  const prevXboxPauseRef = useRef(false);

  const latestRef = useRef({
    controlScheme,
    detectedMethod,
    keyBindings,
    p1Energy,
    hasUnlockedPower,
    isLocal2P,
    onP1Input,
    onP2Input,
    onTogglePause,
  });
  latestRef.current = {
    controlScheme,
    detectedMethod,
    keyBindings,
    p1Energy,
    hasUnlockedPower,
    isLocal2P,
    onP1Input,
    onP2Input,
    onTogglePause,
  };

  const pulseHaptic = (ms = 20) => {
    if (hapticsEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(ms);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      const { controlScheme: scheme, detectedMethod: method, keyBindings: kb, onTogglePause: togglePause } =
        latestRef.current;

      if (e.code === 'Escape') {
        e.preventDefault();
        togglePause();
        return;
      }

      const boundCodes = new Set<string>([
        kb.left,
        kb.right,
        kb.up,
        kb.down,
        kb.block,
        kb.dodge,
        kb.punchLight,
        kb.punchHeavy,
        kb.kickLight,
        kb.kickHeavy,
        kb.grab,
        kb.special1,
        kb.superMove,
        kb.taunt,
        'KeyP',
        'KeyF',
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
        'Space',
      ]);
      if (boundCodes.has(e.code)) {
        e.preventDefault();
      }

      if (scheme === 'auto' && method !== 'touch' && method !== 'keyboard') {
        setDetectedMethod('keyboard');
      }
      keysRef.current.add(e.code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };

    const clearKeys = () => {
      keysRef.current.clear();
    };

    const onVisibilityChange = () => {
      if (document.hidden) clearKeys();
    };

    const onGamepadConnected = () => {
      if (latestRef.current.controlScheme === 'auto') setDetectedMethod('xbox');
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearKeys);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('gamepadconnected', onGamepadConnected);

    let rafId = 0;
    const poll = () => {
      const {
        keyBindings: kb,
        p1Energy: energy,
        hasUnlockedPower: unlockedPower,
        isLocal2P: local2P,
        onP1Input: sendP1,
        onP2Input: sendP2,
        onTogglePause: togglePause,
      } = latestRef.current;

      const keys = keysRef.current;
      const p1 = createEmptyInput();

      if (keys.has(kb.left) || (!local2P && keys.has('ArrowLeft'))) p1.moveX -= 1;
      if (keys.has(kb.right) || (!local2P && keys.has('ArrowRight'))) p1.moveX += 1;
      if (keys.has(kb.up) || (!local2P && keys.has('ArrowUp'))) p1.jump = true;
      if (keys.has(kb.down) || (!local2P && keys.has('ArrowDown'))) p1.crouch = true;

      if (keys.has(kb.block)) p1.block = true;
      if (keys.has(kb.dodge)) p1.dodge = true;
      if (keys.has(kb.punchLight)) p1.punchLight = true;
      if (keys.has(kb.punchHeavy)) p1.punchHeavy = true;
      if (keys.has(kb.kickLight)) p1.kickLight = true;
      if (keys.has(kb.kickHeavy)) p1.kickHeavy = true;
      if (keys.has(kb.grab)) p1.grab = true;
      if (keys.has(kb.special1)) {
        if (keys.has('ShiftLeft') || keys.has('ShiftRight')) p1.special2 = true;
        else p1.special1 = true;
      }
      if (keys.has('KeyP')) p1.parry = true;
      if (keys.has('KeyF')) p1.finisher = true;
      if (keys.has(kb.taunt)) p1.taunt = true;
      if (keys.has(kb.superMove)) {
        if (energy >= 100) p1.finisher = true;
        else if (unlockedPower) p1.powerMove = true;
        else p1.specialCombo = true;
      }

      // Touch overlay merge
      const ts = touchStateRef.current;
      if (Math.abs(ts.moveX) > 0.1) p1.moveX = ts.moveX;
      if (ts.crouch) p1.crouch = true;
      if (ts.jump) p1.jump = true;
      if (ts.block) p1.block = true;
      if (ts.parry) p1.parry = true;
      if (ts.dodge) p1.dodge = true;
      if (ts.punchLight) p1.punchLight = true;
      if (ts.punchMed) p1.punchMed = true;
      if (ts.punchHeavy) p1.punchHeavy = true;
      if (ts.kickLight) p1.kickLight = true;
      if (ts.kickMed) p1.kickMed = true;
      if (ts.kickHeavy) p1.kickHeavy = true;
      if (ts.grab) p1.grab = true;
      if (ts.special1) p1.special1 = true;
      if (ts.special2) p1.special2 = true;
      if (ts.specialCombo) p1.specialCombo = true;
      if (ts.powerMove) p1.powerMove = true;
      if (ts.finisher) p1.finisher = true;
      if (ts.taunt) p1.taunt = true;

      // Xbox / PlayStation Controller
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const pad = pads?.[0];
      if (pad && pad.connected) {
        const axisX = Math.abs(pad.axes[0] || 0) > 0.22 ? pad.axes[0] : 0;
        const axisY = pad.axes[1] || 0;
        if (axisX !== 0) p1.moveX = axisX;
        if (axisY < -0.55 || pad.buttons[12]?.pressed) p1.jump = true;
        if (axisY > 0.55 || pad.buttons[13]?.pressed) p1.crouch = true;
        if (pad.buttons[14]?.pressed) p1.moveX = -1;
        if (pad.buttons[15]?.pressed) p1.moveX = 1;

        if (pad.buttons[2]?.pressed) p1.punchLight = true; // X / Square
        if (pad.buttons[3]?.pressed) p1.punchHeavy = true; // Y / Triangle
        if (pad.buttons[0]?.pressed) p1.kickLight = true; // A / Cross
        if (pad.buttons[1]?.pressed) p1.block = true; // B / Circle
        if (pad.buttons[4]?.pressed) p1.dodge = true; // LB / L1
        if ((pad.buttons[6]?.value || 0) > 0.35) p1.parry = true; // LT / L2
        if ((pad.buttons[7]?.value || 0) > 0.35) p1.kickHeavy = true; // RT / R2
        if (pad.buttons[5]?.pressed) {
          if (energy >= 100 && pad.buttons[4]?.pressed) p1.finisher = true;
          else if (unlockedPower) p1.powerMove = true; // RB / R1
          else p1.special1 = true;
        }

        const menuPressed = Boolean(pad.buttons[9]?.pressed);
        if (menuPressed && !prevXboxPauseRef.current) togglePause();
        prevXboxPauseRef.current = menuPressed;
      }

      sendP1(p1);

      if (local2P && sendP2) {
        const p2 = createEmptyInput();
        if (keys.has('ArrowLeft')) p2.moveX -= 1;
        if (keys.has('ArrowRight')) p2.moveX += 1;
        if (keys.has('ArrowUp')) p2.jump = true;
        if (keys.has('ArrowDown')) p2.crouch = true;
        if (keys.has('Numpad1') || keys.has('KeyZ')) p2.punchLight = true;
        if (keys.has('Numpad2') || keys.has('KeyX')) p2.punchHeavy = true;
        if (keys.has('Numpad3') || keys.has('KeyC')) p2.kickLight = true;
        if (keys.has('Numpad4') || keys.has('KeyV')) p2.block = true;
        sendP2(p2);
      }

      rafId = requestAnimationFrame(poll);
    };

    rafId = requestAnimationFrame(poll);
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(swipeTimerRef.current);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearKeys);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('gamepadconnected', onGamepadConnected);
    };
  }, []);

  const setTouchAction = (key: keyof Omit<FighterInputState, 'moveX'>, active: boolean) => {
    if (active) pulseHaptic(key === 'powerMove' || key === 'finisher' ? 35 : 18);
    touchStateRef.current[key] = active;
  };

  const canUseSpecial = hasUnlockedPower && p1Energy >= powerCost;
  const canUseFinisher = p1Energy >= 100;
  const showTouch = activeMethod === 'touch' || isPortraitDock;

  const touchButtonDeck = (
    <div
      className={`pointer-events-none flex items-end justify-between w-full ${isPortraitDock ? 'px-4 py-3 h-full' : 'p-4 pb-5'}`}
      style={{
        transform: `translateY(${touchButtonsOffsetY}px) scale(${touchLayoutScale})`,
        transformOrigin: 'bottom center',
      }}
    >
      {/* Left: Clean 360 Arcade Stick */}
      <div className="pointer-events-auto flex flex-col items-start">
        <div
          className="touch-control relative w-28 h-28 rounded-full bg-sf-ink/80 border-2 border-sf-gold/45 flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.8)]"
          onPointerDown={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            stickOriginRef.current = {
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2,
            };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!stickOriginRef.current) return;
            const maxR = 40;
            const dx = e.clientX - stickOriginRef.current.x;
            const dy = e.clientY - stickOriginRef.current.y;
            const cx = Math.max(-maxR, Math.min(maxR, dx));
            const cy = Math.max(-maxR, Math.min(maxR, dy));
            touchStateRef.current.moveX = Math.abs(cx) > 8 ? cx / maxR : 0;
            touchStateRef.current.jump = cy < -20;
            touchStateRef.current.crouch = cy > 20;
            if (stickKnobRef.current) {
              stickKnobRef.current.style.transform = `translate(${cx}px, ${cy}px)`;
            }
          }}
          onPointerUp={() => {
            stickOriginRef.current = null;
            touchStateRef.current.moveX = 0;
            touchStateRef.current.jump = false;
            touchStateRef.current.crouch = false;
            if (stickKnobRef.current) {
              stickKnobRef.current.style.transform = 'translate(0px, 0px)';
            }
          }}
          onPointerCancel={() => {
            stickOriginRef.current = null;
            touchStateRef.current.moveX = 0;
            touchStateRef.current.jump = false;
            touchStateRef.current.crouch = false;
            if (stickKnobRef.current) {
              stickKnobRef.current.style.transform = 'translate(0px, 0px)';
            }
          }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-2 rounded-full border border-white/10"
          />
          <div
            ref={stickKnobRef}
            className="w-12 h-12 rounded-full bg-gradient-to-b from-sf-gold to-sf-amber border-2 border-white shadow-[0_4px_14px_rgba(255,200,21,0.45)] transition-transform duration-75"
          />
        </div>
      </div>

      {/* Right: Streamlined 4 Core Buttons + 1 Contextual Special/Finisher */}
      <div
        className="pointer-events-auto relative w-[196px] h-[150px] shrink-0 touch-control"
        onPointerDown={(e) => {
          swipeOriginRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
        }}
        onPointerUp={(e) => {
          if (!swipeOriginRef.current) return;
          const dx = e.clientX - swipeOriginRef.current.x;
          const dy = e.clientY - swipeOriginRef.current.y;
          const elapsed = Date.now() - swipeOriginRef.current.t;
          swipeOriginRef.current = null;
          if (elapsed < 280 && Math.hypot(dx, dy) > 42) {
            pulseHaptic(28);
            const spKey = Math.abs(dx) > Math.abs(dy) ? 'special1' : 'special2';
            touchStateRef.current[spKey] = true;
            clearTimeout(swipeTimerRef.current);
            swipeTimerRef.current = window.setTimeout(() => {
              touchStateRef.current.special1 = false;
              touchStateRef.current.special2 = false;
            }, 120);
          }
        }}
      >
        {/* Botões redondos em arco, estilo arcade mobile */}
        <RoundButton
          label="SOCO"
          icon={<Hand className="w-6 h-6" />}
          size={74}
          pos="right-0 bottom-0"
          tone="gold"
          onDown={() => setTouchAction('punchLight', true)}
          onUp={() => setTouchAction('punchLight', false)}
        />
        <RoundButton
          label="CHUTE"
          icon={<Footprints className="w-5 h-5" />}
          size={62}
          pos="right-[84px] bottom-0"
          tone="sky"
          onDown={() => setTouchAction('kickMed', true)}
          onUp={() => setTouchAction('kickMed', false)}
        />
        <RoundButton
          label="DEFESA"
          icon={<Shield className="w-5 h-5" />}
          size={58}
          pos="right-[70px] bottom-[70px]"
          tone="cyan"
          onDown={() => {
            setTouchAction('block', true);
            setTouchAction('parry', true);
          }}
          onUp={() => {
            setTouchAction('block', false);
            setTouchAction('parry', false);
          }}
        />
        <RoundButton
          label="ESQUIVA"
          icon={<Wind className="w-5 h-5" />}
          size={56}
          pos="right-0 bottom-[84px]"
          tone="emerald"
          onDown={() => setTouchAction('dodge', true)}
          onUp={() => setTouchAction('dodge', false)}
        />
        {canUseFinisher ? (
          <RoundButton
            label="FINAL"
            icon={<Flame className="w-5 h-5" />}
            size={58}
            pos="right-[134px] bottom-[62px]"
            tone="crimson"
            pulse
            onDown={() => setTouchAction('finisher', true)}
            onUp={() => setTouchAction('finisher', false)}
          />
        ) : canUseSpecial ? (
          <RoundButton
            label="PODER"
            icon={<Zap className="w-5 h-5" />}
            size={58}
            pos="right-[134px] bottom-[62px]"
            tone="gold"
            pulse
            onDown={() => setTouchAction('powerMove', true)}
            onUp={() => setTouchAction('powerMove', false)}
          />
        ) : (
          <RoundButton
            label="ESPECIAL"
            icon={<Sparkles className="w-5 h-5" />}
            size={54}
            pos="right-[134px] bottom-[62px]"
            tone="orange"
            onDown={() => setTouchAction(commandAssist ? 'special1' : 'special2', true)}
            onUp={() => {
              setTouchAction('special1', false);
              setTouchAction('special2', false);
            }}
          />
        )}
      </div>
    </div>
  );

  if (isPortraitDock) {
    return touchButtonDeck;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-end">
      {showTouch ? (
        touchButtonDeck
      ) : (
        <div className="mx-auto mb-3 px-4 py-1.5 sf-chamfer-sm bg-sf-ink/90 border border-white/18 text-[11px] text-slate-200 flex items-center gap-3 shadow-lg">
          {activeMethod === 'xbox' ? (
            <span>
              <strong className="text-sf-gold">CONTROLE:</strong> LS Mover/Pular · X/Y Soco · A/RT Chute · B Defesa · LB Esquiva Boxe (→+LB Agarrar) · RB Super
            </span>
          ) : (
            <span>
              <strong className="text-sf-gold">TECLADO:</strong> {formatKeyShort(keyBindings.left)}/{formatKeyShort(keyBindings.right)} Mover ·{' '}
              {formatKeyShort(keyBindings.up)} Pular · {formatKeyShort(keyBindings.down)} Agachar ·{' '}
              {formatKeyShort(keyBindings.punchLight)}/{formatKeyShort(keyBindings.punchHeavy)} Soco ·{' '}
              {formatKeyShort(keyBindings.kickLight)}/{formatKeyShort(keyBindings.kickHeavy)} Chute ·{' '}
              {formatKeyShort(keyBindings.dodge)} Esquiva Boxe (→ Agarrar) · {formatKeyShort(keyBindings.special1)} Esp · {formatKeyShort(keyBindings.superMove)} Super
            </span>
          )}
        </div>
      )}
    </div>
  );
}
