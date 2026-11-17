import { ArrowLeft, Coins, Gem, Loader2 } from 'lucide-react';
import { ButtonHTMLAttributes, ReactNode } from 'react';
import { gameAudio } from '../../game/audio';

/* ============================================================================
   STREET FIGHTER DESIGN SYSTEM — SHARED UI PRIMITIVES
   Consistent chamfered geometry, athletic condensed display type, strict states,
   WCAG-AA contrast, and zero decorative pill clutter.
   ============================================================================ */

export type AccentTone = 'gold' | 'cyan' | 'crimson' | 'purple' | 'emerald' | 'neutral';

const TONE_RING: Record<AccentTone, string> = {
  gold: 'border-sf-gold/45',
  cyan: 'border-sf-cyan/45',
  crimson: 'border-sf-crimson/50',
  purple: 'border-sf-purple/45',
  emerald: 'border-emerald-400/45',
  neutral: 'border-white/14',
};

const TONE_TOP_EDGE: Record<AccentTone, string> = {
  gold: 'from-sf-gold via-sf-amber to-transparent',
  cyan: 'from-sf-cyan via-sky-500 to-transparent',
  crimson: 'from-sf-crimson via-orange-500 to-transparent',
  purple: 'from-sf-purple via-fuchsia-500 to-transparent',
  emerald: 'from-emerald-400 via-teal-500 to-transparent',
  neutral: 'from-white/25 via-white/10 to-transparent',
};

interface StreetPanelProps {
  children: ReactNode;
  tone?: AccentTone;
  className?: string;
  chamfer?: 'sm' | 'md' | 'lg';
  textured?: boolean;
}

/**
 * Single-elevation Street Fighter container with chamfered geometry
 * and a crisp top kinetic edge highlight (replaces generic rounded SaaS cards).
 */
export function StreetPanel({
  children,
  tone = 'neutral',
  className = '',
  chamfer = 'md',
  textured = false,
}: StreetPanelProps) {
  const chamferClass =
    chamfer === 'lg' ? 'sf-chamfer-lg' : chamfer === 'sm' ? 'sf-chamfer-sm' : 'sf-chamfer';

  return (
    <div
      className={`relative bg-sf-surface border ${TONE_RING[tone]} ${chamferClass} sf-arcade-shadow overflow-hidden ${
        textured ? 'sf-halftone-bg' : ''
      } ${className}`}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r ${TONE_TOP_EDGE[tone]}`}
      />
      {children}
    </div>
  );
}

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'gold' | 'clash' | 'cyan' | 'steel' | 'danger' | 'emerald';
  size?: 'sm' | 'md' | 'lg' | 'hero';
  loading?: boolean;
  selected?: boolean;
  children: ReactNode;
}

const BUTTON_VARIANTS: Record<NonNullable<ActionButtonProps['variant']>, string> = {
  gold: 'bg-gradient-to-r from-sf-gold via-[#ffb000] to-sf-amber text-black border-[#ffe169] hover:brightness-105 sf-cta-glow',
  clash:
    'bg-gradient-to-r from-sf-crimson via-sf-orange to-[#ff7b00] text-white border-[#ff9a76] hover:brightness-105 shadow-md',
  cyan: 'bg-gradient-to-r from-sf-cyan to-[#0ea5e9] text-black border-[#7deaff] hover:brightness-105 shadow-md',
  steel:
    'bg-sf-raised text-slate-100 border-white/18 hover:border-sf-gold/60 hover:bg-[#1e2436]',
  danger:
    'bg-red-600/20 text-red-200 border-red-500/45 hover:bg-red-600/35 hover:border-red-400',
  emerald:
    'bg-gradient-to-r from-emerald-400 to-teal-400 text-black border-emerald-200 hover:brightness-105 shadow-md',
};

const BUTTON_SIZES: Record<NonNullable<ActionButtonProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-xs',
  lg: 'px-5 py-3.5 text-xl font-display italic tracking-wide',
  hero: 'px-6 py-4 text-3xl font-display italic tracking-wider',
};

/**
 * Standardized AAA Action Button with kinetic sweep hover,
 * focus-visible accessibility ring, chamfered silhouette, and explicit loading/disabled states.
 */
export function ActionButton({
  variant = 'steel',
  size = 'md',
  loading = false,
  selected = false,
  disabled,
  className = '',
  children,
  onClick,
  ...rest
}: ActionButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={(e) => {
        if (!isDisabled && onClick) onClick(e);
      }}
      className={`relative overflow-hidden sf-btn-sweep sf-chamfer-sm border font-black uppercase whitespace-nowrap shrink-0 flex items-center justify-center gap-2 transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sf-gold active:scale-[0.98] ${
        isDisabled
          ? 'bg-[#222736] text-slate-500 border-white/8 cursor-not-allowed shadow-none'
          : BUTTON_VARIANTS[variant]
      } ${selected ? 'ring-2 ring-sf-gold ring-offset-2 ring-offset-sf-bg' : ''} ${
        BUTTON_SIZES[size]
      } ${className}`}
      {...rest}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : null}
      {children}
    </button>
  );
}

interface CurrencyStripProps {
  coins: number;
  diamonds: number;
}

/**
 * Unboxed typographic currency readout (zero pill clutter).
 */
export function CurrencyStrip({ coins, diamonds }: CurrencyStripProps) {
  return (
    <div className="flex items-center gap-3 text-xs font-mono-num font-bold whitespace-nowrap shrink-0">
      <span className="flex items-center gap-1.5 text-sf-gold">
        <Coins className="w-3.5 h-3.5 shrink-0" />
        <span>{coins.toLocaleString('pt-BR')}</span>
      </span>
      <span aria-hidden="true" className="text-white/25">
        /
      </span>
      <span className="flex items-center gap-1.5 text-sf-cyan">
        <Gem className="w-3.5 h-3.5 shrink-0" />
        <span>{diamonds.toLocaleString('pt-BR')}</span>
      </span>
    </div>
  );
}

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  rightSlot?: ReactNode;
  centerSlot?: ReactNode;
}

/**
 * Standardized Street-Fighter-style Screen Header across all sub-screens.
 */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  rightSlot,
  centerSlot,
}: ScreenHeaderProps) {
  return (
    <header className="relative z-20 flex items-center justify-between gap-4 px-4 sm:px-6 py-3.5 bg-sf-ink/95 border-b border-white/12 shrink-0 sf-speed-lines">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 w-44 h-[2px] bg-gradient-to-r from-sf-crimson via-sf-gold to-transparent"
      />
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={() => {
            gameAudio.playClick();
            onBack();
          }}
          aria-label="Voltar"
          className="w-10 h-10 sf-chamfer-sm bg-sf-raised border border-white/18 hover:border-sf-gold hover:text-sf-gold text-slate-100 flex items-center justify-center transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-sf-gold active:scale-95 shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0">
          <h1 className="font-display italic text-2xl sm:text-3xl font-black tracking-wide text-white leading-none truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[11px] font-semibold text-slate-400 truncate mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>

      {centerSlot && <div className="hidden md:flex items-center shrink-0">{centerSlot}</div>}

      <div className="flex items-center gap-3 shrink-0">{rightSlot}</div>
    </header>
  );
}

interface SegmentedTabItem<T extends string> {
  id: T;
  label: string;
  icon?: ReactNode;
}

interface SegmentedTabsProps<T extends string> {
  items: ReadonlyArray<SegmentedTabItem<T>>;
  value: T;
  onChange: (value: T) => void;
  tone?: 'gold' | 'cyan';
  className?: string;
}

/**
 * Interactive segmented tab switcher with skewed/chamfered active indicator.
 */
export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  tone = 'gold',
  className = '',
}: SegmentedTabsProps<T>) {
  const activeStyle =
    tone === 'cyan'
      ? 'bg-gradient-to-r from-sf-cyan to-sky-400 text-black font-black shadow-sm'
      : 'bg-gradient-to-r from-sf-gold to-sf-amber text-black font-black shadow-sm';

  return (
    <div
      role="tablist"
      className={`flex items-center gap-1 p-1 bg-sf-ink border border-white/14 sf-chamfer-sm ${className}`}
    >
      {items.map((item) => {
        const isActive = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => {
              gameAudio.playClick();
              onChange(item.id);
            }}
            className={`flex-1 py-2 px-3 sf-chamfer-sm text-xs font-extrabold uppercase tracking-wide whitespace-nowrap flex items-center justify-center gap-1.5 transition-all duration-150 focus-visible:outline-2 focus-visible:outline-sf-gold ${
              isActive
                ? activeStyle
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

interface StatGaugeProps {
  label: string;
  value: number;
  max?: number;
  tone?: 'gold' | 'cyan' | 'crimson' | 'purple' | 'emerald';
  valueLabel?: string;
}

const GAUGE_COLORS: Record<NonNullable<StatGaugeProps['tone']>, string> = {
  gold: 'bg-gradient-to-r from-sf-amber to-sf-gold',
  cyan: 'bg-gradient-to-r from-sky-500 to-sf-cyan',
  crimson: 'bg-gradient-to-r from-red-600 to-sf-orange',
  purple: 'bg-gradient-to-r from-purple-600 to-sf-violet',
  emerald: 'bg-gradient-to-r from-emerald-600 to-emerald-400',
};

/**
 * Competitive slanted metric gauge with tabular numeric figure.
 */
export function StatGauge({
  label,
  value,
  max = 100,
  tone = 'gold',
  valueLabel,
}: StatGaugeProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));

  return (
    <div className="grid grid-cols-[92px_1fr_auto] items-center gap-2.5 text-xs">
      <span className="text-slate-300 font-bold truncate">{label}</span>
      <div className="h-2.5 bg-sf-bg border border-white/10 -skew-x-12 overflow-hidden">
        <div
          className={`h-full ${GAUGE_COLORS[tone]} transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono-num font-black text-right text-white min-w-[2.2rem]">
        {valueLabel ?? value}
      </span>
    </div>
  );
}

interface ModalFrameProps {
  children: ReactNode;
  tone?: AccentTone;
  maxWidthClass?: string;
}

/**
 * Standardized dark chamfered modal shell for confirmations, pause, and onboarding prompts.
 */
export function ModalFrame({
  children,
  tone = 'gold',
  maxWidthClass = 'max-w-sm',
}: ModalFrameProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/82 flex items-center justify-center p-4"
    >
      <StreetPanel tone={tone} chamfer="lg" textured className={`w-full ${maxWidthClass} p-6 space-y-5`}>
        {children}
      </StreetPanel>
    </div>
  );
}
