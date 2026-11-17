import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_FIGHTERS = new Set([
  'policial',
  'maluco',
  'capoeira',
  'baiana',
  'torcedor',
  'jesse',
  'alo_juca',
  'alo_dani',
]);

const ALLOWED_ARENAS = new Set([
  'pelourinho',
  'favela_salvador',
  'cajazeira',
  'gamboa',
  'pituba',
  'elevador_lacerda',
  'farol_barra',
  'orla',
  'rio_vermelho',
  'dique_tororo',
]);

interface RoomPlayer {
  ws: WebSocket;
  id: string;
  nickname: string;
  fighterId: string;
  skinId: string;
  powerId: string;
  stageVote: string;
  ready: boolean;
}

interface GameRoom {
  code: string;
  hostId: string;
  players: RoomPlayer[];
  status: 'waiting' | 'fighting';
}

interface LeaderboardRecord {
  nickname: string;
  rankPoints: number;
  wins: number;
  losses: number;
  favoriteFighter: string;
}

interface MatchRecord {
  id: string;
  playerName: string;
  opponentName: string;
  winner: 'p1' | 'p2' | 'draw';
  p1FighterId: string;
  p2FighterId: string;
  p1RoundsWon: number;
  p2RoundsWon: number;
  maxCombo: number;
  score: number;
  timestamp: string;
  mode: string;
}

interface PersistedDb {
  leaderboard: LeaderboardRecord[];
  recentMatches: MatchRecord[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const SEED_LEADERBOARD: LeaderboardRecord[] = [
  { nickname: 'SoldadoSSA', rankPoints: 1480, wins: 22, losses: 4, favoriteFighter: 'policial' },
  { nickname: 'MestreDende', rankPoints: 1410, wins: 19, losses: 5, favoriteFighter: 'capoeira' },
  { nickname: 'JesseDaBarra', rankPoints: 1390, wins: 17, losses: 5, favoriteFighter: 'jesse' },
  { nickname: 'PlantaoSSA', rankPoints: 1310, wins: 15, losses: 6, favoriteFighter: 'alo_juca' },
  { nickname: 'AoVivoDani', rankPoints: 1245, wins: 13, losses: 7, favoriteFighter: 'alo_dani' },
  { nickname: 'ZecaDoTapa', rankPoints: 1190, wins: 11, losses: 8, favoriteFighter: 'maluco' },
];

const SEED_MATCHES: MatchRecord[] = [
  {
    id: 'm_seed_1',
    playerName: 'SoldadoSSA',
    opponentName: 'ZecaDoTapa',
    winner: 'p1',
    p1FighterId: 'policial',
    p2FighterId: 'maluco',
    p1RoundsWon: 2,
    p2RoundsWon: 0,
    maxCombo: 6,
    score: 2940,
    timestamp: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
    mode: 'online',
  },
  {
    id: 'm_seed_2',
    playerName: 'MestreDende',
    opponentName: 'AoVivoDani',
    winner: 'p1',
    p1FighterId: 'capoeira',
    p2FighterId: 'alo_dani',
    p1RoundsWon: 2,
    p2RoundsWon: 1,
    maxCombo: 5,
    score: 2560,
    timestamp: new Date(Date.now() - 1000 * 60 * 38).toISOString(),
    mode: 'online',
  },
];

const rooms = new Map<string, GameRoom>();
const roomCodeByClientId = new Map<string, string>();
const matchmakingQueue: RoomPlayer[] = [];
const leaderboard = new Map<string, LeaderboardRecord>();
const recentMatches: MatchRecord[] = [];

function loadDatabase(): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw) as Partial<PersistedDb>;
      if (Array.isArray(parsed.leaderboard) && parsed.leaderboard.length > 0) {
        parsed.leaderboard.forEach((rec) => {
          if (rec?.nickname) leaderboard.set(rec.nickname, rec);
        });
      }
      if (Array.isArray(parsed.recentMatches)) {
        recentMatches.push(...parsed.recentMatches.slice(0, 50));
      }
    }
  } catch {
    // Fallback to seed data on read/parse error
  }

  if (leaderboard.size === 0) {
    SEED_LEADERBOARD.forEach((rec) => leaderboard.set(rec.nickname, rec));
  }
  if (recentMatches.length === 0) {
    recentMatches.push(...SEED_MATCHES);
  }
}

let persistTimer: NodeJS.Timeout | null = null;
function schedulePersist(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const payload: PersistedDb = {
        leaderboard: Array.from(leaderboard.values()),
        recentMatches: recentMatches.slice(0, 50),
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(payload, null, 2), 'utf8');
    } catch {
      // Ignore transient filesystem errors
    }
  }, 400);
}

function sanitizeNickname(raw: unknown, fallback = 'LutadorSSA'): string {
  const cleaned = String(raw || fallback)
    .replace(/[<>{}\r\n]/g, '')
    .trim()
    .slice(0, 18);
  return cleaned.length >= 2 ? cleaned : fallback;
}

function sanitizeFighterId(raw: unknown, fallback = 'policial'): string {
  const val = String(raw || fallback);
  return ALLOWED_FIGHTERS.has(val) ? val : fallback;
}

function sanitizeArenaId(raw: unknown, fallback = 'pelourinho'): string {
  const val = String(raw || fallback);
  return ALLOWED_ARENAS.has(val) ? val : fallback;
}

function sanitizeId(raw: unknown, fallback: string): string {
  return String(raw || fallback).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || fallback;
}

function electRoomArena(players: RoomPlayer[]): string {
  const votes = players.map((p) => sanitizeArenaId(p.stageVote, 'pelourinho'));
  if (votes.length === 0) return 'pelourinho';
  if (votes.length === 1 || votes[0] === votes[1]) return votes[0];
  return votes[Math.floor(Math.random() * votes.length)];
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function sendJson(ws: WebSocket, payload: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastRoom(room: GameRoom): void {
  const snapshot = {
    type: 'room_update',
    code: room.code,
    status: room.status,
    players: room.players.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      fighterId: p.fighterId,
      skinId: p.skinId,
      powerId: p.powerId,
      stageVote: p.stageVote,
      ready: p.ready,
      isHost: p.id === room.hostId,
    })),
  };
  room.players.forEach((p) => sendJson(p.ws, snapshot));
}

async function startServer() {
  loadDatabase();

  const app = express();
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size, playersRanked: leaderboard.size });
  });

  app.get('/api/rooms', (_req, res) => {
    const list = Array.from(rooms.values())
      .filter((r) => r.players.length < 2 && r.status === 'waiting')
      .map((r) => ({
        code: r.code,
        hostName: r.players[0]?.nickname || 'Anfitrião',
        playerCount: r.players.length,
        status: r.status,
      }));
    res.json({ rooms: list });
  });

  app.get('/api/leaderboard', (_req, res) => {
    const entries = Array.from(leaderboard.values())
      .sort((a, b) => b.rankPoints - a.rankPoints)
      .slice(0, 20);
    res.json({ leaderboard: entries });
  });

  app.get('/api/matches', (_req, res) => {
    res.json({ matches: recentMatches.slice(0, 25) });
  });

  app.post('/api/matches', (req, res) => {
    const body = req.body as Partial<MatchRecord>;
    if (!body?.playerName || !body?.p1FighterId || !body?.p2FighterId) {
      res.status(400).json({ error: 'Dados da partida inválidos' });
      return;
    }

    const mode = sanitizeId(body.mode, 'vs_ai');
    if (mode === 'training') {
      res.json({ ok: true, ignored: true });
      return;
    }

    const record: MatchRecord = {
      id: `m_${Date.now()}_${Math.floor(Math.random() * 999)}`,
      playerName: sanitizeNickname(body.playerName),
      opponentName: sanitizeNickname(body.opponentName, 'IA'),
      winner: body.winner === 'p1' || body.winner === 'p2' ? body.winner : 'draw',
      p1FighterId: sanitizeFighterId(body.p1FighterId, 'policial'),
      p2FighterId: sanitizeFighterId(body.p2FighterId, 'maluco'),
      p1RoundsWon: Math.max(0, Math.min(5, Number(body.p1RoundsWon || 0))),
      p2RoundsWon: Math.max(0, Math.min(5, Number(body.p2RoundsWon || 0))),
      maxCombo: Math.max(0, Math.min(99, Number(body.maxCombo || 0))),
      score: Math.max(0, Math.min(999999, Number(body.score || 0))),
      timestamp: new Date().toISOString(),
      mode,
    };

    recentMatches.unshift(record);
    if (recentMatches.length > 50) recentMatches.pop();

    const existing = leaderboard.get(record.playerName) || {
      nickname: record.playerName,
      rankPoints: 1000,
      wins: 0,
      losses: 0,
      favoriteFighter: record.p1FighterId,
    };
    if (record.winner === 'p1') {
      existing.wins += 1;
      existing.rankPoints += record.mode === 'online' ? 35 : 15;
    } else if (record.winner === 'p2') {
      existing.losses += 1;
      existing.rankPoints = Math.max(800, existing.rankPoints - (record.mode === 'online' ? 20 : 5));
    }
    existing.favoriteFighter = record.p1FighterId;
    leaderboard.set(record.playerName, existing);
    schedulePersist();

    res.json({ ok: true, rankPoints: existing.rankPoints });
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });

  wss.on('connection', (ws) => {
    const clientId = `p_${Math.random().toString(36).slice(2, 9)}`;
    let tokens = 65;
    let lastRefill = Date.now();

    const consumeRateToken = (): boolean => {
      const now = Date.now();
      const elapsedSec = (now - lastRefill) / 1000;
      if (elapsedSec > 0) {
        tokens = Math.min(75, tokens + elapsedSec * 60);
        lastRefill = now;
      }
      if (tokens < 1) return false;
      tokens -= 1;
      return true;
    };

    const removeFromQueue = () => {
      const idx = matchmakingQueue.findIndex((p) => p.id === clientId);
      if (idx >= 0) matchmakingQueue.splice(idx, 1);
    };

    const leaveCurrentRoom = (reasonDisconnect = false) => {
      removeFromQueue();
      const activeCode = roomCodeByClientId.get(clientId);
      if (!activeCode) return;
      roomCodeByClientId.delete(clientId);
      const room = rooms.get(activeCode);
      if (room) {
        const wasFighting = room.status === 'fighting';
        const leaver = room.players.find((p) => p.id === clientId);
        room.players = room.players.filter((p) => p.id !== clientId);
        if (room.players.length === 0) {
          rooms.delete(activeCode);
        } else {
          room.hostId = room.players[0].id;
          room.status = 'waiting';
          if (wasFighting && reasonDisconnect && leaver) {
            const survivor = room.players[0];
            const survivorEntry = leaderboard.get(survivor.nickname) || {
              nickname: survivor.nickname,
              rankPoints: 1000,
              wins: 0,
              losses: 0,
              favoriteFighter: survivor.fighterId,
            };
            survivorEntry.wins += 1;
            survivorEntry.rankPoints += 25;
            leaderboard.set(survivor.nickname, survivorEntry);
            schedulePersist();
            sendJson(survivor.ws, {
              type: 'opponent_disconnected_wo',
              message: `${leaver.nickname} desconectou. Vitória por W.O. (+25 pts)!`,
            });
          }
          broadcastRoom(room);
        }
      }
    };

    ws.on('message', (raw) => {
      if (!consumeRateToken()) return;
      const rawText = raw.toString();
      if (rawText.length > 4096) return;

      try {
        const msg = JSON.parse(rawText) as Record<string, unknown>;
        if (!msg || typeof msg.type !== 'string') return;

        if (msg.type === 'create_room') {
          leaveCurrentRoom(false);
          const code = generateRoomCode();
          const player: RoomPlayer = {
            ws,
            id: clientId,
            nickname: sanitizeNickname(msg.nickname, 'SoldadoSSA'),
            fighterId: sanitizeFighterId(msg.fighterId, 'policial'),
            skinId: sanitizeId(msg.skinId, 'policial_tatico'),
            powerId: sanitizeId(msg.powerId, 'gatos_pretos'),
            stageVote: sanitizeArenaId(msg.stageVote, 'pelourinho'),
            ready: false,
          };
          const room: GameRoom = {
            code,
            hostId: clientId,
            players: [player],
            status: 'waiting',
          };
          rooms.set(code, room);
          roomCodeByClientId.set(clientId, code);
          sendJson(ws, { type: 'joined', clientId, code, role: 'host' });
          broadcastRoom(room);
        } else if (msg.type === 'join_room') {
          const code = String(msg.code || '')
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
            .slice(0, 6);
          const room = rooms.get(code);
          if (!room) {
            sendJson(ws, { type: 'error', message: 'Sala não encontrada.' });
            return;
          }
          if (room.players.length >= 2) {
            sendJson(ws, { type: 'error', message: 'Sala cheia.' });
            return;
          }
          leaveCurrentRoom(false);
          const player: RoomPlayer = {
            ws,
            id: clientId,
            nickname: sanitizeNickname(msg.nickname, 'Desafiante'),
            fighterId: sanitizeFighterId(msg.fighterId, 'maluco'),
            skinId: sanitizeId(msg.skinId, 'maluco_classico'),
            powerId: sanitizeId(msg.powerId, 'tapa_explosivo'),
            stageVote: sanitizeArenaId(msg.stageVote, 'pelourinho'),
            ready: false,
          };
          room.players.push(player);
          roomCodeByClientId.set(clientId, code);
          sendJson(ws, { type: 'joined', clientId, code, role: 'guest' });
          broadcastRoom(room);
        } else if (msg.type === 'find_match') {
          leaveCurrentRoom(false);
          const player: RoomPlayer = {
            ws,
            id: clientId,
            nickname: sanitizeNickname(msg.nickname, 'SoldadoSSA'),
            fighterId: sanitizeFighterId(msg.fighterId, 'policial'),
            skinId: sanitizeId(msg.skinId, 'policial_tatico'),
            powerId: sanitizeId(msg.powerId, 'gatos_pretos'),
            stageVote: sanitizeArenaId(msg.stageVote, 'pelourinho'),
            ready: true,
          };
          if (matchmakingQueue.length > 0) {
            const opponent = matchmakingQueue.shift()!;
            const code = generateRoomCode();
            const room: GameRoom = {
              code,
              hostId: opponent.id,
              players: [opponent, player],
              status: 'fighting',
            };
            rooms.set(code, room);
            roomCodeByClientId.set(opponent.id, code);
            roomCodeByClientId.set(player.id, code);
            const electedArena = electRoomArena(room.players);
            sendJson(opponent.ws, {
              type: 'match_found',
              clientId: opponent.id,
              code,
              role: 'host',
            });
            sendJson(player.ws, {
              type: 'match_found',
              clientId: player.id,
              code,
              role: 'guest',
            });
            broadcastRoom(room);
            room.players.forEach((p) =>
              sendJson(p.ws, { type: 'start_fight', arenaId: electedArena }),
            );
          } else {
            matchmakingQueue.push(player);
            sendJson(ws, { type: 'searching' });
          }
        } else if (msg.type === 'cancel_search') {
          removeFromQueue();
          sendJson(ws, { type: 'search_cancelled' });
        } else if (msg.type === 'update_loadout') {
          const activeCode = roomCodeByClientId.get(clientId);
          const room = activeCode ? rooms.get(activeCode) : undefined;
          const me = room?.players.find((p) => p.id === clientId);
          if (room && me) {
            me.fighterId = sanitizeFighterId(msg.fighterId, me.fighterId);
            me.skinId = sanitizeId(msg.skinId, me.skinId);
            me.powerId = sanitizeId(msg.powerId, me.powerId);
            me.stageVote = sanitizeArenaId(msg.stageVote, me.stageVote);
            me.ready = Boolean(msg.ready);
            broadcastRoom(room);
            if (room.players.length === 2 && room.players.every((p) => p.ready)) {
              room.status = 'fighting';
              const electedArena = electRoomArena(room.players);
              broadcastRoom(room);
              room.players.forEach((p) =>
                sendJson(p.ws, { type: 'start_fight', arenaId: electedArena }),
              );
            }
          }
        } else if (msg.type === 'fighter_sync') {
          const activeCode = roomCodeByClientId.get(clientId);
          const room = activeCode ? rooms.get(activeCode) : undefined;
          if (!room) return;
          room.players.forEach((p) => {
            if (p.id !== clientId) {
              sendJson(p.ws, msg);
            }
          });
        } else if (msg.type === 'leave_room') {
          leaveCurrentRoom(false);
        }
      } catch {
        // Ignore malformed packets
      }
    });

    ws.on('close', () => {
      leaveCurrentRoom(true);
    });
  });

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`PEGUE O GATO server running on http://localhost:${PORT}`);
  });
}

startServer();
