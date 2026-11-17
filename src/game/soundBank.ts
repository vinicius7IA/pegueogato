/**
 * Banco de sons do BAHIA STRETAT: toca os arquivos MP3 de src/assets/audio com
 * - barramentos independentes (música, efeitos, vozes, ambiente) + mestre e mudo;
 * - variações aleatórias sem repetir o último arquivo e leve variação de velocidade;
 * - limite de sons simultâneos por grupo (sem cortar o que já está tocando);
 * - carregamento sob demanda (decodifica só o que vai ser usado).
 */

// Vite resolve todos os MP3 como URL (ou data URI no build de arquivo único, usado no app Expo).
const FILES = import.meta.glob('../assets/audio/**/*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export type Bus = 'music' | 'sfx' | 'voice' | 'ambient';

/** grupo -> lista de URLs. Ex.: "combat/punch_heavy" -> [..._1.mp3, ..._2.mp3, ..._3.mp3] */
const GROUPS: Record<string, string[]> = {};
for (const [path, url] of Object.entries(FILES)) {
  const rel = path.replace('../assets/audio/', '').replace(/\.mp3$/, '');
  const group = /_\d+$/.test(rel) ? rel.replace(/_\d+$/, '') : rel;
  (GROUPS[group] ||= []).push(url);
}
Object.values(GROUPS).forEach((list) => list.sort());

const busOf = (group: string): Bus => {
  if (group.startsWith('music/') || group.startsWith('victory/') || group.startsWith('defeat/')) return 'music';
  if (group.startsWith('characters/') || group.startsWith('announcer/')) return 'voice';
  if (group.endsWith('/ambience')) return 'ambient';
  return 'sfx';
};

interface PlayOpts {
  gain?: number;
  rateJitter?: number; // ±fração (0.04 = ±4%)
  maxVoices?: number; // simultâneos por grupo
  cooldownMs?: number;
}

class SoundBank {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buses: Partial<Record<Bus, GainNode>> = {};
  private buffers = new Map<string, AudioBuffer>();
  private loading = new Map<string, Promise<AudioBuffer | null>>();
  private lastVariant = new Map<string, string>();
  private lastPlayed = new Map<string, number>();
  private active = new Map<string, Set<AudioBufferSourceNode>>();
  private music: { group: string; src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private ambience: { group: string; src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private volumes: Record<Bus, number> = { music: 0.6, sfx: 0.9, voice: 0.9, ambient: 0.55 };
  private masterVolume = 0.85;
  private muted = false;
  private pendingMusic: string | null = null;
  private pendingAmbience: string | null = null;
  /** grupo que está carregando para cada faixa (evita iniciar a mesma música várias vezes) */
  private loadingSlot: Record<'music' | 'ambience', string | null> = { music: null, ambience: null };

  has(group: string): boolean {
    return Boolean(GROUPS[group]?.length);
  }

  /** Usa o mesmo AudioContext do motor de síntese (um só contexto no celular). */
  attach(ctx: AudioContext): void {
    if (this.ctx === ctx) return;
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    (['music', 'sfx', 'voice', 'ambient'] as Bus[]).forEach((b) => {
      const g = ctx.createGain();
      g.connect(this.master!);
      this.buses[b] = g;
    });
    this.applyVolumes();
    if (this.pendingMusic) this.playMusic(this.pendingMusic);
    if (this.pendingAmbience) this.playAmbience(this.pendingAmbience);
  }

  setVolumes(v: Partial<Record<Bus, number>> & { master?: number; muted?: boolean }): void {
    (['music', 'sfx', 'voice', 'ambient'] as Bus[]).forEach((b) => {
      if (typeof v[b] === 'number') this.volumes[b] = Math.max(0, Math.min(1, v[b]!));
    });
    if (typeof v.master === 'number') this.masterVolume = Math.max(0, Math.min(1, v.master));
    if (typeof v.muted === 'boolean') this.muted = v.muted;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.masterVolume, t, 0.05);
    (Object.keys(this.buses) as Bus[]).forEach((b) => this.buses[b]!.gain.setTargetAtTime(this.volumes[b], t, 0.05));
  }

  private load(url: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(url);
    if (cached) return Promise.resolve(cached);
    const pending = this.loading.get(url);
    if (pending) return pending;
    if (!this.ctx) return Promise.resolve(null);
    const ctx = this.ctx;
    const p = fetch(url)
      .then((r) => r.arrayBuffer())
      .then((data) => new Promise<AudioBuffer>((res, rej) => ctx.decodeAudioData(data, res, rej)))
      .then((buf) => {
        this.buffers.set(url, buf);
        return buf;
      })
      .catch(() => null);
    this.loading.set(url, p);
    return p;
  }

  /** Pré-carrega grupos (ex.: tudo de combate ao entrar na luta). */
  preload(prefixes: string[]): void {
    if (!this.ctx) return;
    Object.entries(GROUPS).forEach(([g, urls]) => {
      if (prefixes.some((p) => g.startsWith(p))) urls.forEach((u) => void this.load(u));
    });
  }

  private pick(group: string): string | null {
    const list = GROUPS[group];
    if (!list?.length) return null;
    if (list.length === 1) return list[0];
    const last = this.lastVariant.get(group);
    const options = list.filter((u) => u !== last);
    const choice = options[Math.floor(Math.random() * options.length)];
    this.lastVariant.set(group, choice);
    return choice;
  }

  /**
   * Toca um grupo. Retorna false se o som ainda não está pronto (o chamador pode usar
   * a síntese de reserva); nesse caso o arquivo começa a carregar para a próxima vez.
   */
  play(group: string, opts: PlayOpts = {}): boolean {
    if (!this.ctx || !this.master || this.muted) return this.has(group);
    const url = this.pick(group);
    if (!url) return false;
    const buf = this.buffers.get(url);
    if (!buf) {
      void this.load(url);
      // variações já carregadas servem enquanto esta carrega
      const ready = GROUPS[group].map((u) => this.buffers.get(u)).find(Boolean);
      if (!ready) return false;
      return this.start(group, ready, opts);
    }
    return this.start(group, buf, opts);
  }

  private start(group: string, buf: AudioBuffer, opts: PlayOpts): boolean {
    const now = performance.now();
    if (opts.cooldownMs && now - (this.lastPlayed.get(group) ?? 0) < opts.cooldownMs) return true;
    const set = this.active.get(group) ?? new Set();
    const max = opts.maxVoices ?? 4;
    if (set.size >= max) {
      // rouba o mais antigo para não acumular
      const oldest = set.values().next().value as AudioBufferSourceNode | undefined;
      try {
        oldest?.stop();
      } catch {
        /* já parou */
      }
      if (oldest) set.delete(oldest);
    }
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const j = opts.rateJitter ?? (busOf(group) === 'sfx' ? 0.05 : 0);
    if (j) src.playbackRate.value = 1 + (Math.random() * 2 - 1) * j;
    const g = ctx.createGain();
    g.gain.value = opts.gain ?? 1;
    src.connect(g).connect(this.buses[busOf(group)]!);
    src.onended = () => set.delete(src);
    set.add(src);
    this.active.set(group, set);
    this.lastPlayed.set(group, now);
    src.start();
    return true;
  }

  /** Para tudo de um grupo (ex.: narrador anterior). */
  stopGroup(prefix: string): void {
    this.active.forEach((set, g) => {
      if (!g.startsWith(prefix)) return;
      set.forEach((s) => {
        try {
          s.stop();
        } catch {
          /* ok */
        }
      });
      set.clear();
    });
  }

  private loopOn(group: string, slot: 'music' | 'ambience', fadeIn = 0.8): void {
    const current = slot === 'music' ? this.music : this.ambience;
    if (current?.group === group) return;
    if (slot === 'music') this.pendingMusic = group;
    else this.pendingAmbience = group;
    if (!this.ctx) return;
    const url = GROUPS[group]?.[0];
    if (!url) return;
    if (this.loadingSlot[slot] === group) return;
    this.loadingSlot[slot] = group;
    void this.load(url).then((buf) => {
      if (this.loadingSlot[slot] === group) this.loadingSlot[slot] = null;
      const want = slot === 'music' ? this.pendingMusic : this.pendingAmbience;
      const playing = slot === 'music' ? this.music : this.ambience;
      if (!buf || !this.ctx || want !== group || playing?.group === group) return;
      const ctx = this.ctx;
      const prev = slot === 'music' ? this.music : this.ambience;
      if (prev) {
        prev.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
        const s = prev.src;
        window.setTimeout(() => {
          try {
            s.stop();
          } catch {
            /* ok */
          }
        }, 1500);
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = !group.startsWith('victory/') && !group.startsWith('defeat/');
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.gain.setTargetAtTime(1, ctx.currentTime, fadeIn / 3);
      src.connect(gain).connect(this.buses[slot === 'music' ? 'music' : 'ambient']!);
      src.start();
      const entry = { group, src, gain };
      if (slot === 'music') this.music = entry;
      else this.ambience = entry;
    });
  }

  playMusic(group: string): void {
    this.loopOn(group, 'music');
  }

  playAmbience(group: string): void {
    this.loopOn(group, 'ambience', 1.5);
  }

  private stopSlot(slot: 'music' | 'ambience'): void {
    const cur = slot === 'music' ? this.music : this.ambience;
    if (slot === 'music') {
      this.music = null;
      this.pendingMusic = null;
    } else {
      this.ambience = null;
      this.pendingAmbience = null;
    }
    if (!cur || !this.ctx) return;
    cur.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
    window.setTimeout(() => {
      try {
        cur.src.stop();
      } catch {
        /* ok */
      }
    }, 1000);
  }

  stopMusic(): void {
    this.stopSlot('music');
  }

  stopAmbience(): void {
    this.stopSlot('ambience');
  }
}

export const soundBank = new SoundBank();
export const SOUND_GROUPS = GROUPS;
