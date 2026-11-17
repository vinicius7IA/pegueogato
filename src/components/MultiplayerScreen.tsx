import { Copy, Globe, History, MapPin, Plus, Search, Swords, Trophy, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { gameAudio } from '../game/audio';
import { ARENAS, ARENAS_LIST, FIGHTERS, getDisplayFighterMeta, isPlayableFighter } from '../game/catalog';
import {
  ArenaId,
  FighterId,
  LeaderboardEntry,
  OnlineRoomInfo,
  PlayerProfile,
  PowerId,
} from '../game/types';
import { ActionButton, ScreenHeader, SegmentedTabs, StreetPanel } from './ui/FightingUI';

interface RoomMember {
  id: string;
  nickname: string;
  fighterId: FighterId;
  skinId: string;
  powerId: PowerId;
  stageVote?: ArenaId;
  ready: boolean;
  isHost: boolean;
}

interface MultiplayerScreenProps {
  profile: PlayerProfile;
  authorizationMode: boolean;
  selectedFighter: FighterId;
  selectedArenaId: ArenaId;
  onSelectFighter: (id: FighterId) => void;
  onLaunchOnlineMatch: (config: {
    socket: WebSocket;
    role: 'host' | 'guest';
    arenaId: ArenaId;
    p1FighterId: FighterId;
    p1SkinId: string;
    p1PowerId: PowerId;
    p2FighterId: FighterId;
    p2SkinId: string;
    p2PowerId: PowerId;
    p2Nickname: string;
  }) => void;
  onBack: () => void;
}

export function MultiplayerScreen({
  profile,
  authorizationMode,
  selectedFighter,
  selectedArenaId,
  onSelectFighter,
  onLaunchOnlineMatch,
  onBack,
}: MultiplayerScreenProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [searching, setSearching] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [joinInput, setJoinInput] = useState('');
  const [myRole, setMyRole] = useState<'host' | 'guest'>('host');
  const [myClientId, setMyClientId] = useState<string>('');
  const [stageVote, setStageVote] = useState<ArenaId>(selectedArenaId);
  const [roomPlayers, setRoomPlayers] = useState<RoomMember[]>([]);
  const [openRooms, setOpenRooms] = useState<OnlineRoomInfo[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [matches, setMatches] = useState<Array<{
    id: string;
    playerName: string;
    opponentName: string;
    winner: string;
    p1FighterId: FighterId;
    p2FighterId: FighterId;
    p1RoundsWon: number;
    p2RoundsWon: number;
    maxCombo: number;
    score: number;
  }>>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'lobby' | 'ranking' | 'history'>('lobby');
  const [ready, setReady] = useState(false);

  const fetchLobbyData = async () => {
    try {
      const [rRes, lRes, mRes] = await Promise.all([
        fetch('/api/rooms'),
        fetch('/api/leaderboard'),
        fetch('/api/matches'),
      ]);
      if (rRes.ok) {
        const d = await rRes.json();
        setOpenRooms(d.rooms || []);
      }
      if (lRes.ok) {
        const d = await lRes.json();
        setLeaderboard(d.leaderboard || []);
      }
      if (mRes.ok) {
        const d = await mRes.json();
        setMatches(d.matches || []);
      }
    } catch {
      // ignore transient network failure
    }
  };

  useEffect(() => {
    fetchLobbyData();
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
    wsRef.current = ws;

    let launched = false;
    let latestRole: 'host' | 'guest' = 'host';
    let latestPlayers: RoomMember[] = [];

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'searching') {
          setSearching(true);
          setErrorMsg(null);
        } else if (msg.type === 'search_cancelled') {
          setSearching(false);
        } else if (msg.type === 'joined' || msg.type === 'match_found') {
          setSearching(false);
          setRoomCode(msg.code);
          setMyRole(msg.role);
          setMyClientId(msg.clientId);
          latestRole = msg.role;
          setErrorMsg(null);
        } else if (msg.type === 'room_update') {
          latestPlayers = msg.players || [];
          setRoomPlayers(latestPlayers);
        } else if (msg.type === 'start_fight' && !launched) {
          launched = true;
          const hostPlayer = latestPlayers[0];
          const guestPlayer = latestPlayers[1];
          if (hostPlayer && guestPlayer) {
            const opponent = latestRole === 'host' ? guestPlayer : hostPlayer;
            onLaunchOnlineMatch({
              socket: ws,
              role: latestRole,
              arenaId: (msg.arenaId as ArenaId) || selectedArenaId,
              p1FighterId: hostPlayer.fighterId,
              p1SkinId: hostPlayer.skinId,
              p1PowerId: hostPlayer.powerId,
              p2FighterId: guestPlayer.fighterId,
              p2SkinId: guestPlayer.skinId,
              p2PowerId: guestPlayer.powerId,
              p2Nickname: opponent.nickname,
            });
          }
        } else if (msg.type === 'error') {
          setErrorMsg(msg.message || 'Erro de conexão.');
        }
      } catch {
        // ignore
      }
    };

    const pollTimer = window.setInterval(fetchLobbyData, 4000);
    return () => {
      clearInterval(pollTimer);
      if (!launched) ws.close();
    };
  }, [onLaunchOnlineMatch, selectedArenaId]);

  const sendWs = (payload: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  };

  const mySkin = profile.equippedSkins[selectedFighter] || FIGHTERS[selectedFighter].defaultSkinId;
  const myPower = profile.equippedPowers[selectedFighter] || FIGHTERS[selectedFighter].signaturePowerId;

  const handleToggleReady = () => {
    const next = !ready;
    setReady(next);
    gameAudio.playClick();
    sendWs({
      type: 'update_loadout',
      fighterId: selectedFighter,
      skinId: mySkin,
      powerId: myPower,
      stageVote,
      ready: next,
    });
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-sf-bg text-slate-100 flex flex-col sf-halftone-bg">
      <ScreenHeader
        title="ARENA ONLINE"
        subtitle="Partidas ranqueadas, salas privadas e histórico de combate"
        onBack={onBack}
        rightSlot={
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <Globe className={`w-4 h-4 ${connected ? 'text-emerald-400' : 'text-red-400'}`} />
            <span className={connected ? 'text-emerald-300' : 'text-red-300'}>
              {connected ? 'Conectado' : 'Offline'}
            </span>
          </div>
        }
      />

      <main className="flex-1 p-4 sm:p-5 max-w-4xl w-full mx-auto space-y-4">
        <SegmentedTabs
          items={[
            { id: 'lobby', label: 'Salas', icon: <Users className="w-3.5 h-3.5" /> },
            { id: 'ranking', label: 'Ranking', icon: <Trophy className="w-3.5 h-3.5" /> },
            { id: 'history', label: 'Histórico', icon: <History className="w-3.5 h-3.5" /> },
          ]}
          value={activeTab}
          onChange={(tab) => {
            setActiveTab(tab);
            fetchLobbyData();
          }}
        />

        {errorMsg && (
          <div className="px-4 py-2.5 sf-chamfer-sm bg-red-500/18 border border-red-400/50 text-xs font-semibold text-red-200">
            {errorMsg}
          </div>
        )}

        {activeTab === 'lobby' && (
          <div className="space-y-4">
            <StreetPanel tone="gold" chamfer="md" className="p-4 space-y-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-black tracking-wider text-slate-300 uppercase">
                  Seu Lutador
                </span>
                <span className="font-mono-num text-sf-gold font-black">
                  {profile.rankPoints} PTS
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {profile.unlockedFighters.filter(isPlayableFighter).map((fid) => (
                  <ActionButton
                    key={fid}
                    variant={selectedFighter === fid ? 'gold' : 'steel'}
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      gameAudio.playClick();
                      onSelectFighter(fid);
                      if (roomCode) {
                        sendWs({
                          type: 'update_loadout',
                          fighterId: fid,
                          skinId: profile.equippedSkins[fid] || FIGHTERS[fid].defaultSkinId,
                          powerId: profile.equippedPowers[fid] || FIGHTERS[fid].signaturePowerId,
                          stageVote,
                          ready,
                        });
                      }
                    }}
                  >
                    {getDisplayFighterMeta(fid, authorizationMode).name}
                  </ActionButton>
                ))}
              </div>

              {/* Online Arena Vote */}
              <div className="pt-3 border-t border-white/10">
                <div className="flex items-center gap-1.5 text-[11px] font-black tracking-wider text-slate-400 uppercase mb-2">
                  <MapPin className="w-3.5 h-3.5 text-sf-gold" /> Voto de Arena da Sala
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {ARENAS_LIST.map((a) => (
                    <ActionButton
                      key={a.id}
                      variant={stageVote === a.id ? 'gold' : 'steel'}
                      size="sm"
                      onClick={() => {
                        setStageVote(a.id);
                        if (roomCode) {
                          sendWs({
                            type: 'update_loadout',
                            fighterId: selectedFighter,
                            skinId: mySkin,
                            powerId: myPower,
                            stageVote: a.id,
                            ready,
                          });
                        }
                      }}
                    >
                      {a.shortName}
                    </ActionButton>
                  ))}
                </div>
              </div>
            </StreetPanel>

            {roomCode ? (
              <StreetPanel tone="cyan" chamfer="md" className="p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase">
                      Sala ({myRole === 'host' ? 'Anfitrião' : 'Desafiante'})
                    </div>
                    <div className="font-mono-num text-3xl font-black text-sf-gold flex items-center gap-2.5 mt-0.5">
                      {roomCode}
                      <ActionButton
                        variant="steel"
                        size="sm"
                        onClick={() => navigator.clipboard?.writeText(roomCode)}
                      >
                        <Copy className="w-3 h-3" /> Copiar
                      </ActionButton>
                    </div>
                  </div>
                  <ActionButton
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      sendWs({ type: 'leave_room' });
                      setRoomCode(null);
                      setRoomPlayers([]);
                      setReady(false);
                    }}
                  >
                    Sair
                  </ActionButton>
                </div>

                <div className="space-y-2.5">
                  {[0, 1].map((slotIdx) => {
                    const member = roomPlayers[slotIdx];
                    return (
                      <div
                        key={slotIdx}
                        className={`p-3.5 sf-chamfer-sm border ${
                          member
                            ? 'bg-sf-raised border-white/18'
                            : 'bg-sf-ink border-dashed border-white/12'
                        }`}
                      >
                        {member ? (
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="font-extrabold text-sm text-white">
                                {member.nickname}{' '}
                                {member.id === myClientId && (
                                  <span className="text-xs text-sf-gold">(Você)</span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5">
                                {getDisplayFighterMeta(member.fighterId, authorizationMode).name}
                                {member.stageVote &&
                                  ` · Voto: ${ARENAS[member.stageVote]?.shortName}`}
                              </div>
                            </div>
                            <span
                              className={`text-xs font-black uppercase ${
                                member.ready ? 'text-emerald-400' : 'text-sf-gold'
                              }`}
                            >
                              {member.ready ? 'PRONTO' : 'Aguardando'}
                            </span>
                          </div>
                        ) : (
                          <div className="text-center py-2 text-xs text-slate-500">
                            Aguardando rival entrar com o código {roomCode}...
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <ActionButton
                  variant={ready ? 'emerald' : 'gold'}
                  size="lg"
                  disabled={roomPlayers.length < 2}
                  className="w-full"
                  onClick={handleToggleReady}
                >
                  <Swords className="w-5 h-5" />
                  {roomPlayers.length < 2
                    ? 'AGUARDANDO JOGADOR...'
                    : ready
                      ? 'PRONTO!'
                      : 'CONFIRMAR PRONTO'}
                </ActionButton>
              </StreetPanel>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StreetPanel chamfer="md" className="p-4 space-y-3">
                  <ActionButton
                    variant={searching ? 'danger' : 'gold'}
                    size="lg"
                    disabled={!connected}
                    loading={searching}
                    className="w-full"
                    onClick={() => {
                      gameAudio.playClick();
                      if (searching) {
                        sendWs({ type: 'cancel_search' });
                      } else {
                        sendWs({
                          type: 'find_match',
                          nickname: profile.nickname,
                          fighterId: selectedFighter,
                          skinId: mySkin,
                          powerId: myPower,
                          stageVote,
                        });
                      }
                    }}
                  >
                    {!searching && <Search className="w-5 h-5" />}
                    {searching ? 'PROCURANDO... (CANCELAR)' : 'ENCONTRAR ADVERSÁRIO'}
                  </ActionButton>

                  <ActionButton
                    variant="steel"
                    disabled={!connected}
                    className="w-full"
                    onClick={() => {
                      gameAudio.playClick();
                      setReady(false);
                      sendWs({
                        type: 'create_room',
                        nickname: profile.nickname,
                        fighterId: selectedFighter,
                        skinId: mySkin,
                        powerId: myPower,
                        stageVote,
                      });
                    }}
                  >
                    <Plus className="w-4 h-4 text-sf-cyan" /> Criar Sala Privada
                  </ActionButton>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!joinInput.trim()) return;
                      gameAudio.playClick();
                      setReady(false);
                      sendWs({
                        type: 'join_room',
                        code: joinInput.trim().toUpperCase(),
                        nickname: profile.nickname,
                        fighterId: selectedFighter,
                        skinId: mySkin,
                        powerId: myPower,
                        stageVote,
                      });
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      maxLength={6}
                      value={joinInput}
                      onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                      placeholder="CÓDIGO DA SALA"
                      className="flex-1 min-w-0 px-3.5 py-2.5 sf-chamfer-sm bg-sf-ink border border-white/18 text-xs font-mono-num uppercase text-white focus:outline-none focus:border-sf-gold"
                    />
                    <ActionButton type="submit" variant="cyan" size="md">
                      Entrar
                    </ActionButton>
                  </form>
                </StreetPanel>

                <StreetPanel chamfer="md" className="p-4 space-y-3">
                  <h2 className="font-display italic text-xl font-black text-white">
                    SALAS ABERTAS
                  </h2>
                  {openRooms.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      Nenhuma sala aguardando. Crie uma sala ou busque partida.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {openRooms.map((r) => (
                        <div
                          key={r.code}
                          className="flex items-center justify-between p-3 sf-chamfer-sm bg-sf-raised border border-white/12"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-white truncate font-mono-num">
                              {r.code} · {r.hostName}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {r.playerCount}/2 jogadores
                            </div>
                          </div>
                          <ActionButton
                            variant="gold"
                            size="sm"
                            onClick={() => {
                              sendWs({
                                type: 'join_room',
                                code: r.code,
                                nickname: profile.nickname,
                                fighterId: selectedFighter,
                                skinId: mySkin,
                                powerId: myPower,
                                stageVote,
                              });
                            }}
                          >
                            Entrar
                          </ActionButton>
                        </div>
                      ))}
                    </div>
                  )}
                </StreetPanel>
              </div>
            )}
          </div>
        )}

        {activeTab === 'ranking' && (
          <div className="space-y-2.5">
            {leaderboard.map((row, idx) => (
              <StreetPanel
                key={row.nickname}
                tone={idx === 0 ? 'gold' : 'neutral'}
                chamfer="sm"
                className="flex items-center justify-between gap-3 p-3.5 text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono-num text-base font-black text-sf-gold w-7 text-center shrink-0">
                    #{idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="font-extrabold text-sm text-white truncate">{row.nickname}</div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {getDisplayFighterMeta(row.favoriteFighter, authorizationMode).name}
                    </div>
                  </div>
                </div>
                <div className="text-right font-mono-num shrink-0">
                  <div className="font-black text-emerald-400 text-sm">{row.rankPoints} PTS</div>
                  <div className="text-[11px] text-slate-400">
                    {row.wins}V / {row.losses}D
                  </div>
                </div>
              </StreetPanel>
            ))}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-2.5">
            {matches.length === 0 ? (
              <StreetPanel chamfer="sm" className="p-5 text-xs text-slate-400 text-center">
                Nenhuma partida registrada ainda.
              </StreetPanel>
            ) : (
              matches.map((m) => (
                <StreetPanel
                  key={m.id}
                  chamfer="sm"
                  className="flex items-center justify-between gap-3 p-3.5 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-extrabold text-sm text-white truncate">
                      {m.playerName} <span className="text-slate-500">vs</span>{' '}
                      <span className="text-sf-cyan">{m.opponentName}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">
                      {getDisplayFighterMeta(m.p1FighterId, authorizationMode).name} vs{' '}
                      {getDisplayFighterMeta(m.p2FighterId, authorizationMode).name} ·{' '}
                      {m.p1RoundsWon}–{m.p2RoundsWon}
                    </div>
                  </div>
                  <div className="text-right font-mono-num shrink-0">
                    <div className="text-sf-gold font-black text-sm">{m.score} PTS</div>
                    <div className="text-[11px] text-slate-400">{m.maxCombo} hits</div>
                  </div>
                </StreetPanel>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
