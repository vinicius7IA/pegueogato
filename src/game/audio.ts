import { soundBank } from './soundBank';

type MusicStyle = 'samba_reggae' | 'pagode_rua' | 'ijexa' | 'percussao_baiana';

class ArcadeAudioEngine {
  private ctx: AudioContext | null = null;
  private noiseCache: AudioBuffer | null = null;
  private masterVolume = 0.85;
  private musicVolume = 0.55;
  private sfxVolume = 0.9;
  private voiceVolume = 0.9;
  private enabled = true;
  private unlocked = false;

  private musicTimer: number | null = null;
  private musicStep = 0;
  private currentStyle: MusicStyle | null = null;

  public configure(volume: number, enabled: boolean): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.enabled = enabled;
    if (!enabled) this.stopStageMusic();
  }

  public configureMix(mix: {
    masterVolume: number;
    musicVolume: number;
    sfxVolume: number;
    voiceVolume: number;
    ambientVolume?: number;
    sfxEnabled: boolean;
  }): void {
    soundBank.setVolumes({
      master: mix.masterVolume,
      music: mix.musicVolume,
      sfx: mix.sfxVolume,
      voice: mix.voiceVolume,
      ambient: mix.ambientVolume ?? 0.55,
      muted: !mix.sfxEnabled,
    });
    this.masterVolume = Math.max(0, Math.min(1, mix.masterVolume));
    this.musicVolume = Math.max(0, Math.min(1, mix.musicVolume));
    this.sfxVolume = Math.max(0, Math.min(1, mix.sfxVolume));
    this.voiceVolume = Math.max(0, Math.min(1, mix.voiceVolume));
    this.enabled = mix.sfxEnabled;
    if (!this.enabled || this.musicVolume <= 0.01) {
      this.stopStageMusic();
    }
  }

  private silentEl: HTMLAudioElement | null = null;

  /**
   * Destrava o som em qualquer gesto (touchstart/touchend/click/tecla) até o AudioContext rodar.
   * - toca um buffer vazio dentro do gesto (exigência do iOS/WKWebView);
   * - pede sessão de "reprodução" (Safari 17+) e mantém um <audio> mudo em loop,
   *   para o iPhone tocar mesmo com a chave de silencioso;
   * - retoma o áudio quando o app volta do segundo plano.
   * Retorna a função que remove os ouvintes.
   */
  public installUnlock(): () => void {
    const events = ['touchstart', 'touchend', 'pointerdown', 'mousedown', 'click', 'keydown'];
    const opts = { capture: true, passive: true } as const;
    const handler = () => {
      this.unlockAudio();
      const ctx = this.ctx;
      if (ctx) {
        try {
          const buf = ctx.createBuffer(1, 1, 22050);
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.connect(ctx.destination);
          src.start(0);
        } catch {
          /* ok */
        }
        ctx.resume().catch(() => {});
      }
      try {
        const nav = navigator as Navigator & { audioSession?: { type: string } };
        if (nav.audioSession) nav.audioSession.type = 'playback';
      } catch {
        /* sem audioSession */
      }
      if (!this.silentEl) {
        try {
          const el = new Audio(silentWavDataUri());
          el.loop = true;
          el.setAttribute('playsinline', '');
          el.play().catch(() => {});
          this.silentEl = el;
        } catch {
          /* sem <audio> */
        }
      }
      if (ctx && ctx.state === 'running') events.forEach((e) => window.removeEventListener(e, handler, opts));
    };
    const onVisible = () => {
      if (!document.hidden) this.ctx?.resume().catch(() => {});
    };
    events.forEach((e) => window.addEventListener(e, handler, opts));
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      events.forEach((e) => window.removeEventListener(e, handler, opts));
      document.removeEventListener('visibilitychange', onVisible);
    };
  }

  public unlockAudio(): void {
    this.unlocked = true;
    const ctx = this.ensureContext();
    if (ctx && this.wantedScreenMusic) soundBank.playMusic(this.wantedScreenMusic);
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  private get sfxGain(): number {
    return this.masterVolume * this.sfxVolume;
  }

  private get musGain(): number {
    return this.masterVolume * this.musicVolume;
  }

  private ensureContext(): AudioContext | null {
    if (!this.enabled || this.masterVolume <= 0.01) return null;
    if (!this.ctx) {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
        soundBank.attach(this.ctx);
        soundBank.preload(['ui/', 'combat/', 'announcer/']);
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended' && this.unlocked) {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseCache && this.noiseCache.sampleRate === ctx.sampleRate) {
      return this.noiseCache;
    }
    const sampleRate = ctx.sampleRate;
    const frameCount = Math.floor(sampleRate * 0.65);
    const buffer = ctx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseCache = buffer;
    return buffer;
  }

  private createPunchDistortion(ctx: AudioContext): WaveShaperNode {
    const shaper = ctx.createWaveShaper();
    const n = 256;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = Math.tanh(x * 2.8);
    }
    shaper.curve = curve;
    return shaper;
  }

  /** Narrador: textos conhecidos tocam a gravação; os demais são ignorados (sem TTS robótico do navegador). */
  public announce(text: string): void {
    const t = text.toLowerCase();
    const round = /round (\d+)/.exec(t);
    const key = round
      ? Number(round[1]) === 1
        ? 'round_1'
        : Number(round[1]) === 2
          ? 'round_2'
          : 'round_final'
      : t.includes('luta') || t.includes('lutem') || t === 'fight!'
        ? 'fight'
        : t.includes('nocaute') || t.includes('k.o')
          ? 'ko'
          : t.includes('tempo')
            ? 'time_over'
            : t.includes('perfeito')
              ? 'perfect'
              : t.includes('empate')
                ? 'draw'
                : null;
    if (!key) return;
    this.announcer(key);
  }

  public announcer(key: string): void {
    this.ensureContext();
    soundBank.stopGroup('announcer/');
    soundBank.play(`announcer/${key}`, { maxVoices: 1 });
  }

  // ------------------------------------------------------------ vozes, torcida, cenários
  private voiceCooldown = new Map<string, number>();

  /** Voz de personagem. kind: attack, heavy, hurt, fall, taunt, special, super, victory, defeat, laugh, surprise, breath */
  public voice(fighterId: string, kind: string, chance = 1): void {
    if (Math.random() > chance) return;
    const who = fighterId === 'maluco' ? 'maluco' : 'beto';
    let group = `characters/${who}/${kind}`;
    if (!soundBank.has(group)) {
      // equivalentes entre personagens
      const alt: Record<string, string> = { heavy: 'special', laugh: 'taunt', surprise: 'hurt', breath: 'hurt' };
      group = `characters/${who}/${alt[kind] ?? 'attack'}`;
    }
    const priority = kind === 'victory' || kind === 'defeat' || kind === 'super' || kind === 'special' || kind === 'fall';
    const now = performance.now();
    if (!priority && now - (this.voiceCooldown.get(who) ?? 0) < 700) return;
    if (priority) soundBank.stopGroup(`characters/${who}/`);
    this.voiceCooldown.set(who, now);
    soundBank.play(group, { maxVoices: 1 });
  }

  public crowd(kind: 'cheer' | 'gasp' | 'ooh' | 'chant'): void {
    const group =
      kind === 'chant'
        ? ['stages/crowd/chant_tricolor', 'stages/crowd/chant_rubronegro', 'stages/crowd/chant_luta'][Math.floor(Math.random() * 3)]
        : `stages/crowd/${kind}`;
    soundBank.play(group, { maxVoices: 2, cooldownMs: 900, gain: kind === 'chant' ? 0.7 : 1 });
  }

  public sfx(group: string, gain = 1): boolean {
    this.ensureContext();
    return soundBank.play(`combat/${group}`, { gain });
  }

  public ui(kind: 'nav' | 'select' | 'confirm' | 'back' | 'unlock' | 'transition' | 'locked'): void {
    this.ensureContext();
    soundBank.play(`ui/${kind}`, { maxVoices: 2, rateJitter: 0 });
  }

  /** Música + ambiente do cenário (arquivos); cai na síntese antiga se não houver arquivo. */
  public startStage(arenaId: string, fallback: MusicStyle): void {
    const map: Record<string, string> = { farol_barra: 'farol', favela_salvador: 'favela', pituba: 'shopping' };
    const st = map[arenaId] ?? 'farol';
    this.ensureContext();
    this.wantedScreenMusic = `music/stage_${st}`;
    if (soundBank.has(this.wantedScreenMusic)) {
      this.stopStageMusic();
      soundBank.playMusic(this.wantedScreenMusic);
      soundBank.playAmbience(`stages/${st}/ambience`);
      soundBank.preload([`characters/`, 'stages/crowd/', `stages/${st}/`]);
    } else {
      this.startStageMusic(fallback);
    }
  }

  public stopStage(): void {
    this.stopStageMusic();
    soundBank.stopAmbience();
  }

  private wantedScreenMusic: string | null = null;

  /** Trilha por tela (menu, seleção, resultado). */
  public screenMusic(screen: string, didWin?: boolean): void {
    const group =
      screen === 'result'
        ? didWin === false
          ? 'defeat/defeat_jingle'
          : 'victory/victory_jingle'
        : screen === 'select' || screen === 'stage_select' || screen === 'bracket'
          ? 'music/select'
          : screen === 'arena'
            ? null
            : 'music/menu_theme';
    if (!group) return;
    if (screen !== 'result') soundBank.stopAmbience();
    this.wantedScreenMusic = group;
    if (this.unlocked) this.ensureContext();
    soundBank.playMusic(group);
  }

  public startStageMusic(style: MusicStyle): void {
    if (!this.enabled || this.musGain <= 0.02) return;
    if (this.currentStyle === style && this.musicTimer !== null) return;
    this.stopStageMusic();
    this.currentStyle = style;
    this.musicStep = 0;

    const stepMs =
      style === 'pagode_rua'
        ? 145
        : style === 'samba_reggae'
          ? 160
          : style === 'percussao_baiana'
            ? 150
            : 178;

    this.musicTimer = window.setInterval(() => {
      if (!this.enabled || this.musGain <= 0.02 || !this.unlocked) return;
      const ctx = this.ensureContext();
      if (!ctx || ctx.state !== 'running') return;
      this.triggerMusicStep(ctx, style, this.musicStep);
      this.musicStep = (this.musicStep + 1) % 16;
    }, stepMs);
  }

  public stopStageMusic(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.currentStyle = null;
  }

  private triggerMusicStep(ctx: AudioContext, style: MusicStyle, step: number): void {
    const now = ctx.currentTime;
    const vol = this.musGain * 0.28;

    // Surdo / bass drum Bahian pulse
    const surdoPattern =
      style === 'samba_reggae'
        ? [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0]
        : style === 'ijexa'
          ? [1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0]
          : [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0];

    if (surdoPattern[step]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const pitch = step % 8 === 0 ? 96 : 118;
      osc.frequency.setValueAtTime(pitch, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.14);
      gain.gain.setValueAtTime(vol * 0.85, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.17);
    }

    // Timbal / caixa accent
    if (step % 4 === 2 || (style === 'pagode_rua' && (step === 7 || step === 15))) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.getNoiseBuffer(ctx);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1600, now);
      bp.Q.value = 1.8;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol * 0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
      noise.connect(bp).connect(gain).connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.06);
    }

    // Agogô / Berimbau melodic bell line
    const agogoSteps =
      style === 'ijexa'
        ? { 0: 523.25, 3: 659.25, 6: 523.25, 8: 659.25, 11: 783.99, 14: 659.25 }
        : { 0: 440, 2: 523.25, 6: 659.25, 8: 440, 10: 587.33, 14: 523.25 };
    const freq = (agogoSteps as Record<number, number | undefined>)[step];
    if (freq) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = style === 'ijexa' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(vol * 0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    }
  }

  public playClick(): void {
    this.ensureContext();
    if (soundBank.play('ui/nav', { rateJitter: 0 })) return;
    const ctx = this.ensureContext();
    if (!ctx || this.sfxGain <= 0.01) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(560, now);
    osc.frequency.exponentialRampToValueAtTime(920, now + 0.045);
    gain.gain.setValueAtTime(0.11 * this.sfxGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  public playSelectSnap(): void {
    this.ensureContext();
    if (soundBank.play('ui/select', { rateJitter: 0 })) return;
    const ctx = this.ensureContext();
    if (!ctx || this.sfxGain <= 0.01) return;
    const now = ctx.currentTime;
    [440, 659.25].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.04);
      gain.gain.setValueAtTime(0.16 * this.sfxGain, now + i * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.12);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.04);
      osc.stop(now + i * 0.04 + 0.13);
    });
  }

  public playWhoosh(): void {
    this.ensureContext();
    if (soundBank.play('combat/whoosh')) return;
    const ctx = this.ensureContext();
    if (!ctx || this.sfxGain <= 0.01) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1150, now);
    filter.frequency.exponentialRampToValueAtTime(280, now + 0.14);
    filter.Q.value = 1.6;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.16 * this.sfxGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.15);
  }

  public playDodge(): void {
    this.ensureContext();
    if (soundBank.play('combat/dodge')) return;
    const ctx = this.ensureContext();
    if (!ctx || this.sfxGain <= 0.01) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1900, now);
    filter.frequency.exponentialRampToValueAtTime(550, now + 0.12);
    filter.Q.value = 2.4;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.22 * this.sfxGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.14);
  }

  public playParry(): void {
    this.ensureContext();
    if (soundBank.play('combat/block', { gain: 1.2 })) {
      soundBank.play('combat/special_charge', { gain: 0.5 });
      return;
    }
    const ctx = this.ensureContext();
    if (!ctx || this.sfxGain <= 0.01) return;
    const now = ctx.currentTime;
    [987.77, 1480, 1975.53].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime((0.22 - i * 0.05) * this.sfxGain, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    });
  }

  public playGrabBreak(): void {
    this.ensureContext();
    if (soundBank.play('combat/block')) return;
    const ctx = this.ensureContext();
    if (!ctx || this.sfxGain <= 0.01) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.12);
    gain.gain.setValueAtTime(0.2 * this.sfxGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playStun(): void {
    this.ensureContext();
    if (soundBank.play('combat/hit_body')) return;
    const ctx = this.ensureContext();
    if (!ctx || this.sfxGain <= 0.01) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 659.25].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(0.14 * this.sfxGain, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.12);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.13);
    });
  }

  public playPunch(heavy = false): void {
    this.ensureContext();
    if (soundBank.play(heavy ? 'combat/punch_heavy' : 'combat/punch_light')) {
      soundBank.play(heavy ? 'combat/hit_body' : 'combat/hit_face', { gain: 0.8 });
      return;
    }
    const ctx = this.ensureContext();
    if (!ctx || this.sfxGain <= 0.01) return;
    const now = ctx.currentTime;
    const sat = this.createPunchDistortion(ctx);

    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(heavy ? 185 : 230, now);
    sub.frequency.exponentialRampToValueAtTime(heavy ? 36 : 52, now + (heavy ? 0.21 : 0.12));
    subGain.gain.setValueAtTime((heavy ? 0.52 : 0.36) * this.sfxGain, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + (heavy ? 0.23 : 0.13));
    sub.connect(sat).connect(subGain).connect(ctx.destination);
    sub.start(now);
    sub.stop(now + 0.24);

    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(heavy ? 1450 : 2100, now);
    bp.frequency.exponentialRampToValueAtTime(480, now + 0.09);
    bp.Q.value = 0.9;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime((heavy ? 0.48 : 0.32) * this.sfxGain, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + (heavy ? 0.16 : 0.09));
    noise.connect(bp).connect(nGain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.17);
  }

  public playSlap(): void {
    this.ensureContext();
    if (soundBank.play('combat/hit_face', { gain: 1.1 })) return;
    const ctx = this.ensureContext();
    if (!ctx || this.sfxGain <= 0.01) return;
    const now = ctx.currentTime;

    const crack = ctx.createBufferSource();
    crack.buffer = this.getNoiseBuffer(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(3400, now);
    hp.frequency.exponentialRampToValueAtTime(950, now + 0.09);
    hp.Q.value = 0.85;
    const cGain = ctx.createGain();
    cGain.gain.setValueAtTime(0.62 * this.sfxGain, now);
    cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    crack.connect(hp).connect(cGain).connect(ctx.destination);
    crack.start(now);
    crack.stop(now + 0.12);

    const echo = ctx.createBufferSource();
    echo.buffer = this.getNoiseBuffer(ctx);
    const eFilter = ctx.createBiquadFilter();
    eFilter.type = 'bandpass';
    eFilter.frequency.setValueAtTime(1900, now + 0.028);
    eFilter.Q.value = 1.1;
    const eGain = ctx.createGain();
    eGain.gain.setValueAtTime(0.001, now);
    eGain.gain.setValueAtTime(0.24 * this.sfxGain, now + 0.028);
    eGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    echo.connect(eFilter).connect(eGain).connect(ctx.destination);
    echo.start(now + 0.025);
    echo.stop(now + 0.2);

    const body = ctx.createOscillator();
    const bGain = ctx.createGain();
    body.type = 'triangle';
    body.frequency.setValueAtTime(420, now);
    body.frequency.exponentialRampToValueAtTime(95, now + 0.075);
    bGain.gain.setValueAtTime(0.32 * this.sfxGain, now);
    bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    body.connect(bGain).connect(ctx.destination);
    body.start(now);
    body.stop(now + 0.09);
  }

  public playKick(): void {
    this.ensureContext();
    if (soundBank.play(Math.random() < 0.5 ? 'combat/kick_heavy' : 'combat/kick_light')) {
      soundBank.play('combat/hit_body', { gain: 0.8 });
      return;
    }
    const ctx = this.ensureContext();
    if (!ctx || this.sfxGain <= 0.01) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(215, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.18);
    gain.gain.setValueAtTime(0.45 * this.sfxGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);

    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1800, now);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.3 * this.sfxGain, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    noise.connect(lp).connect(nGain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.12);
  }

  public playBlock(): void {
    this.ensureContext();
    if (soundBank.play('combat/block')) return;
    const ctx = this.ensureContext();
    if (!ctx || this.sfxGain <= 0.01) return;
    const now = ctx.currentTime;
    [360, 540].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i === 0 ? 'square' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.45, now + 0.08);
      gain.gain.setValueAtTime(0.14 * this.sfxGain, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    });
  }

  public playSpecial(): void {
    this.ensureContext();
    if (soundBank.play('combat/special_whoosh')) return;
    const ctx = this.ensureContext();
    if (!ctx || this.sfxGain <= 0.01) return;
    const now = ctx.currentTime;
    [293.66, 440, 587.33, 880].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.035);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.45, now + idx * 0.035 + 0.2);
      gain.gain.setValueAtTime(0.15 * this.sfxGain, now + idx * 0.035);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.035 + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + idx * 0.035);
      osc.stop(now + idx * 0.035 + 0.29);
    });
  }

  public playFinisher(): void {
    this.ensureContext();
    if (soundBank.play('combat/special_impact', { gain: 1.2 })) return;
    const ctx = this.ensureContext();
    if (!ctx || this.sfxGain <= 0.01) return;
    const now = ctx.currentTime;
    [146.83, 220, 440, 880, 1174.66].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx < 2 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.6, now + idx * 0.05 + 0.35);
      gain.gain.setValueAtTime(0.18 * this.sfxGain, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.42);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.44);
    });
  }

  public playCatSwarm(): void {
    this.ensureContext();
    if (soundBank.play('combat/cat_swarm')) return;
    const ctx = this.ensureContext();
    if (!ctx || this.sfxGain <= 0.01) return;
    const now = ctx.currentTime;
    [0, 0.09, 0.19, 0.31, 0.43].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i % 2 === 0 ? 'sawtooth' : 'triangle';
      const base = 580 + (i % 3) * 110;
      osc.frequency.setValueAtTime(base, now + offset);
      osc.frequency.exponentialRampToValueAtTime(base * 1.48, now + offset + 0.07);
      osc.frequency.exponentialRampToValueAtTime(base * 0.72, now + offset + 0.22);
      gain.gain.setValueAtTime(0.12 * this.sfxGain, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.24);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.25);
    });
  }

  public playKO(): void {
    this.ensureContext();
    if (soundBank.play('combat/ko_impact', { maxVoices: 1 })) return;
    const ctx = this.ensureContext();
    if (!ctx || this.sfxGain <= 0.01) return;
    const now = ctx.currentTime;
    [0, 0.18, 0.36].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150 - idx * 20, now + offset);
      osc.frequency.exponentialRampToValueAtTime(28, now + offset + 0.45);
      gain.gain.setValueAtTime((0.38 / (idx + 1)) * this.sfxGain, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.52);
    });
  }

  public playRoundBell(): void {
    this.ensureContext();
    if (soundBank.play('combat/round_bell', { maxVoices: 1, rateJitter: 0 })) return;
    const ctx = this.ensureContext();
    if (!ctx || this.sfxGain <= 0.01) return;
    const now = ctx.currentTime;
    [587.33, 880, 1174.66].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.14 * this.sfxGain, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.58);
    });
  }

  public playCoin(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.sfxGain <= 0.01) return;
    const now = ctx.currentTime;
    [987.77, 1318.51].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.07);
      gain.gain.setValueAtTime(0.16 * this.sfxGain, now + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + 0.18);
    });
  }

  public playMeow(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.sfxGain <= 0.01) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(950, now + 0.11);
    osc.frequency.exponentialRampToValueAtTime(490, now + 0.32);
    gain.gain.setValueAtTime(0.14 * this.sfxGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.36);
  }
}

export const gameAudio = new ArcadeAudioEngine();

/** WAV mudo (0,5 s, 8 kHz, 8 bits) gerado na hora, para o truque do <audio> no iPhone. */
function silentWavDataUri(): string {
  const n = 4000;
  const bytes = new Uint8Array(44 + n);
  const view = new DataView(bytes.buffer);
  const str = (o: number, t: string) => [...t].forEach((c, i) => (bytes[o + i] = c.charCodeAt(0)));
  str(0, 'RIFF');
  view.setUint32(4, 36 + n, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  str(36, 'data');
  view.setUint32(40, n, true);
  bytes.fill(128, 44);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return 'data:audio/wav;base64,' + btoa(bin);
}
