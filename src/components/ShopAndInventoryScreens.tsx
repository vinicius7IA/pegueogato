import { Check, Lock, Shield, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { gameAudio } from '../game/audio';
import {
  FIGHTERS,
  FIGHTERS_LIST,
  getDisplayFighterMeta,
  PAID_BUNDLES,
  POWERS,
  SKINS,
} from '../game/catalog';
import { FighterId, PlayerProfile, PowerId } from '../game/types';
import { FighterPreview3D } from './FighterPreview3D';
import {
  ActionButton,
  CurrencyStrip,
  ModalFrame,
  ScreenHeader,
  SegmentedTabs,
  StreetPanel,
} from './ui/FightingUI';

interface ShopScreenProps {
  profile: PlayerProfile;
  authorizationMode: boolean;
  onBuyFighter: (id: FighterId) => void;
  onBuySkin: (skinId: string) => void;
  onBuyPower: (powerId: PowerId) => void;
  onClaimBundle: (coins: number, diamonds: number) => void;
  onBack: () => void;
}

export function ShopScreen({
  profile,
  authorizationMode,
  onBuyFighter,
  onBuySkin,
  onBuyPower,
  onClaimBundle,
  onBack,
}: ShopScreenProps) {
  const [tab, setTab] = useState<'bundles' | 'fighters' | 'skins' | 'powers'>('bundles');
  const [pendingPack, setPendingPack] = useState<(typeof PAID_BUNDLES)[number] | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-[#07080d] text-slate-100 flex flex-col sf-halftone-bg">
      <ScreenHeader
        title="LOJA DA ARENA"
        subtitle="Desbloqueie lutadores, trajes especiais e poderes de Salvador"
        onBack={onBack}
        rightSlot={<CurrencyStrip coins={profile.coins} diamonds={profile.diamonds} />}
      />

      <main className="flex-1 p-4 sm:p-5 max-w-5xl w-full mx-auto space-y-4">
        <SegmentedTabs
          items={[
            { id: 'bundles', label: 'Pacotes' },
            { id: 'fighters', label: 'Lutadores' },
            { id: 'skins', label: 'Skins' },
            { id: 'powers', label: 'Poderes' },
          ]}
          value={tab}
          onChange={setTab}
        />

        {toast && (
          <div className="px-4 py-2.5 sf-chamfer-sm bg-emerald-500/20 border border-emerald-400/50 text-xs font-bold text-emerald-200">
            {toast}
          </div>
        )}

        {tab === 'bundles' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {PAID_BUNDLES.map((b) => (
                <StreetPanel
                  key={b.id}
                  tone="gold"
                  chamfer="md"
                  className="p-5 flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-wider text-[#ffc815]">
                      {b.badge}
                    </div>
                    <h3 className="font-display italic text-2xl font-black text-white mt-0.5">
                      {b.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1.5">{b.description}</p>
                    <div className="flex items-center gap-3 mt-3 font-mono-num text-xs font-bold">
                      <span className="text-[#ffc815]">+{b.coins.toLocaleString('pt-BR')} Moedas</span>
                      <span aria-hidden="true" className="text-white/20">
                        ·
                      </span>
                      <span className="text-[#00d4ff]">+{b.diamonds} Diamantes</span>
                    </div>
                  </div>
                  <ActionButton
                    variant="gold"
                    className="w-full font-mono-num text-sm"
                    onClick={() => {
                      gameAudio.playClick();
                      setPendingPack(b);
                    }}
                  >
                    {b.priceBrl}
                  </ActionButton>
                </StreetPanel>
              ))}
            </div>
            <p className="text-[11px] text-center text-slate-500 pt-1">
              Checkout simulado para testes locais (sem cobrança real).
            </p>
          </div>
        )}

        {tab === 'fighters' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {FIGHTERS_LIST.map((f) => {
              const id = f.id;
              const meta = getDisplayFighterMeta(id, authorizationMode);
              const owned = profile.unlockedFighters.includes(id);
              const canAfford =
                profile.coins >= f.unlockCoins && profile.diamonds >= f.unlockDiamonds;
              return (
                <StreetPanel
                  key={id}
                  tone={owned ? 'emerald' : 'neutral'}
                  chamfer="md"
                  className="p-3.5 flex items-center gap-3.5"
                >
                  {meta.showPortraitPhoto && f.portraitUrl ? (
                    <img
                      src={f.portraitUrl}
                      alt={meta.name}
                      referrerPolicy="no-referrer"
                      className="w-16 h-20 sf-chamfer-sm object-cover object-top shrink-0 border border-white/15"
                    />
                  ) : (
                    <div
                      className="w-16 h-20 sf-chamfer-sm flex items-center justify-center font-display italic text-2xl font-black text-white shrink-0 border border-white/15"
                      style={{ backgroundColor: f.badgeColor }}
                    >
                      {meta.name.slice(0, 2)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display italic text-xl font-black text-white truncate">
                      {meta.name}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">{f.tagline}</p>
                  </div>
                  {owned ? (
                    <span className="px-3 py-1.5 sf-chamfer-sm bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-xs font-bold flex items-center gap-1 shrink-0">
                      <Check className="w-3.5 h-3.5" /> Ativo
                    </span>
                  ) : (
                    <ActionButton
                      variant={canAfford ? 'gold' : 'steel'}
                      size="sm"
                      disabled={!canAfford}
                      className="font-mono-num"
                      onClick={() => {
                        onBuyFighter(id);
                        gameAudio.playCoin();
                        notify(`${meta.name} desbloqueado!`);
                      }}
                    >
                      {f.unlockCoins}M · {f.unlockDiamonds}D
                    </ActionButton>
                  )}
                </StreetPanel>
              );
            })}
          </div>
        )}

        {tab === 'skins' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {SKINS.map((sk) => {
              const owned = profile.unlockedSkins.includes(sk.id);
              const canAfford =
                profile.coins >= sk.priceCoins && profile.diamonds >= sk.priceDiamonds;
              const fMeta = getDisplayFighterMeta(sk.fighterId, authorizationMode);
              return (
                <StreetPanel
                  key={sk.id}
                  tone={owned ? 'emerald' : 'neutral'}
                  chamfer="md"
                  className="p-4 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-[11px] font-black uppercase tracking-wider text-[#ffc815]">
                      {fMeta.name}
                    </div>
                    <h3 className="font-display italic text-xl font-black text-white truncate">
                      {sk.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">{sk.description}</p>
                  </div>
                  {owned ? (
                    <span className="text-xs font-black text-emerald-400 shrink-0 uppercase">
                      Adquirida
                    </span>
                  ) : (
                    <ActionButton
                      variant={canAfford ? 'gold' : 'steel'}
                      size="sm"
                      disabled={!canAfford}
                      className="font-mono-num"
                      onClick={() => {
                        onBuySkin(sk.id);
                        gameAudio.playCoin();
                        notify(`Skin ${sk.name} liberada!`);
                      }}
                    >
                      {sk.priceCoins > 0 ? `${sk.priceCoins} Moedas` : `${sk.priceDiamonds} Diam.`}
                    </ActionButton>
                  )}
                </StreetPanel>
              );
            })}
          </div>
        )}

        {tab === 'powers' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {(Object.keys(POWERS) as PowerId[]).map((pid) => {
              const pw = POWERS[pid];
              const owned = profile.unlockedPowers.includes(pid);
              const canAfford =
                profile.coins >= pw.priceCoins && profile.diamonds >= pw.priceDiamonds;
              return (
                <StreetPanel
                  key={pid}
                  tone={owned ? 'emerald' : 'neutral'}
                  chamfer="md"
                  className="p-4 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div
                      className="flex items-center gap-1.5 text-xs font-bold font-mono-num"
                      style={{ color: pw.colorHex }}
                    >
                      <Sparkles className="w-3.5 h-3.5" /> {pw.damage} Dano · {pw.energyCost} Energia
                    </div>
                    <h3 className="font-display italic text-xl font-black text-white truncate mt-0.5">
                      {pw.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">{pw.description}</p>
                  </div>
                  {owned ? (
                    <span className="text-xs font-black text-emerald-400 shrink-0 uppercase">
                      Ativo
                    </span>
                  ) : (
                    <ActionButton
                      variant={canAfford ? 'gold' : 'steel'}
                      size="sm"
                      disabled={!canAfford}
                      className="font-mono-num"
                      onClick={() => {
                        onBuyPower(pid);
                        gameAudio.playCoin();
                        notify(`Poder ${pw.name} adquirido!`);
                      }}
                    >
                      {pw.priceCoins}M · {pw.priceDiamonds}D
                    </ActionButton>
                  )}
                </StreetPanel>
              );
            })}
          </div>
        )}
      </main>

      {pendingPack && (
        <ModalFrame tone="gold" maxWidthClass="max-w-xs">
          <div className="text-center space-y-2">
            <div className="text-[11px] font-black tracking-widest text-[#ffc815] uppercase">
              Compra Simulada
            </div>
            <h3 className="font-display italic text-3xl font-black text-white">
              {pendingPack.name}
            </h3>
            <p className="text-xs text-slate-300">
              +{pendingPack.coins.toLocaleString('pt-BR')} Moedas e +{pendingPack.diamonds} Diamantes
              por <strong className="text-white">{pendingPack.priceBrl}</strong> (sem cobrança real).
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <ActionButton variant="steel" onClick={() => setPendingPack(null)}>
              Cancelar
            </ActionButton>
            <ActionButton
              variant="gold"
              onClick={() => {
                onClaimBundle(pendingPack.coins, pendingPack.diamonds);
                gameAudio.playCoin();
                notify(`${pendingPack.name} creditado!`);
                setPendingPack(null);
              }}
            >
              Confirmar
            </ActionButton>
          </div>
        </ModalFrame>
      )}
    </div>
  );
}

interface InventoryScreenProps {
  profile: PlayerProfile;
  authorizationMode: boolean;
  onEquipSkin: (fighterId: FighterId, skinId: string) => void;
  onEquipPower: (fighterId: FighterId, powerId: PowerId) => void;
  onBack: () => void;
}

export function InventoryScreen({
  profile,
  authorizationMode,
  onEquipSkin,
  onEquipPower,
  onBack,
}: InventoryScreenProps) {
  const [activeFighter, setActiveFighter] = useState<FighterId>('policial');
  const fDef = FIGHTERS[activeFighter];
  const equippedSkin = profile.equippedSkins[activeFighter] || fDef.defaultSkinId;
  const equippedPower = profile.equippedPowers[activeFighter] || fDef.signaturePowerId;
  const skinsForFighter = SKINS.filter((s) => s.fighterId === activeFighter);

  return (
    <div className="w-full h-full overflow-y-auto bg-[#07080d] text-slate-100 flex flex-col sf-halftone-bg">
      <ScreenHeader
        title="INVENTÁRIO"
        subtitle="Personalize trajes e poderes de combate em 3D"
        onBack={onBack}
      />

      <main className="flex-1 p-4 sm:p-5 max-w-5xl w-full mx-auto space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {profile.unlockedFighters.map((fid) => {
            const active = activeFighter === fid;
            return (
              <ActionButton
                key={fid}
                variant={active ? 'gold' : 'steel'}
                size="sm"
                onClick={() => {
                  gameAudio.playClick();
                  setActiveFighter(fid);
                }}
              >
                {getDisplayFighterMeta(fid, authorizationMode).name}
              </ActionButton>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <StreetPanel tone="gold" chamfer="lg" className="h-72 md:h-84 bg-[#090b11]">
            <FighterPreview3D
              fighterId={activeFighter}
              skinId={equippedSkin}
              authorizationMode={authorizationMode}
              autoRotate
            />
          </StreetPanel>

          <div className="space-y-4">
            <div className="space-y-2">
              <h2 className="text-xs font-black tracking-wider text-slate-400 uppercase">
                Trajes e Skins
              </h2>
              {skinsForFighter.map((sk) => {
                const unlocked = profile.unlockedSkins.includes(sk.id);
                const equipped = equippedSkin === sk.id;
                return (
                  <button
                    key={sk.id}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => {
                      gameAudio.playClick();
                      onEquipSkin(activeFighter, sk.id);
                    }}
                    className={`w-full p-3.5 sf-chamfer-sm border text-left flex items-center justify-between transition-colors ${
                      equipped
                        ? 'bg-[#ffc815]/15 border-[#ffc815]'
                        : unlocked
                          ? 'bg-[#10131c] border-white/12 hover:border-white/35'
                          : 'bg-[#090b11] border-white/6 opacity-45 cursor-not-allowed'
                    }`}
                  >
                    <span className="font-extrabold text-sm text-white">{sk.name}</span>
                    {equipped ? (
                      <span className="text-xs font-black text-[#ffc815] uppercase">Equipada</span>
                    ) : !unlocked ? (
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              <h2 className="text-xs font-black tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#00d4ff]" /> Poderes Desbloqueados
              </h2>
              {profile.unlockedPowers.map((pid) => {
                const pw = POWERS[pid];
                const equipped = equippedPower === pid;
                return (
                  <button
                    key={pid}
                    type="button"
                    onClick={() => {
                      gameAudio.playClick();
                      onEquipPower(activeFighter, pid);
                    }}
                    className={`w-full p-3.5 sf-chamfer-sm border text-left flex items-center justify-between transition-colors ${
                      equipped
                        ? 'bg-[#ff462e]/18 border-[#ff5520]'
                        : 'bg-[#10131c] border-white/12 hover:border-white/35'
                    }`}
                  >
                    <span className="font-extrabold text-sm text-white">{pw.name}</span>
                    {equipped && (
                      <span className="text-xs font-black text-[#ff5520] uppercase">Equipado</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
