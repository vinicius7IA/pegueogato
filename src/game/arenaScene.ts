import * as THREE from 'three';
import { gameAudio } from './audio';
import { ARENAS, FIGHTERS, getDisplayFighterMeta, MOVES, POWERS } from './catalog';
import { animateFighterRig, buildFighterRig, FighterRigHandles } from './fighterRig';
import { isSoftwareWebGL, scheduleSoftwareGlFrame } from './glUtils';
import {
  createAsphaltNormalTexture,
  createAsphaltRoadTexture,
  createAtencaoSignTexture,
  createBahiaBannerTexture,
  createBahiaSignTexture,
  createCajazeiraParedaoTexture,
  createChurchTowerTexture,
  createColonialFacadeTexture,
  createContactShadowTexture,
  createFavelaBrickTexture,
  createHotelSignTexture,
  createLighthouseStripesTexture,
  createPelourinhoCobbleNormalTexture,
  createPelourinhoCobbleTexture,
  createRioVermelhoNeonTexture,
  createSalvadorSkyTexture,
  createStreetGroundTexture,
  createWaterNormalTexture,
  createWaterWaveTexture,
  createWoodDockTexture,
  createWoodNormalTexture,
} from './textures';
import {
  AiDifficulty,
  ArenaId,
  CombatHudSnapshot,
  DamagePopup,
  FighterId,
  HitboxDebugRect,
  MatchMode,
  MatchSummary,
  MoveId,
  PowerId,
  QualityPreset,
  TrainingDummyMode,
} from './types';

export interface FighterInputState {
  moveX: number; // -1..1
  crouch: boolean;
  jump: boolean;
  block: boolean;
  parry: boolean;
  dodge: boolean;
  punchLight: boolean;
  punchMed: boolean;
  punchHeavy: boolean;
  kickLight: boolean;
  kickMed: boolean;
  kickHeavy: boolean;
  grab: boolean;
  special1: boolean;
  special2: boolean;
  specialCombo: boolean;
  powerMove: boolean;
  finisher: boolean;
  taunt: boolean;
  // Legacy convenience aliases mapped transparently
  quickPunch?: boolean;
  heavyPunch?: boolean;
  slap?: boolean;
  kick?: boolean;
}

export function createEmptyInput(): FighterInputState {
  return {
    moveX: 0,
    crouch: false,
    jump: false,
    block: false,
    parry: false,
    dodge: false,
    punchLight: false,
    punchMed: false,
    punchHeavy: false,
    kickLight: false,
    kickMed: false,
    kickHeavy: false,
    grab: false,
    special1: false,
    special2: false,
    specialCombo: false,
    powerMove: false,
    finisher: false,
    taunt: false,
  };
}

type NpcKind = 'tricolor' | 'rubronegro' | 'semcamisa' | 'bone' | 'ambulante' | 'seguranca' | 'pedestre';

interface FighterRuntime {
  slot: 'p1' | 'p2';
  fighterId: FighterId;
  skinId: string;
  powerId: PowerId;
  rig: FighterRigHandles;
  shadow: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  hp: number;
  maxHp: number;
  energy: number;
  stun: number;
  state: MoveId;
  stateTime: number;
  stateDuration: number;
  hasHitCurrentMove: boolean;
  multiHitCount: number;
  comboCount: number;
  comboResetTimer: number;
  maxComboAchieved: number;
  damageDealt: number;
  roundsWon: number;
  perfectParries: number;
  finisherUsed: boolean;
  buff: 'speed' | 'shield' | null;
  buffTimer: number;
  slapRedness: number;
  counterWindowTimer: number;
  dodgedThisMove: boolean;
  dodgeZOffset: number;
  grabWindowTimer: number;
  grabClinched: boolean;
  grabHitApplied: boolean;
  parryWindowTimer: number;
  regenIdleTimer: number;
  bufferedMove: MoveId | null;
  bufferTimer: number;
  /** Tempo segurando para a frente: acima de ~0,35s o lutador corre. */
  runHold: number;
  prevInput: FighterInputState;
  aiThinkTimer: number;
  aiDesiredMove: FighterInputState;
}

interface ImpactParticle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

interface SwarmBlackCat {
  group: THREE.Group;
  tail: THREE.Mesh;
  active: boolean;
  life: number;
  delay: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  phaseOffset: number;
}

export interface ArenaEngineConfig {
  container: HTMLElement;
  arenaId: ArenaId;
  mode: MatchMode;
  aiDifficulty: AiDifficulty;
  roundDurationSec: number;
  p1FighterId: FighterId;
  p1SkinId: string;
  p1PowerId: PowerId;
  p2FighterId: FighterId;
  p2SkinId: string;
  p2PowerId: PowerId;
  p2Nickname: string;
  onlineRole?: 'host' | 'guest';
  quality: QualityPreset;
  cameraShake: boolean;
  showHitEffects: boolean;
  authorizationMode: boolean;
  arcadeStage?: number;
  onHudUpdate: (hud: CombatHudSnapshot) => void;
  onMatchFinish: (summary: MatchSummary) => void;
  onContextLost?: (lost: boolean) => void;
  onSendOnlineState?: (payload: OnlineSyncPacket) => void;
}

export interface OnlineSyncPacket {
  type: 'fighter_sync';
  x: number;
  y: number;
  state: MoveId;
  stateTime: number;
  hp: number;
  energy: number;
  facing: 1 | -1;
  buff: 'speed' | 'shield' | null;
  hitEvent?: {
    damage: number;
    move: MoveId;
    combo: number;
    knockback: number;
  };
}

const _hitPos = new THREE.Vector3();
const _projVec = new THREE.Vector3();

export class ArenaCombatEngine {
  private cfg: ArenaEngineConfig;
  private isSoftwareGl: boolean;
  private resolvedQuality: 'high' | 'medium' | 'low';
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private frameId = 0;
  private bannerTimer = 0;
  private contextLostTimer = 0;
  private disposed = false;
  private contextLost = false;

  private p1!: FighterRuntime;
  private p2!: FighterRuntime;
  private p1Input: FighterInputState = createEmptyInput();
  private p2Input: FighterInputState = createEmptyInput();

  private catGroup!: THREE.Group;
  private catTail!: THREE.Mesh;
  private catJumpTimer = 0;

  private swarmCats: SwarmBlackCat[] = [];
  private lighthouseBeacon: THREE.Mesh | null = null;
  private stageAnimators: Array<(dt: number, elapsed: number, hitPulse: number) => void> = [];
  private stageHitPulse = 0;
  private superFlashTimer = 0;
  private keyLight!: THREE.DirectionalLight;

  private particles: ImpactParticle[] = [];
  private shockwaveRing!: THREE.Mesh;
  private shockwaveLife = 0;
  private damagePopups: DamagePopup[] = [];
  private popupNextId = 1;

  private showHitboxes = false;
  private trainingDummyMode: TrainingDummyMode = 'stand';

  private roundNumber = 1;
  private roundTimer: number;
  private roundPhase: 'intro' | 'fight' | 'ko_slowmo' | 'round_over' | 'match_over' = 'intro';
  private phaseTimer = 1.4;
  private finisherCamTimer = 0;
  private bannerText: string | null = 'ROUND 1';
  private calloutText: string | null = null;
  private calloutSide: 'left' | 'right' | null = null;
  private calloutTimer = 0;
  private quoteText: string | null = null;
  private quoteSide: 'left' | 'right' | null = null;
  private quoteTimer = 0;
  private shakeAmount = 0;
  private hitstopTimer = 0;
  private matchElapsed = 0;
  private perfectRoundsP1 = 0;
  private isPaused = false;
  private hudEmitAccum = 0;
  private netSendAccum = 0;

  private disposables: Array<{ dispose: () => void }> = [];
  private resizeObserver: ResizeObserver;

  constructor(cfg: ArenaEngineConfig) {
    this.cfg = cfg;
    this.roundTimer = cfg.roundDurationSec;
    this.isSoftwareGl = isSoftwareWebGL();

    if (cfg.quality === 'auto') {
      const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
      this.resolvedQuality = this.isSoftwareGl || cores <= 2 ? 'low' : cores <= 4 ? 'medium' : 'high';
    } else {
      this.resolvedQuality = cfg.quality;
    }

    const width = Math.max(240, cfg.container.clientWidth);
    const height = Math.max(240, cfg.container.clientHeight);
    const aspect = width / height;

    const backdropUrl = (ARENAS[cfg.arenaId] || ARENAS.pelourinho).backdropUrl;
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && this.resolvedQuality === 'high',
      powerPreference: 'high-performance',
      alpha: Boolean(backdropUrl),
    });
    const gl = this.renderer.getContext();
    if (!gl || gl.isContextLost()) {
      this.renderer.dispose();
      throw new Error('Contexto WebGL indisponível no navegador. Recarregue a página ou tente em Qualidade Baixa.');
    }

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    const dprCap = this.resolvedQuality === 'high' ? 2 : this.resolvedQuality === 'medium' ? 1.5 : 1;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, dprCap));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && this.resolvedQuality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';

    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored);

    cfg.container.innerHTML = '';
    cfg.container.appendChild(this.renderer.domElement);
    if (backdropUrl) {
      // Cenário 2D: a arte fica atrás do canvas transparente; só os lutadores são 3D
      this.renderer.setClearColor(0x000000, 0);
      Object.assign(cfg.container.style, {
        backgroundImage: `url(${backdropUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center 72%',
        backgroundRepeat: 'no-repeat',
      });
    }

    const arenaDef = ARENAS[cfg.arenaId] || ARENAS.pelourinho;
    this.scene = new THREE.Scene();
    if (arenaDef.backdropUrl) {
      this.scene.background = null;
    } else {
      this.scene.background = new THREE.Color(arenaDef.skyTopHex);
      this.scene.fog = new THREE.FogExp2(arenaDef.skyBottomHex, 0.008);
    }

    this.camera = new THREE.PerspectiveCamera(aspect < 0.85 ? 52 : 42, aspect, 0.1, 145);
    this.camera.position.set(0, aspect < 0.85 ? 2.45 : 1.75, aspect < 0.85 ? 10.2 : 5.8);
    this.camera.lookAt(0, 1.05, 0);

    this.setupLighting(arenaDef.timeOfDay);
    this.buildSelectedSalvadorArena(arenaDef.id);
    this.setupFighters();
    this.setupBlackCatSwarmPool();
    this.setupVfxPool();

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(cfg.container);

    gameAudio.startStageMusic(arenaDef.musicStyle);
    if (cfg.mode === 'training') {
      this.roundPhase = 'fight';
      this.bannerText = 'MODO TREINO';
      this.phaseTimer = 0;
      this.bannerTimer = window.setTimeout(() => {
        if (!this.disposed) this.bannerText = null;
      }, 1100);
    } else {
      gameAudio.playRoundBell();
      gameAudio.announce('Round 1');
      this.triggerRandomQuote(this.p1, 'left');
    }

    this.handleResize();
    this.emitHud();
    this.clock.start();
    this.scheduleNextFrame();
  }

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      scheduleSoftwareGlFrame(
        this.renderer.getContext(),
        () => this.disposed,
        (id) => {
          this.frameId = id;
        },
        this.tick,
      );
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private onContextLost = (e: Event): void => {
    e.preventDefault();
    this.contextLost = true;
    clearTimeout(this.contextLostTimer);
    this.contextLostTimer = window.setTimeout(() => {
      if (!this.disposed && this.contextLost) {
        this.cfg.onContextLost?.(true);
      }
    }, 1200);
  };

  private onContextRestored = (): void => {
    this.contextLost = false;
    clearTimeout(this.contextLostTimer);
    if (!this.disposed) {
      this.cfg.onContextLost?.(false);
    }
  };

  public setShowHitboxes(show: boolean): void {
    this.showHitboxes = show;
    this.emitHud();
  }

  public setTrainingDummyMode(mode: TrainingDummyMode): void {
    this.trainingDummyMode = mode;
    this.emitHud();
  }

  private setupLighting(timeOfDay: string): void {
    const isNight = timeOfDay === 'noite';
    const isDusk = timeOfDay === 'por_do_sol' || timeOfDay === 'crepusculo';

    const hemi = new THREE.HemisphereLight(
      isNight ? 0x6366f1 : isDusk ? 0xfde68a : 0xe2e8f0,
      isNight ? 0x1e1b4b : isDusk ? 0x5c3d2e : 0x645b50,
      isNight ? 0.48 : isDusk ? 0.58 : 0.65,
    );
    this.scene.add(hemi);

    this.keyLight = new THREE.DirectionalLight(
      isNight ? 0xa5b4fc : isDusk ? 0xffd59e : 0xfff4e6,
      isNight ? 0.95 : isDusk ? 1.25 : 1.2,
    );
    this.keyLight.position.set(8, 14, 9);
    this.keyLight.castShadow = !this.isSoftwareGl && this.resolvedQuality !== 'low';
    const shadowRes = this.resolvedQuality === 'high' ? 2048 : 1024;
    this.keyLight.shadow.mapSize.set(shadowRes, shadowRes);
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 36;
    this.keyLight.shadow.camera.left = -10;
    this.keyLight.shadow.camera.right = 10;
    this.keyLight.shadow.camera.top = 7;
    this.keyLight.shadow.camera.bottom = -4;
    this.keyLight.shadow.bias = -0.00035;
    this.keyLight.shadow.normalBias = 0.018;
    this.scene.add(this.keyLight);

    const fillLight = new THREE.DirectionalLight(
      isNight ? 0x38bdf8 : isDusk ? 0x93c5fd : 0xcbd5e1,
      isNight ? 0.32 : 0.35,
    );
    fillLight.position.set(-7, 5, 8);
    this.scene.add(fillLight);

    const rim = new THREE.DirectionalLight(
      isNight ? 0xec4899 : isDusk ? 0xfb923c : 0xe2e8f0,
      isNight ? 0.45 : isDusk ? 0.38 : 0.3,
    );
    rim.position.set(-6, 5.5, -7.5);
    this.scene.add(rim);
  }

  private buildSkyDome(arenaId: ArenaId): void {
    const def = ARENAS[arenaId];
    const skyTex = createSalvadorSkyTexture(def.timeOfDay === 'por_do_sol', def.timeOfDay);
    this.disposables.push(skyTex);
    const skyGeo = new THREE.SphereGeometry(72, 24, 16);
    const skyMat = new THREE.MeshBasicMaterial({
      map: skyTex,
      side: THREE.BackSide,
      fog: false,
    });
    this.disposables.push(skyGeo, skyMat);
    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(sky);
  }

  private buildSelectedSalvadorArena(arenaId: ArenaId): void {
    if (ARENAS[arenaId]?.backdropUrl) {
      // Só um plano invisível que recebe a sombra dos lutadores sobre a arte 2D
      const geo = new THREE.PlaneGeometry(58, 36);
      const mat = new THREE.ShadowMaterial({ opacity: 0.35 });
      this.disposables.push(geo, mat);
      const catcher = new THREE.Mesh(geo, mat);
      catcher.rotation.x = -Math.PI / 2;
      catcher.receiveShadow = true;
      this.scene.add(catcher);
      return;
    }
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.buildSkyDome(arenaId);

    const groundTex =
      arenaId === 'pelourinho' || arenaId === 'rio_vermelho'
        ? createPelourinhoCobbleTexture(maxAniso)
        : arenaId === 'gamboa'
          ? createWoodDockTexture(maxAniso)
          : arenaId === 'pituba' || arenaId === 'cajazeira' || arenaId === 'orla'
            ? createAsphaltRoadTexture(maxAniso)
            : createStreetGroundTexture(maxAniso);

    const groundNormalTex =
      arenaId === 'pelourinho' || arenaId === 'rio_vermelho'
        ? createPelourinhoCobbleNormalTexture(maxAniso)
        : arenaId === 'gamboa'
          ? createWoodNormalTexture(maxAniso)
          : createAsphaltNormalTexture(maxAniso);

    this.disposables.push(groundTex, groundNormalTex);
    const groundGeo = new THREE.PlaneGeometry(58, 36);
    const isDampCobble = arenaId === 'pelourinho' || arenaId === 'rio_vermelho';
    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      normalMap: groundNormalTex,
      normalScale: new THREE.Vector2(isDampCobble ? 0.85 : 0.6, isDampCobble ? 0.85 : 0.6),
      roughness: isDampCobble ? 0.85 : 0.92,
      metalness: 0.02,
    });
    this.disposables.push(groundGeo, groundMat);
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    if (arenaId === 'pelourinho') this.buildPelourinhoArena(maxAniso);
    else if (arenaId === 'favela_salvador') this.buildFavelaSalvadorArena(maxAniso);
    else if (arenaId === 'cajazeira') this.buildCajazeiraArena(maxAniso);
    else if (arenaId === 'gamboa') this.buildGamboaArena(maxAniso);
    else if (arenaId === 'pituba') this.buildPitubaArena(maxAniso);
    else if (arenaId === 'elevador_lacerda') this.buildElevadorLacerdaArena(maxAniso);
    else if (arenaId === 'farol_barra') this.buildFarolBarraArena(maxAniso);
    else if (arenaId === 'orla') this.buildOrlaArena(maxAniso);
    else if (arenaId === 'rio_vermelho') this.buildRioVermelhoArena(maxAniso);
    else this.buildDiqueTororoArena(maxAniso);

    if (this.cfg.p1FighterId === 'jesse' || this.cfg.p2FighterId === 'jesse') {
      this.buildJesseMotorcycleProp();
    }

    this.buildMascotCat();
  }

  /**
   * Torcida/NPCs ao fundo (fora da área de luta). Tipos: torcedor tricolor e rubro-negro
   * (camisas listradas, sem escudo), sem camisa, de boné, ambulante, segurança e pedestre.
   * Comportamentos: conversando, comemorando, batendo palma; todos reagem aos golpes.
   */
  private addCheeringCrowd(xs: number[], z: number, kinds?: NpcKind[]): void {
    const skinTones = [0x8d5524, 0xc68642, 0x5c361e, 0xd99e73, 0x6b3f22];
    const torsoGeo = new THREE.CylinderGeometry(0.155, 0.135, 0.48, 14);
    const legGeo = new THREE.CylinderGeometry(0.055, 0.044, 0.46, 10);
    const armGeo = new THREE.CapsuleGeometry(0.038, 0.28, 4, 8);
    const headGeo = new THREE.SphereGeometry(0.115, 14, 12);
    const hairGeo = new THREE.SphereGeometry(0.12, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const capGeo = new THREE.SphereGeometry(0.124, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const brimGeo = new THREE.BoxGeometry(0.14, 0.014, 0.12);
    const shortsMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.85 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.8 });
    this.disposables.push(torsoGeo, legGeo, armGeo, headGeo, hairGeo, capGeo, brimGeo, shortsMat, pantsMat, hairMat);

    const stripeTex = (colors: string[]) => {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 8;
      const g = c.getContext('2d')!;
      const w = c.width / (colors.length * 3);
      for (let i = 0; i < colors.length * 3; i++) {
        g.fillStyle = colors[i % colors.length];
        g.fillRect(i * w, 0, w + 1, c.height);
      }
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      this.disposables.push(t);
      return t;
    };
    const tricolor = stripeTex(['#1d4ed8', '#dc2626', '#f8fafc']);
    const rubronegro = stripeTex(['#dc2626', '#111114']);

    const order: NpcKind[] = kinds ?? ['tricolor', 'rubronegro', 'semcamisa', 'bone', 'tricolor', 'rubronegro'];
    const crowd: Array<{ group: THREE.Group; head: THREE.Mesh; lArm: THREE.Mesh; rArm: THREE.Mesh; phase: number; mode: 'cheer' | 'talk' | 'clap' | 'still' }> = [];

    xs.forEach((x, idx) => {
      const kind = order[idx % order.length];
      const g = new THREE.Group();
      const skin = skinTones[(idx * 3) % skinTones.length];
      const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.58 });
      const shirtMat =
        kind === 'tricolor'
          ? new THREE.MeshStandardMaterial({ map: tricolor, roughness: 0.75 })
          : kind === 'rubronegro'
            ? new THREE.MeshStandardMaterial({ map: rubronegro, roughness: 0.75 })
            : kind === 'semcamisa'
              ? skinMat
              : kind === 'seguranca'
                ? new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.7 })
                : kind === 'ambulante'
                  ? new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.8 })
                  : new THREE.MeshStandardMaterial({ color: [0xfacc15, 0x16a34a, 0xea580c, 0x0284c7][idx % 4], roughness: 0.78 });
      this.disposables.push(skinMat, shirtMat);

      [-0.068, 0.068].forEach((lx) => {
        const leg = new THREE.Mesh(legGeo, kind === 'seguranca' ? pantsMat : idx % 2 ? shortsMat : pantsMat);
        leg.position.set(lx, 0.23, 0);
        g.add(leg);
      });
      const torso = new THREE.Mesh(torsoGeo, shirtMat);
      torso.position.y = 0.68;
      torso.castShadow = true;
      g.add(torso);
      const armMat = kind === 'seguranca' ? shirtMat : skinMat;
      const lArm = new THREE.Mesh(armGeo, armMat);
      lArm.position.set(-0.2, 0.92, 0);
      const rArm = new THREE.Mesh(armGeo, armMat);
      rArm.position.set(0.2, 0.92, 0);
      g.add(lArm, rArm);
      const head = new THREE.Mesh(headGeo, skinMat);
      head.position.y = 1.07;
      g.add(head);
      if (kind === 'bone' || kind === 'ambulante' || kind === 'seguranca') {
        const capMat = new THREE.MeshStandardMaterial({ color: kind === 'seguranca' ? 0x0b0b0d : kind === 'ambulante' ? 0xdc2626 : [0x1d4ed8, 0xdc2626, 0xf8fafc][idx % 3], roughness: 0.7 });
        this.disposables.push(capMat);
        const cap = new THREE.Mesh(capGeo, capMat);
        cap.position.set(0, 1.1, 0);
        const brim = new THREE.Mesh(brimGeo, capMat);
        brim.position.set(0, 1.12, 0.11);
        head.add(cap, brim);
        cap.position.sub(head.position);
        brim.position.sub(head.position);
      } else {
        const hr = new THREE.Mesh(hairGeo, hairMat);
        hr.position.set(0, 0.02, -0.01);
        head.add(hr);
      }
      if (kind === 'ambulante') {
        // isopor do ambulante
        const boxMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.6 });
        this.disposables.push(boxMat);
        const cooler = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.3), boxMat);
        this.disposables.push(cooler.geometry);
        cooler.position.set(0.42, 0.15, 0.05);
        g.add(cooler);
      }

      const pz = z + (idx % 2) * 0.42;
      g.position.set(x, 0, pz);
      g.rotation.y = x < 0 ? 0.35 : -0.35;
      this.scene.add(g);
      const mode = kind === 'seguranca' ? 'still' : (['cheer', 'talk', 'clap'] as const)[idx % 3];
      crowd.push({ group: g, head, lArm, rArm, phase: idx * 0.9, mode });
    });

    this.stageAnimators.push((_dt, elapsed, hitPulse) => {
      crowd.forEach((c) => {
        const excited = hitPulse > 0.25;
        const mode = excited && c.mode !== 'still' ? 'cheer' : c.mode;
        const t = elapsed + c.phase;
        if (mode === 'cheer') {
          c.group.position.y = Math.abs(Math.sin(t * 4.2)) * (0.08 + hitPulse * 0.36);
          const wave = Math.sin(t * 6.5) * (0.3 + hitPulse * 0.45);
          c.lArm.rotation.z = 2.6 + wave;
          c.rArm.rotation.z = -2.6 - wave;
        } else if (mode === 'clap') {
          c.group.position.y = 0;
          const clap = Math.abs(Math.sin(t * 7)) * 0.5;
          c.lArm.rotation.set(-1.2, 0, 0.2 + clap);
          c.rArm.rotation.set(-1.2, 0, -0.2 - clap);
        } else if (mode === 'talk') {
          c.group.position.y = 0;
          c.head.rotation.y = Math.sin(t * 0.8) * 0.6;
          c.head.rotation.x = Math.max(0, Math.sin(t * 5)) * 0.12;
          c.lArm.rotation.z = 0.25 + Math.max(0, Math.sin(t * 2.3)) * 0.6;
          c.rArm.rotation.z = -0.25;
        } else {
          c.lArm.rotation.z = 0.12;
          c.rArm.rotation.z = -0.12;
          c.head.rotation.y = Math.sin(t * 0.5) * 0.4;
        }
      });
    });
  }

  private buildPelourinhoArena(maxAniso: number): void {
    const cobbleTex = createPelourinhoCobbleTexture(maxAniso);
    const cobbleNormalTex = createPelourinhoCobbleNormalTexture(maxAniso);
    this.disposables.push(cobbleTex, cobbleNormalTex);
    const slopeGeo = new THREE.PlaneGeometry(14, 24);
    const slopeMat = new THREE.MeshStandardMaterial({
      map: cobbleTex,
      normalMap: cobbleNormalTex,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughness: 0.86,
      metalness: 0.02,
    });
    this.disposables.push(slopeGeo, slopeMat);
    const ladeira = new THREE.Mesh(slopeGeo, slopeMat);
    ladeira.rotation.x = -Math.PI / 2 + 0.14;
    ladeira.position.set(0.2, 1.55, -14.5);
    ladeira.receiveShadow = true;
    this.scene.add(ladeira);

    const roofMat = new THREE.MeshStandardMaterial({ color: 0x9a401c, roughness: 0.85 });
    const spireMat = new THREE.MeshStandardMaterial({ color: 0x4b6b88, roughness: 0.55 });
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.5, metalness: 0.6 });
    this.disposables.push(roofMat, spireMat, poleMat);

    const houses = [
      { x: -7.8, y: 0, z: -5.4, w: 4.8, h: 6.4, d: 3.8, color: '#e6dcc5', trim: '#f8fafc', arch: true },
      { x: -3.5, y: 0.1, z: -7.2, w: 3.9, h: 5.9, d: 3.5, color: '#1b997b', trim: '#f8fafc', arch: false },
      { x: -1.8, y: 0.6, z: -11.2, w: 3.4, h: 6.2, d: 3.2, color: '#9c4130', trim: '#f5f0e4', arch: true },
      { x: -0.9, y: 1.3, z: -15.2, w: 3.4, h: 5.8, d: 3.2, color: '#eab308', trim: '#fef9c3', arch: false },
      { x: 0.2, y: 1.9, z: -18.8, w: 3.5, h: 5.5, d: 3.0, color: '#e5a4a4', trim: '#f8fafc', arch: false },
      { x: 4.6, y: 0, z: -7.4, w: 4.2, h: 6.6, d: 3.6, color: '#f1f5f9', trim: '#5c4028', arch: true },
      { x: 8.4, y: 0, z: -5.2, w: 4.4, h: 7.4, d: 4.0, color: '#cbd5e1', trim: '#f8fafc', arch: false },
      { x: 3.6, y: 1.2, z: -13.2, w: 3.6, h: 5.8, d: 3.2, color: '#facc15', trim: '#f8fafc', arch: false },
    ];

    houses.forEach((h) => {
      const tex = createColonialFacadeTexture(h.color, h.trim, maxAniso, h.arch);
      this.disposables.push(tex);
      const geo = new THREE.BoxGeometry(h.w, h.h, h.d);
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.78 });
      this.disposables.push(geo, mat);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(h.x, h.y + h.h / 2, h.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      const roofGeo = new THREE.ConeGeometry(Math.max(h.w, h.d) * 0.72, 1.15, 4);
      this.disposables.push(roofGeo);
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.rotation.y = Math.PI / 4;
      roof.position.set(h.x, h.y + h.h + 0.52, h.z);
      this.scene.add(roof);
    });

    const churchTex = createChurchTowerTexture(maxAniso);
    this.disposables.push(churchTex);
    const churchMat = new THREE.MeshStandardMaterial({ map: churchTex, roughness: 0.75 });
    const naveGeo = new THREE.BoxGeometry(5.6, 4.4, 2.8);
    const towerGeo = new THREE.BoxGeometry(1.55, 7.6, 1.6);
    const spireGeo = new THREE.ConeGeometry(1.1, 2.5, 4);
    this.disposables.push(churchMat, naveGeo, towerGeo, spireGeo);
    const nave = new THREE.Mesh(naveGeo, churchMat);
    nave.position.set(-0.3, 8.2, -24.5);
    this.scene.add(nave);
    [-2.0, 1.4].forEach((tx) => {
      const tower = new THREE.Mesh(towerGeo, churchMat);
      tower.position.set(tx, 9.8, -24.0);
      this.scene.add(tower);
      const spire = new THREE.Mesh(spireGeo, spireMat);
      spire.rotation.y = Math.PI / 4;
      spire.position.set(tx, 14.8, -24.0);
      this.scene.add(spire);
    });

    const bahiaTex = createBahiaSignTexture();
    const atencaoTex = createAtencaoSignTexture();
    const bannerTex = createBahiaBannerTexture();
    const hotelTex = createHotelSignTexture();
    this.disposables.push(bahiaTex, atencaoTex, bannerTex, hotelTex);

    const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.4, 8);
    const bahiaGeo = new THREE.CylinderGeometry(0.75, 0.75, 0.22, 24);
    const bahiaMat = new THREE.MeshStandardMaterial({ map: bahiaTex, roughness: 0.35 });
    this.disposables.push(poleGeo, bahiaGeo, bahiaMat);
    const bahiaPole = new THREE.Mesh(poleGeo, poleMat);
    bahiaPole.position.set(-4.1, 1.2, -4.1);
    this.scene.add(bahiaPole);
    const bahiaDisc = new THREE.Mesh(bahiaGeo, bahiaMat);
    bahiaDisc.rotation.x = Math.PI / 2;
    bahiaDisc.position.set(-4.1, 2.45, -4.05);
    this.scene.add(bahiaDisc);

    // Living elements: 1) Swaying Bahia Banners, 2) Jumping Pelô Drums, 3) Cheering Crowd
    const bannerGeo = new THREE.PlaneGeometry(0.65, 2.8);
    const bannerMat = new THREE.MeshStandardMaterial({ map: bannerTex, side: THREE.DoubleSide });
    const atencaoGeo = new THREE.PlaneGeometry(1.9, 0.95);
    const atencaoMat = new THREE.MeshBasicMaterial({ map: atencaoTex, transparent: true });
    const hotelGeo = new THREE.BoxGeometry(1.35, 0.68, 0.14);
    const hotelMat = new THREE.MeshStandardMaterial({ map: hotelTex, roughness: 0.5 });
    this.disposables.push(bannerGeo, bannerMat, atencaoGeo, atencaoMat, hotelGeo, hotelMat);

    const atencaoSign = new THREE.Mesh(atencaoGeo, atencaoMat);
    atencaoSign.position.set(-0.2, 3.65, -8.5);
    this.scene.add(atencaoSign);
    const leftBanner = new THREE.Mesh(bannerGeo, bannerMat);
    leftBanner.position.set(-6.3, 3.2, -3.45);
    this.scene.add(leftBanner);
    const rightBanner = new THREE.Mesh(bannerGeo, bannerMat);
    rightBanner.position.set(6.15, 3.4, -3.5);
    this.scene.add(rightBanner);
    const hotelSign = new THREE.Mesh(hotelGeo, hotelMat);
    hotelSign.position.set(6.5, 1.95, -3.2);
    this.scene.add(hotelSign);

    // Drums in background that vibrate on hits
    const drumGeo = new THREE.CylinderGeometry(0.32, 0.28, 0.6, 12);
    const drumMat = new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.4 });
    const drumHeadMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 });
    this.disposables.push(drumGeo, drumMat, drumHeadMat);
    const drums: THREE.Mesh[] = [];
    [-1.4, 1.6].forEach((dx) => {
      const d = new THREE.Mesh(drumGeo, drumMat);
      d.position.set(dx, 0.3, -3.6);
      this.scene.add(d);
      drums.push(d);
    });

    this.stageAnimators.push((_dt, elapsed, hitPulse) => {
      leftBanner.rotation.z = Math.sin(elapsed * 2.1) * 0.08;
      rightBanner.rotation.z = Math.cos(elapsed * 2.1) * 0.08;
      drums.forEach((d, idx) => {
        const s = 1 + Math.abs(Math.sin(elapsed * 5 + idx)) * 0.04 + hitPulse * 0.18;
        d.scale.set(s, 1, s);
      });
    });
    this.addCheeringCrowd([-3.0, -2.1, 2.3, 3.2], -4.2);
  }

  private buildFavelaSalvadorArena(maxAniso: number): void {
    const blocks = [
      { x: -6.8, y: 0, z: -5.4, w: 4.4, h: 4.5, paint: null },
      { x: -2.2, y: 0, z: -5.8, w: 4.2, h: 5.2, paint: '#38bdf8' },
      { x: 2.3, y: 0, z: -5.6, w: 4.4, h: 4.8, paint: '#f43f5e' },
      { x: 6.9, y: 0, z: -5.4, w: 4.5, h: 5.4, paint: null },
      { x: -4.5, y: 4.5, z: -9.5, w: 5.2, h: 4.8, paint: '#facc15' },
      { x: 0.8, y: 5.0, z: -9.8, w: 4.8, h: 4.6, paint: null },
      { x: 5.6, y: 4.6, z: -9.5, w: 5.0, h: 5.0, paint: '#22c55e' },
    ];
    const tankGeo = new THREE.CylinderGeometry(0.45, 0.38, 0.78, 12);
    const tankMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 });
    this.disposables.push(tankGeo, tankMat);

    blocks.forEach((b, idx) => {
      const tex = createFavelaBrickTexture(b.paint, maxAniso);
      this.disposables.push(tex);
      const geo = new THREE.BoxGeometry(b.w, b.h, 3.6);
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.88 });
      this.disposables.push(geo, mat);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(b.x, b.y + b.h / 2, b.z);
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
      if (idx % 2 === 0) {
        const tank = new THREE.Mesh(tankGeo, tankMat);
        tank.position.set(b.x + 0.6, b.y + b.h + 0.39, b.z);
        this.scene.add(tank);
      }
    });

    // Living element 1: Colorful Kites ("Pipas") flying above the hillside
    const kiteGeo = new THREE.PlaneGeometry(0.65, 0.65);
    const kiteColors = [0xfacc15, 0xef4444, 0x38bdf8];
    this.disposables.push(kiteGeo);
    const kites: Array<{ mesh: THREE.Mesh; bx: number; by: number; phase: number }> = [];
    kiteColors.forEach((col, i) => {
      const km = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide });
      this.disposables.push(km);
      const kite = new THREE.Mesh(kiteGeo, km);
      kite.rotation.z = Math.PI / 4;
      const bx = -4 + i * 4;
      const by = 6.2 + (i % 2) * 1.1;
      kite.position.set(bx, by, -8.5);
      this.scene.add(kite);
      kites.push({ mesh: kite, bx, by, phase: i * 1.4 });
    });

    // Living element 2: Clothesline swaying between houses
    const shirtGeo = new THREE.BoxGeometry(0.35, 0.45, 0.08);
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.7 });
    this.disposables.push(shirtGeo, shirtMat);
    const hangingShirts: THREE.Mesh[] = [];
    [-1.2, 0.0, 1.2].forEach((sx) => {
      const sh = new THREE.Mesh(shirtGeo, shirtMat);
      sh.position.set(sx, 3.3, -4.1);
      this.scene.add(sh);
      hangingShirts.push(sh);
    });

    this.stageAnimators.push((_dt, elapsed, hitPulse) => {
      kites.forEach((k) => {
        k.mesh.position.x = k.bx + Math.sin(elapsed * 1.4 + k.phase) * 0.9;
        k.mesh.position.y = k.by + Math.cos(elapsed * 2.1 + k.phase) * (0.45 + hitPulse * 0.3);
        k.mesh.rotation.z = Math.PI / 4 + Math.sin(elapsed * 3.1 + k.phase) * 0.25;
      });
      hangingShirts.forEach((s, idx) => {
        s.rotation.x = Math.sin(elapsed * 3.2 + idx) * (0.14 + hitPulse * 0.25);
      });
    });

    // Living element 3: Crowd cheering on the ladeira
    this.addCheeringCrowd([-3.8, -2.8, 2.8, 3.8], -3.6);
  }

  private buildCajazeiraArena(_maxAniso: number): void {
    // Huge Paredão sound-system wall at center-back
    const paredaoTex = createCajazeiraParedaoTexture();
    this.disposables.push(paredaoTex);
    const wallGeo = new THREE.BoxGeometry(6.8, 4.4, 1.4);
    const wallMat = new THREE.MeshStandardMaterial({ map: paredaoTex, roughness: 0.45, metalness: 0.25 });
    this.disposables.push(wallGeo, wallMat);
    const paredao = new THREE.Mesh(wallGeo, wallMat);
    paredao.position.set(0, 2.2, -6.2);
    paredao.castShadow = true;
    this.scene.add(paredao);

    // Side basketball hoop / street poles + graffiti block houses
    const houseGeo = new THREE.BoxGeometry(5.5, 5.2, 3.5);
    const hMat1 = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.85 });
    const hMat2 = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.85 });
    this.disposables.push(houseGeo, hMat1, hMat2);
    const leftH = new THREE.Mesh(houseGeo, hMat1);
    leftH.position.set(-7.6, 2.6, -7.2);
    this.scene.add(leftH);
    const rightH = new THREE.Mesh(houseGeo, hMat2);
    rightH.position.set(7.6, 2.6, -7.2);
    this.scene.add(rightH);

    // Living elements: 1) Pulsing Subwoofer LED Rings, 2) Sweeping Neon Beams, 3) Cheering Crowd
    const ringGeo = new THREE.TorusGeometry(0.58, 0.07, 8, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    this.disposables.push(ringGeo, ringMat);
    const woofers: THREE.Mesh[] = [];
    [
      [-1.55, 1.2],
      [1.55, 1.2],
      [-1.55, 3.0],
      [1.55, 3.0],
    ].forEach(([wx, wy]) => {
      const r = new THREE.Mesh(ringGeo, ringMat);
      r.position.set(wx, wy, -5.45);
      this.scene.add(r);
      woofers.push(r);
    });

    const beamGeo = new THREE.ConeGeometry(1.1, 8, 12, 1, true);
    const beamMatL = new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.05, side: THREE.DoubleSide });
    const beamMatR = new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.05, side: THREE.DoubleSide });
    this.disposables.push(beamGeo, beamMatL, beamMatR);
    const beamL = new THREE.Mesh(beamGeo, beamMatL);
    beamL.position.set(-3.2, 4.4, -5.6);
    const beamR = new THREE.Mesh(beamGeo, beamMatR);
    beamR.position.set(3.2, 4.4, -5.6);
    this.scene.add(beamL, beamR);

    this.stageAnimators.push((_dt, elapsed, hitPulse) => {
      const pulse = 1 + Math.abs(Math.sin(elapsed * 8.5)) * 0.14 + hitPulse * 0.35;
      woofers.forEach((w) => w.scale.set(pulse, pulse, 1));
      beamL.rotation.z = Math.sin(elapsed * 2.2) * 0.45;
      beamR.rotation.z = -Math.sin(elapsed * 2.2) * 0.45;
    });
    this.addCheeringCrowd([-4.8, -3.9, 3.9, 4.8], -4.2);
  }

  private buildGamboaArena(maxAniso: number): void {
    const seaTex = createWaterWaveTexture(maxAniso, '#0284c7');
    const seaNorm = createWaterNormalTexture(maxAniso);
    this.disposables.push(seaTex, seaNorm);
    const seaGeo = new THREE.PlaneGeometry(90, 38);
    const seaMat = new THREE.MeshStandardMaterial({
      map: seaTex,
      normalMap: seaNorm,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughness: 0.55,
      metalness: 0.08,
    });
    this.disposables.push(seaGeo, seaMat);
    const sea = new THREE.Mesh(seaGeo, seaMat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, -0.35, -18);
    this.scene.add(sea);

    // Pier bollards
    const postGeo = new THREE.CylinderGeometry(0.14, 0.16, 0.85, 10);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.85 });
    this.disposables.push(postGeo, postMat);
    [-6.0, -3.0, 0, 3.0, 6.0].forEach((px) => {
      const p = new THREE.Mesh(postGeo, postMat);
      p.position.set(px, 0.42, -3.8);
      p.castShadow = true;
      this.scene.add(p);
    });

    // Living elements: 1) Water wave scroll, 2) Rocking Sailboats, 3) Gliding Seagulls
    const hullGeo = new THREE.BoxGeometry(2.4, 0.6, 1.0);
    const sailGeo = new THREE.ConeGeometry(0.95, 2.4, 3);
    const hullMat1 = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.6 });
    const hullMat2 = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6 });
    const sailMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
    this.disposables.push(hullGeo, sailGeo, hullMat1, hullMat2, sailMat);

    const boats: Array<{ g: THREE.Group; bx: number; phase: number }> = [];
    [
      { x: -4.2, z: -8.5, m: hullMat1 },
      { x: 4.5, z: -10.5, m: hullMat2 },
    ].forEach((b, i) => {
      const g = new THREE.Group();
      const hull = new THREE.Mesh(hullGeo, b.m);
      const sail = new THREE.Mesh(sailGeo, sailMat);
      sail.position.y = 1.45;
      g.add(hull, sail);
      g.position.set(b.x, -0.1, b.z);
      this.scene.add(g);
      boats.push({ g, bx: b.x, phase: i * 1.7 });
    });

    const gullGeo = new THREE.BoxGeometry(0.45, 0.05, 0.14);
    const gullMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.disposables.push(gullGeo, gullMat);
    const gulls = [-2, 1, 3].map((gx) => {
      const m = new THREE.Mesh(gullGeo, gullMat);
      m.position.set(gx, 4.8, -11);
      this.scene.add(m);
      return m;
    });

    this.stageAnimators.push((dt, elapsed, hitPulse) => {
      seaTex.offset.x += dt * 0.08;
      seaTex.offset.y += dt * 0.03;
      boats.forEach((b) => {
        b.g.rotation.z = Math.sin(elapsed * 1.8 + b.phase) * (0.09 + hitPulse * 0.12);
        b.g.position.y = -0.1 + Math.cos(elapsed * 2.1 + b.phase) * 0.14;
      });
      gulls.forEach((g, idx) => {
        g.position.x = Math.sin(elapsed * 0.55 + idx * 2) * 8;
        g.position.y = 4.8 + Math.sin(elapsed * 3.5 + idx) * 0.35;
      });
    });
  }

  private buildPitubaArena(maxAniso: number): void {
    this.addCheeringCrowd([-5.0, -4.1, -3.2, 3.2, 4.1, 5.0], -3.9, ['pedestre', 'seguranca', 'bone', 'pedestre', 'tricolor', 'rubronegro']);
    const seaTex = createWaterWaveTexture(maxAniso, '#0ea5e9');
    const seaNorm = createWaterNormalTexture(maxAniso);
    this.disposables.push(seaTex, seaNorm);
    const seaGeo = new THREE.PlaneGeometry(80, 26);
    const seaMat = new THREE.MeshStandardMaterial({
      map: seaTex,
      normalMap: seaNorm,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughness: 0.55,
      metalness: 0.08,
    });
    this.disposables.push(seaGeo, seaMat);
    const sea = new THREE.Mesh(seaGeo, seaMat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, -0.25, -18);
    this.scene.add(sea);

    // Coastal apartment skyline
    const bMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.7 });
    const bGeo = new THREE.BoxGeometry(3.4, 8.5, 3.0);
    this.disposables.push(bMat, bGeo);
    [-11, -6.5, 6.5, 11].forEach((bx, i) => {
      const b = new THREE.Mesh(bGeo, bMat);
      b.position.set(bx, 4.0 + (i % 2) * 1.5, -13);
      this.scene.add(b);
    });

    const fronds = this.addPalmTrees([-7.5, -3.5, 3.5, 7.5], -4.8, maxAniso);

    // Living element: Passing Pituba car & cyclist in background lane!
    const carGeo = new THREE.BoxGeometry(2.2, 0.75, 1.0);
    const carMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35, metalness: 0.4 });
    const bikeGeo = new THREE.BoxGeometry(0.95, 0.65, 0.28);
    const bikeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
    this.disposables.push(carGeo, carMat, bikeGeo, bikeMat);
    const car = new THREE.Mesh(carGeo, carMat);
    car.position.set(-14, 0.42, -5.9);
    const bike = new THREE.Mesh(bikeGeo, bikeMat);
    bike.position.set(12, 0.38, -4.1);
    this.scene.add(car, bike);

    this.stageAnimators.push((dt, elapsed, hitPulse) => {
      seaTex.offset.x += dt * 0.06;
      car.position.x += dt * 5.6;
      if (car.position.x > 16) car.position.x = -16;
      bike.position.x -= dt * 3.4;
      if (bike.position.x < -15) bike.position.x = 15;
      fronds.forEach((f, idx) => {
        f.rotation.y = Math.sin(elapsed * 2.0 + idx) * (0.1 + hitPulse * 0.18);
      });
    });
  }

  private buildElevadorLacerdaArena(maxAniso: number): void {
    const seaNorm = createWaterNormalTexture(maxAniso);
    this.disposables.push(seaNorm);
    const seaGeo = new THREE.PlaneGeometry(80, 32);
    const seaMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      normalMap: seaNorm,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughness: 0.55,
      metalness: 0.08,
    });
    this.disposables.push(seaGeo, seaMat);
    const sea = new THREE.Mesh(seaGeo, seaMat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, -0.45, -20);
    this.scene.add(sea);

    const railMat = new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.7 });
    const wallGeo = new THREE.BoxGeometry(24, 0.9, 0.45);
    this.disposables.push(railMat, wallGeo);
    const bal = new THREE.Mesh(wallGeo, railMat);
    bal.position.set(0, 0.45, -4.6);
    bal.receiveShadow = true;
    this.scene.add(bal);

    const towerMat = new THREE.MeshStandardMaterial({ color: 0xe6dcc8, roughness: 0.72 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.15, metalness: 0.75 });
    const towerGeo = new THREE.BoxGeometry(3.2, 12.5, 2.8);
    const bridgeGeo = new THREE.BoxGeometry(6.8, 1.4, 2.0);
    const shaftGeo = new THREE.BoxGeometry(0.95, 11.2, 0.12);
    const cabinGeo = new THREE.BoxGeometry(0.86, 1.15, 0.35);
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xf59e0b, emissiveIntensity: 0.12 });
    this.disposables.push(towerMat, glassMat, towerGeo, bridgeGeo, shaftGeo, cabinGeo, cabinMat);

    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.position.set(0, 5.2, -9.8);
    tower.castShadow = true;
    this.scene.add(tower);
    const bridge = new THREE.Mesh(bridgeGeo, towerMat);
    bridge.position.set(-4.5, 9.6, -9.8);
    this.scene.add(bridge);
    const glassShaft = new THREE.Mesh(shaftGeo, glassMat);
    glassShaft.position.set(0, 5.6, -8.35);
    this.scene.add(glassShaft);

    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, 4.5, -8.15);
    this.scene.add(cabin);

    const fronds = this.addPalmTrees([-7.2, 7.2], -5.2, maxAniso);

    const boatGeo = new THREE.BoxGeometry(1.6, 0.35, 0.65);
    const boatMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc });
    this.disposables.push(boatGeo, boatMat);
    const ferry = new THREE.Mesh(boatGeo, boatMat);
    ferry.position.set(-10, -0.25, -15);
    this.scene.add(ferry);

    this.stageAnimators.push((dt, elapsed, hitPulse) => {
      cabin.position.y = 5.4 + Math.sin(elapsed * 0.7) * 3.8;
      ferry.position.x += dt * 1.8;
      if (ferry.position.x > 14) ferry.position.x = -14;
      fronds.forEach((f, idx) => {
        f.rotation.y = Math.sin(elapsed * 2.0 + idx) * (0.09 + hitPulse * 0.16);
      });
    });
  }

  private buildFarolBarraArena(maxAniso: number): void {
    this.addCheeringCrowd([-5.2, -4.3, -3.4, 3.4, 4.3, 5.2], -3.9, ['ambulante', 'tricolor', 'semcamisa', 'rubronegro', 'bone', 'tricolor']);
    const seaTex = createWaterWaveTexture(maxAniso, '#0e7490');
    const seaNorm = createWaterNormalTexture(maxAniso);
    this.disposables.push(seaTex, seaNorm);
    const seaGeo = new THREE.PlaneGeometry(90, 34);
    const seaMat = new THREE.MeshStandardMaterial({
      map: seaTex,
      normalMap: seaNorm,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughness: 0.55,
      metalness: 0.08,
    });
    this.disposables.push(seaGeo, seaMat);
    const sea = new THREE.Mesh(seaGeo, seaMat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, -0.3, -21);
    this.scene.add(sea);

    const grassGeo = new THREE.PlaneGeometry(36, 8);
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.92 });
    this.disposables.push(grassGeo, grassMat);
    const grass = new THREE.Mesh(grassGeo, grassMat);
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(0, 0.02, -5.5);
    this.scene.add(grass);

    const stripeTex = createLighthouseStripesTexture(maxAniso);
    this.disposables.push(stripeTex);
    const fortGeo = new THREE.BoxGeometry(6.8, 2.2, 4.2);
    const fortMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.85 });
    const cylGeo = new THREE.CylinderGeometry(0.65, 1.05, 8.8, 20);
    const cylMat = new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.6 });
    const lanternGeo = new THREE.CylinderGeometry(0.75, 0.75, 1.1, 14);
    const lanternMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xf59e0b, emissiveIntensity: 0.25 });
    const sweepGeo = new THREE.ConeGeometry(2.2, 11, 14, 1, true);
    const sweepMat = new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.06, side: THREE.DoubleSide });
    this.disposables.push(fortGeo, fortMat, cylGeo, cylMat, lanternGeo, lanternMat, sweepGeo, sweepMat);

    const fort = new THREE.Mesh(fortGeo, fortMat);
    fort.position.set(0, 1.1, -10.5);
    this.scene.add(fort);
    const lighthouse = new THREE.Mesh(cylGeo, cylMat);
    lighthouse.position.set(0, 6.4, -10.5);
    lighthouse.castShadow = true;
    this.scene.add(lighthouse);

    this.lighthouseBeacon = new THREE.Mesh(lanternGeo, lanternMat);
    this.lighthouseBeacon.position.set(0, 11.2, -10.5);
    const beamSweep = new THREE.Mesh(sweepGeo, sweepMat);
    beamSweep.rotation.z = Math.PI / 2;
    beamSweep.position.set(5.6, 0, 0);
    this.lighthouseBeacon.add(beamSweep);
    this.scene.add(this.lighthouseBeacon);

    const fronds = this.addPalmTrees([-6.5, 6.5], -4.5, maxAniso);

    this.stageAnimators.push((dt, elapsed, hitPulse) => {
      seaTex.offset.x += dt * 0.07;
      fronds.forEach((f, idx) => {
        f.rotation.y = Math.sin(elapsed * 2.2 + idx) * (0.11 + hitPulse * 0.18);
      });
    });
  }

  private buildOrlaArena(maxAniso: number): void {
    const sandGeo = new THREE.PlaneGeometry(60, 14);
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.94 });
    const seaTex = createWaterWaveTexture(maxAniso, '#06b6d4');
    const seaNorm = createWaterNormalTexture(maxAniso);
    const seaGeo = new THREE.PlaneGeometry(90, 32);
    const seaMat = new THREE.MeshStandardMaterial({
      map: seaTex,
      normalMap: seaNorm,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughness: 0.55,
      metalness: 0.08,
    });
    const foamGeo = new THREE.PlaneGeometry(60, 1.4);
    const foamMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.72 });
    this.disposables.push(sandGeo, sandMat, seaTex, seaNorm, seaGeo, seaMat, foamGeo, foamMat);

    const sand = new THREE.Mesh(sandGeo, sandMat);
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.02, -9.5);
    this.scene.add(sand);
    const sea = new THREE.Mesh(seaGeo, seaMat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, -0.15, -24);
    this.scene.add(sea);
    const foam = new THREE.Mesh(foamGeo, foamMat);
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(0, 0.05, -13);
    this.scene.add(foam);

    // Colorful beach umbrellas
    const umbGeo = new THREE.ConeGeometry(1.3, 0.55, 8);
    const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.0, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc });
    this.disposables.push(umbGeo, poleGeo, poleMat);
    const umbs: THREE.Mesh[] = [];
    [
      { x: -5.5, col: 0xef4444 },
      { x: 0, col: 0x22c55e },
      { x: 5.5, col: 0xf97316 },
    ].forEach((u) => {
      const um = new THREE.MeshStandardMaterial({ color: u.col, roughness: 0.65 });
      this.disposables.push(um);
      const p = new THREE.Mesh(poleGeo, poleMat);
      p.position.set(u.x, 1.0, -5.2);
      const top = new THREE.Mesh(umbGeo, um);
      top.position.set(u.x, 2.05, -5.2);
      this.scene.add(p, top);
      umbs.push(top);
    });
    const fronds = this.addPalmTrees([-8.5, 8.5], -6.5, maxAniso);

    this.stageAnimators.push((dt, elapsed, hitPulse) => {
      seaTex.offset.y += dt * 0.14;
      foam.position.z = -13 + Math.sin(elapsed * 1.9) * 1.1;
      umbs.forEach((u, idx) => {
        u.rotation.z = Math.sin(elapsed * 2.4 + idx) * (0.05 + hitPulse * 0.14);
      });
      fronds.forEach((f, idx) => {
        f.rotation.y = Math.sin(elapsed * 2.0 + idx) * 0.1;
      });
    });
  }

  private buildRioVermelhoArena(_maxAniso: number): void {
    // Illuminated Night Square + Baiana Acarajé Neon Stand
    const neonTex = createRioVermelhoNeonTexture();
    this.disposables.push(neonTex);
    const stallGeo = new THREE.BoxGeometry(4.4, 2.5, 2.2);
    const stallMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.55 });
    const signGeo = new THREE.PlaneGeometry(4.2, 1.45);
    const signMat = new THREE.MeshBasicMaterial({ map: neonTex });
    const potGeo = new THREE.CylinderGeometry(0.45, 0.35, 0.45, 14);
    const potMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.15 });
    this.disposables.push(stallGeo, stallMat, signGeo, signMat, potGeo, potMat);

    const stall = new THREE.Mesh(stallGeo, stallMat);
    stall.position.set(0, 1.25, -6.2);
    this.scene.add(stall);
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(0, 3.35, -5.2);
    this.scene.add(sign);
    const pot = new THREE.Mesh(potGeo, potMat);
    pot.position.set(1.1, 1.4, -4.9);
    this.scene.add(pot);

    // Night bars & colorful lanterns
    const barGeo = new THREE.BoxGeometry(5.5, 5.5, 3.8);
    const barMat1 = new THREE.MeshStandardMaterial({ color: 0x312e81, roughness: 0.7 });
    const barMat2 = new THREE.MeshStandardMaterial({ color: 0x4c1d95, roughness: 0.7 });
    this.disposables.push(barGeo, barMat1, barMat2);
    const bL = new THREE.Mesh(barGeo, barMat1);
    bL.position.set(-7.5, 2.75, -7.8);
    const bR = new THREE.Mesh(barGeo, barMat2);
    bR.position.set(7.5, 2.75, -7.8);
    this.scene.add(bL, bR);

    // Living elements: 1) Pulsing Neon Sign, 2) Rising Pepper Sparks from Acarajé, 3) Dancing Night Crowd
    const sparkGeo = new THREE.SphereGeometry(0.06, 6, 6);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    this.disposables.push(sparkGeo, sparkMat);
    const sparks = Array.from({ length: 6 }, (_, i) => {
      const m = new THREE.Mesh(sparkGeo, sparkMat);
      m.position.set(1.1 + (i % 3 - 1) * 0.14, 1.6 + i * 0.2, -4.9);
      this.scene.add(m);
      return m;
    });

    this.stageAnimators.push((dt, elapsed, hitPulse) => {
      sign.scale.setScalar(1 + Math.sin(elapsed * 7) * 0.02 + hitPulse * 0.06);
      sparks.forEach((s, idx) => {
        s.position.y += dt * (1.2 + idx * 0.15 + hitPulse * 1.5);
        if (s.position.y > 3.6) s.position.y = 1.6;
      });
    });
    this.addCheeringCrowd([-4.5, -3.5, 3.5, 4.5], -4.2);
  }

  private buildDiqueTororoArena(maxAniso: number): void {
    const lakeTex = createWaterWaveTexture(maxAniso, '#1e3a8a');
    const lakeNorm = createWaterNormalTexture(maxAniso);
    this.disposables.push(lakeTex, lakeNorm);
    const lakeGeo = new THREE.PlaneGeometry(80, 32);
    const lakeMat = new THREE.MeshStandardMaterial({
      map: lakeTex,
      normalMap: lakeNorm,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughness: 0.55,
      metalness: 0.1,
    });
    this.disposables.push(lakeGeo, lakeMat);
    const lake = new THREE.Mesh(lakeGeo, lakeMat);
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(0, -0.35, -18);
    this.scene.add(lake);

    // Distant Fonte Nova Arena ring
    const stadiumGeo = new THREE.CylinderGeometry(7.2, 6.6, 2.2, 24, 1, true);
    const stadiumMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, emissive: 0x38bdf8, emissiveIntensity: 0.1, side: THREE.DoubleSide });
    this.disposables.push(stadiumGeo, stadiumMat);
    const stadium = new THREE.Mesh(stadiumGeo, stadiumMat);
    stadium.position.set(0, 1.1, -24);
    this.scene.add(stadium);

    // Living elements: 1) Glowing Orixás Statues on lake, 2) Central Water Fountain Jet, 3) Lake ripple
    const pedGeo = new THREE.CylinderGeometry(0.45, 0.55, 0.6, 10);
    const pedMat = new THREE.MeshStandardMaterial({ color: 0xe7e5e4 });
    const figGeo = new THREE.CapsuleGeometry(0.32, 1.35, 6, 10);
    this.disposables.push(pedGeo, pedMat, figGeo);
    const orixas: THREE.Group[] = [];
    [
      { x: -5.2, col: 0xfacc15 },
      { x: 0, col: 0x38bdf8 },
      { x: 5.2, col: 0xef4444 },
    ].forEach((o) => {
      const g = new THREE.Group();
      const om = new THREE.MeshStandardMaterial({ color: o.col, emissive: o.col, emissiveIntensity: 0.15 });
      this.disposables.push(om);
      const ped = new THREE.Mesh(pedGeo, pedMat);
      const fig = new THREE.Mesh(figGeo, om);
      fig.position.y = 1.25;
      g.add(ped, fig);
      g.position.set(o.x, -0.1, -9.8);
      this.scene.add(g);
      orixas.push(g);
    });

    const jetGeo = new THREE.ConeGeometry(0.45, 2.8, 10);
    const jetMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.7 });
    this.disposables.push(jetGeo, jetMat);
    const jet = new THREE.Mesh(jetGeo, jetMat);
    jet.position.set(0, 1.1, -13.5);
    this.scene.add(jet);

    this.stageAnimators.push((dt, elapsed, hitPulse) => {
      lakeTex.offset.x += dt * 0.04;
      orixas.forEach((o, idx) => {
        o.position.y = -0.1 + Math.sin(elapsed * 2.0 + idx) * 0.08;
      });
      const js = 1 + Math.sin(elapsed * 6.5) * 0.18 + hitPulse * 0.4;
      jet.scale.set(1, js, 1);
    });
  }

  private buildJesseMotorcycleProp(): void {
    const moto = new THREE.Group();
    moto.position.set(4.95, 0, -2.75);
    moto.rotation.y = -0.78;
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.78 });
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.35, metalness: 0.3 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, roughness: 0.25, metalness: 0.85 });
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.45 });
    const wheelGeo = new THREE.TorusGeometry(0.28, 0.07, 8, 18);
    const frameGeo = new THREE.BoxGeometry(0.95, 0.3, 0.24);
    const fairingGeo = new THREE.BoxGeometry(0.42, 0.28, 0.3);
    const seatGeo = new THREE.BoxGeometry(0.54, 0.12, 0.22);
    const rearBoxGeo = new THREE.BoxGeometry(0.38, 0.32, 0.36);
    const forkGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.78, 8);
    this.disposables.push(tireMat, blueMat, chromeMat, boxMat, wheelGeo, frameGeo, fairingGeo, seatGeo, rearBoxGeo, forkGeo);

    [-0.58, 0.58].forEach((wx) => {
      const wheel = new THREE.Mesh(wheelGeo, tireMat);
      wheel.position.set(wx, 0.34, 0);
      wheel.castShadow = true;
      moto.add(wheel);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 10), chromeMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.set(wx, 0.34, 0);
      this.disposables.push(rim.geometry);
      moto.add(rim);
    });
    const frame = new THREE.Mesh(frameGeo, tireMat);
    frame.position.set(0, 0.56, 0);
    moto.add(frame);
    const fairing = new THREE.Mesh(fairingGeo, blueMat);
    fairing.position.set(0.32, 0.78, 0);
    fairing.rotation.z = -0.3;
    moto.add(fairing);
    const seat = new THREE.Mesh(seatGeo, tireMat);
    seat.position.set(-0.14, 0.76, 0);
    moto.add(seat);
    const rearBox = new THREE.Mesh(rearBoxGeo, boxMat);
    rearBox.position.set(-0.56, 0.96, 0);
    moto.add(rearBox);
    const fork = new THREE.Mesh(forkGeo, chromeMat);
    fork.position.set(0.45, 0.68, 0);
    fork.rotation.z = 0.35;
    moto.add(fork);
    this.scene.add(moto);
  }

  private addPalmTrees(xs: number[], z: number, _maxAniso: number): THREE.Group[] {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78553a, roughness: 0.92 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.75 });
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.2, 4.4, 8);
    const frondGeo = new THREE.ConeGeometry(0.45, 2.1, 4);
    this.disposables.push(trunkMat, leafMat, trunkGeo, frondGeo);

    const crowns: THREE.Group[] = [];
    xs.forEach((x) => {
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(x, 2.2, z);
      trunk.rotation.z = x < 0 ? 0.08 : -0.08;
      this.scene.add(trunk);

      const crown = new THREE.Group();
      crown.position.set(x, 4.3, z);
      for (let a = 0; a < 5; a++) {
        const frond = new THREE.Mesh(frondGeo, leafMat);
        const ang = (a / 5) * Math.PI * 2;
        frond.position.set(Math.cos(ang) * 0.65, 0, Math.sin(ang) * 0.65);
        frond.rotation.z = -Math.cos(ang) * 1.1;
        frond.rotation.x = Math.sin(ang) * 1.1;
        crown.add(frond);
      }
      this.scene.add(crown);
      crowns.push(crown);
    });
    return crowns;
  }

  private buildMascotCat(): void {
    this.catGroup = new THREE.Group();
    this.catGroup.position.set(-4.2, 0.22, -2.9);
    this.catGroup.rotation.y = 0.45;
    const catMat = new THREE.MeshStandardMaterial({
      color: 0x18181d,
      roughness: 0.82,
    });
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.3,
      roughness: 0.35,
    });
    this.disposables.push(catMat, eyeMat);

    // Sculpted sleek feline torso
    const bodyGeo = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.065, -0.18),
        new THREE.Vector2(0.098, -0.05),
        new THREE.Vector2(0.088, 0.08),
        new THREE.Vector2(0.102, 0.18),
        new THREE.Vector2(0.06, 0.23),
      ],
      14,
    );
    const headGeo = new THREE.SphereGeometry(0.105, 14, 12);
    const muzzleGeo = new THREE.SphereGeometry(0.044, 10, 8);
    const earGeo = new THREE.ConeGeometry(0.042, 0.095, 6);
    const legGeo = new THREE.CylinderGeometry(0.028, 0.022, 0.18, 8);
    const tailGeo = new THREE.CylinderGeometry(0.02, 0.014, 0.36, 8);
    const eyeGeo = new THREE.SphereGeometry(0.02, 8, 8);
    this.disposables.push(bodyGeo, headGeo, muzzleGeo, earGeo, legGeo, tailGeo, eyeGeo);

    const body = new THREE.Mesh(bodyGeo, catMat);
    body.rotation.x = Math.PI / 2;
    body.position.y = 0.16;
    body.castShadow = true;
    this.catGroup.add(body);

    [
      [-0.055, 0.08, 0.12],
      [0.055, 0.08, 0.12],
      [-0.055, 0.08, -0.12],
      [0.055, 0.08, -0.12],
    ].forEach(([lx, ly, lz]) => {
      const leg = new THREE.Mesh(legGeo, catMat);
      leg.position.set(lx, ly, lz);
      this.catGroup.add(leg);
    });

    const head = new THREE.Mesh(headGeo, catMat);
    head.position.set(0, 0.29, 0.2);
    head.castShadow = true;
    this.catGroup.add(head);

    const muzzle = new THREE.Mesh(muzzleGeo, catMat);
    muzzle.scale.set(1.1, 0.78, 1.0);
    muzzle.position.set(0, 0.265, 0.285);
    this.catGroup.add(muzzle);

    [-0.064, 0.064].forEach((ex, i) => {
      const ear = new THREE.Mesh(earGeo, catMat);
      ear.position.set(ex, 0.39, 0.19);
      ear.rotation.z = i === 0 ? 0.18 : -0.18;
      this.catGroup.add(ear);
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(ex * 0.7, 0.305, 0.292);
      this.catGroup.add(eye);
    });

    this.catTail = new THREE.Mesh(tailGeo, catMat);
    this.catTail.position.set(0, 0.28, -0.25);
    this.catTail.rotation.x = -0.6;
    this.catGroup.add(this.catTail);
    this.scene.add(this.catGroup);
  }

  private setupBlackCatSwarmPool(): void {
    const blackMat = new THREE.MeshStandardMaterial({
      color: 0x101015,
      roughness: 0.82,
    });
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.3,
      roughness: 0.35,
    });
    const bodyGeo = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.068, -0.2),
        new THREE.Vector2(0.102, -0.04),
        new THREE.Vector2(0.088, 0.09),
        new THREE.Vector2(0.106, 0.2),
        new THREE.Vector2(0.06, 0.24),
      ],
      14,
    );
    const headGeo = new THREE.SphereGeometry(0.105, 14, 12);
    const legGeo = new THREE.CylinderGeometry(0.025, 0.018, 0.19, 8);
    const earGeo = new THREE.ConeGeometry(0.04, 0.095, 6);
    const eyeGeo = new THREE.SphereGeometry(0.021, 8, 8);
    const tailGeo = new THREE.CylinderGeometry(0.02, 0.014, 0.34, 8);
    this.disposables.push(blackMat, eyeMat, bodyGeo, headGeo, legGeo, earGeo, eyeGeo, tailGeo);

    for (let i = 0; i < 7; i++) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(bodyGeo, blackMat);
      body.rotation.z = -Math.PI / 2;
      body.position.y = 0.18;
      body.castShadow = true;
      group.add(body);

      [
        [0.12, 0.09, -0.055],
        [0.12, 0.09, 0.055],
        [-0.12, 0.09, -0.055],
        [-0.12, 0.09, 0.055],
      ].forEach(([lx, ly, lz]) => {
        const leg = new THREE.Mesh(legGeo, blackMat);
        leg.position.set(lx, ly, lz);
        group.add(leg);
      });

      const head = new THREE.Mesh(headGeo, blackMat);
      head.position.set(0.22, 0.27, 0);
      group.add(head);
      [-0.058, 0.058].forEach((ez, ei) => {
        const ear = new THREE.Mesh(earGeo, blackMat);
        ear.position.set(0.21, 0.37, ez);
        ear.rotation.x = ei === 0 ? -0.18 : 0.18;
        group.add(ear);
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.position.set(0.312, 0.285, ez * 0.72);
        group.add(eye);
      });
      const tail = new THREE.Mesh(tailGeo, blackMat);
      tail.position.set(-0.24, 0.3, 0);
      tail.rotation.z = 0.75;
      group.add(tail);
      group.visible = false;
      this.scene.add(group);
      this.swarmCats.push({
        group,
        tail,
        active: false,
        life: 0,
        delay: 0,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        phaseOffset: i * 0.7,
      });
    }
  }

  private launchBlackCatSwarm(caster: FighterRuntime): void {
    gameAudio.playCatSwarm();
    this.superFlashTimer = 0.28;
    for (let i = 0; i < this.swarmCats.length; i++) {
      const cat = this.swarmCats[i];
      cat.active = true;
      cat.delay = i * 0.075;
      cat.life = 0.85;
      cat.x = caster.x - caster.facing * (0.4 + (i % 3) * 0.45);
      cat.y = 0;
      cat.z = (i - 3) * 0.24;
      cat.vx = caster.facing * (7.2 + (i % 3) * 1.1);
      cat.group.rotation.y = caster.facing === 1 ? 0 : Math.PI;
      cat.group.visible = false;
    }
  }

  private setupFighters(): void {
    const shadowTex = createContactShadowTexture();
    this.disposables.push(shadowTex);
    const shadowGeo = new THREE.PlaneGeometry(1.45, 1.45);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.72,
    });
    this.disposables.push(shadowGeo, shadowMat);

    const createRuntime = (
      slot: 'p1' | 'p2',
      fighterId: FighterId,
      skinId: string,
      powerId: PowerId,
      startX: number,
      facing: 1 | -1,
    ): FighterRuntime => {
      const rig = buildFighterRig(fighterId, skinId, this.cfg.authorizationMode);
      rig.root.position.set(startX, 0, 0);
      rig.root.rotation.y = facing === 1 ? Math.PI / 2 : -Math.PI / 2;
      this.scene.add(rig.root);

      const shadow = new THREE.Mesh(shadowGeo, shadowMat);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(startX, 0.02, 0);
      this.scene.add(shadow);

      const maxHp = FIGHTERS[fighterId].balance.hp;

      return {
        slot,
        fighterId,
        skinId,
        powerId,
        rig,
        shadow,
        x: startX,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        facing,
        hp: maxHp,
        maxHp,
        energy: this.cfg.mode === 'training' ? 80 : 30,
        stun: 0,
        state: this.cfg.mode === 'training' ? 'idle' : 'intro',
        stateTime: 0,
        stateDuration: 0.9,
        hasHitCurrentMove: false,
        multiHitCount: 0,
        comboCount: 0,
        comboResetTimer: 0,
        maxComboAchieved: 0,
        damageDealt: 0,
        roundsWon: 0,
        perfectParries: 0,
        finisherUsed: false,
        buff: null,
        buffTimer: 0,
        slapRedness: 0,
        counterWindowTimer: 0,
        dodgedThisMove: false,
        dodgeZOffset: 0,
        grabWindowTimer: 0,
        grabClinched: false,
        grabHitApplied: false,
        parryWindowTimer: 0,
        regenIdleTimer: 0,
        bufferedMove: null,
        bufferTimer: 0,
        runHold: 0,
        prevInput: createEmptyInput(),
        aiThinkTimer: 0,
        aiDesiredMove: createEmptyInput(),
      };
    };

    this.p1 = createRuntime('p1', this.cfg.p1FighterId, this.cfg.p1SkinId, this.cfg.p1PowerId, -2.2, 1);
    this.p2 = createRuntime('p2', this.cfg.p2FighterId, this.cfg.p2SkinId, this.cfg.p2PowerId, 2.2, -1);
  }

  private setupVfxPool(): void {
    const pGeo = new THREE.SphereGeometry(0.085, 6, 6);
    this.disposables.push(pGeo);
    for (let i = 0; i < 36; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 1 });
      this.disposables.push(mat);
      const mesh = new THREE.Mesh(pGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.particles.push({ mesh, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 0.35 });
    }

    const ringGeo = new THREE.RingGeometry(0.18, 0.34, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    this.disposables.push(ringGeo, ringMat);
    this.shockwaveRing = new THREE.Mesh(ringGeo, ringMat);
    this.shockwaveRing.visible = false;
    this.scene.add(this.shockwaveRing);
  }

  private spawnImpactVfx(x: number, y: number, z: number, colorHex: number, count = 10): void {
    if (!this.cfg.showHitEffects) return;

    this.shockwaveRing.position.set(x, y, z + 0.15);
    this.shockwaveRing.scale.set(0.5, 0.5, 0.5);
    (this.shockwaveRing.material as THREE.MeshBasicMaterial).color.setHex(colorHex);
    (this.shockwaveRing.material as THREE.MeshBasicMaterial).opacity = 0.92;
    this.shockwaveRing.visible = true;
    this.shockwaveLife = 0.24;

    let spawned = 0;
    for (let i = 0; i < this.particles.length && spawned < count; i++) {
      const pt = this.particles[i];
      if (pt.life <= 0) {
        pt.mesh.position.set(x, y, z);
        pt.mesh.visible = true;
        (pt.mesh.material as THREE.MeshBasicMaterial).color.setHex(colorHex);
        (pt.mesh.material as THREE.MeshBasicMaterial).opacity = 1;
        const angle = Math.random() * Math.PI * 2;
        const speed = 2.6 + Math.random() * 4.5;
        pt.vx = Math.cos(angle) * speed;
        pt.vy = Math.sin(angle) * speed * 0.85 + 1.6;
        pt.vz = (Math.random() - 0.5) * 3.0;
        pt.maxLife = 0.22 + Math.random() * 0.18;
        pt.life = pt.maxLife;
        spawned++;
      }
    }
  }

  private addDamagePopup(worldX: number, worldY: number, amount: number, kind: DamagePopup['kind']): void {
    const pt = this.projectToPercent(worldX, worldY, 0.2);
    this.damagePopups.push({
      id: this.popupNextId++,
      x: pt.x + (Math.random() - 0.5) * 4,
      y: pt.y,
      amount,
      kind,
      life: 0.72,
    });
    if (this.damagePopups.length > 8) this.damagePopups.shift();
  }

  private projectToPercent(wx: number, wy: number, wz: number): { x: number; y: number } {
    _projVec.set(wx, wy, wz).project(this.camera);
    return {
      x: THREE.MathUtils.clamp((_projVec.x * 0.5 + 0.5) * 100, 4, 96),
      y: THREE.MathUtils.clamp((-_projVec.y * 0.5 + 0.5) * 100, 8, 88),
    };
  }

  public setPlayerInput(slot: 'p1' | 'p2', input: FighterInputState): void {
    if (slot === 'p1') this.p1Input = { ...input };
    else this.p2Input = { ...input };
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
    this.emitHud();
  }

  public restartMatch(): void {
    this.roundNumber = 1;
    this.p1.roundsWon = 0;
    this.p2.roundsWon = 0;
    this.p1.damageDealt = 0;
    this.p2.damageDealt = 0;
    this.p1.maxComboAchieved = 0;
    this.p2.maxComboAchieved = 0;
    this.p1.perfectParries = 0;
    this.p1.finisherUsed = false;
    this.perfectRoundsP1 = 0;
    this.matchElapsed = 0;
    this.isPaused = false;
    this.damagePopups = [];
    this.resetRound();
  }

  private resetRound(): void {
    this.roundTimer = this.cfg.roundDurationSec;
    this.roundPhase = this.cfg.mode === 'training' ? 'fight' : 'intro';
    this.phaseTimer = 1.35;
    this.finisherCamTimer = 0;
    this.bannerText = this.cfg.mode === 'training' ? null : `ROUND ${this.roundNumber}`;
    this.calloutText = null;

    const resetFighter = (f: FighterRuntime, x: number, facing: 1 | -1) => {
      f.x = x;
      f.y = 0;
      f.z = 0;
      f.vx = 0;
      f.vy = 0;
      f.facing = facing;
      f.hp = f.maxHp;
      f.stun = 0;
      f.energy = Math.max(this.cfg.mode === 'training' ? 80 : 30, f.energy);
      f.state = this.cfg.mode === 'training' ? 'idle' : 'intro';
      f.stateTime = 0;
      f.stateDuration = 0.9;
      f.comboCount = 0;
      f.comboResetTimer = 0;
      f.buff = null;
      f.buffTimer = 0;
      f.slapRedness = 0;
      f.counterWindowTimer = 0;
      f.dodgedThisMove = false;
      f.hasHitCurrentMove = false;
      f.multiHitCount = 0;
      f.grabClinched = false;
      f.grabHitApplied = false;
      f.bufferedMove = null;
      f.bufferTimer = 0;
      f.rig.setRedness(0);
      f.dodgeZOffset = 0;
      f.rig.root.position.set(x, 0, 0);
      f.rig.root.rotation.y = facing === 1 ? Math.PI / 2 : -Math.PI / 2;
    };

    resetFighter(this.p1, -2.2, 1);
    resetFighter(this.p2, 2.2, -1);
    if (this.cfg.mode !== 'training') {
      gameAudio.playRoundBell();
      gameAudio.announce(`Round ${this.roundNumber}`);
      this.triggerRandomQuote(this.roundNumber % 2 === 1 ? this.p1 : this.p2, this.roundNumber % 2 === 1 ? 'left' : 'right');
    }
    this.emitHud();
  }

  public applyOnlineRemotePacket(packet: OnlineSyncPacket): void {
    if (this.cfg.mode !== 'online') return;
    const remote = this.cfg.onlineRole === 'guest' ? this.p1 : this.p2;
    const local = this.cfg.onlineRole === 'guest' ? this.p2 : this.p1;

    remote.x = THREE.MathUtils.lerp(remote.x, packet.x, 0.6);
    remote.y = THREE.MathUtils.lerp(remote.y, packet.y || 0, 0.6);
    if (remote.state !== packet.state) {
      remote.state = packet.state;
      remote.stateTime = packet.stateTime;
      const spec = MOVES[packet.state];
      remote.stateDuration = spec.startup + spec.active + spec.recovery;
    }
    remote.facing = packet.facing;
    remote.energy = packet.energy;
    remote.buff = packet.buff;

    if (packet.hitEvent) {
      local.hp = Math.max(0, local.hp - packet.hitEvent.damage);
      local.state = local.hp <= 0 ? 'ko' : 'hitstun';
      local.stateTime = 0;
      local.stateDuration = local.hp <= 0 ? 2.5 : 0.34;
      local.vx = -local.facing * packet.hitEvent.knockback;
      if (packet.hitEvent.move === 'slap') {
        local.slapRedness = Math.min(1, local.slapRedness + 0.5);
        gameAudio.playSlap();
      } else {
        gameAudio.playPunch(packet.hitEvent.damage > 12);
      }
      this.spawnImpactVfx(local.x, 1.25 + local.y, 0, 0xfacc15, 10);
      this.addDamagePopup(local.x, 1.65 + local.y, packet.hitEvent.damage, 'normal');
    }
  }

  private handleResize(): void {
    if (this.disposed) return;
    const w = Math.max(240, this.cfg.container.clientWidth);
    const h = Math.max(240, this.cfg.container.clientHeight);
    const aspect = w / h;
    this.camera.aspect = aspect;
    this.camera.fov = aspect < 0.85 ? 52 : 42;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private tick = (): void => {
    if (this.disposed) return;

    const rawDt = Math.min(0.05, this.clock.getDelta());
    const elapsed = this.clock.elapsedTime;

    if (!this.isPaused) {
      if (this.hitstopTimer > 0) {
        this.hitstopTimer -= rawDt;
      } else {
        const timeScale =
          this.finisherCamTimer > 0
            ? 0.52
            : this.roundPhase === 'ko_slowmo'
              ? 0.38
              : 1;
        this.stepSimulation(rawDt * timeScale, elapsed);
      }
    }

    this.updateCamera(rawDt, elapsed);
    this.updateMascotCat(rawDt, elapsed);
    this.updateBlackCatSwarm(rawDt, elapsed);
    this.updateVfx(rawDt);

    if (this.stageHitPulse > 0) this.stageHitPulse = Math.max(0, this.stageHitPulse - rawDt * 3.0);
    for (let i = 0; i < this.stageAnimators.length; i++) {
      this.stageAnimators[i](rawDt, elapsed, this.stageHitPulse);
    }

    if (this.lighthouseBeacon) {
      this.lighthouseBeacon.rotation.y += rawDt * 2.1;
    }

    if (this.superFlashTimer > 0) {
      this.superFlashTimer = Math.max(0, this.superFlashTimer - rawDt);
    }

    if (!this.contextLost) {
      try {
        this.renderer.render(this.scene, this.camera);
      } catch {
        // ignore if context was lost mid-frame
      }
    }

    this.hudEmitAccum += rawDt;
    if (this.hudEmitAccum >= 0.045) {
      this.hudEmitAccum = 0;
      this.emitHud();
    }

    this.scheduleNextFrame();
  };

  private stepSimulation(dt: number, elapsed: number): void {
    this.matchElapsed += dt;

    if (this.finisherCamTimer > 0) {
      this.finisherCamTimer = Math.max(0, this.finisherCamTimer - dt);
    }

    if (this.calloutTimer > 0) {
      this.calloutTimer -= dt;
      if (this.calloutTimer <= 0) {
        this.calloutText = null;
        this.calloutSide = null;
      }
    }

    if (this.quoteTimer > 0) {
      this.quoteTimer -= dt;
      if (this.quoteTimer <= 0) {
        this.quoteText = null;
        this.quoteSide = null;
      }
    }

    if (this.roundPhase === 'intro') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0.45 && this.bannerText !== 'LUTA!') {
        this.bannerText = 'LUTA!';
        gameAudio.announce('Luta!');
      }
      if (this.phaseTimer <= 0) {
        this.roundPhase = 'fight';
        this.bannerText = null;
        this.p1.state = 'idle';
        this.p2.state = 'idle';
      }
    } else if (this.roundPhase === 'fight') {
      if (this.cfg.mode !== 'training') {
        this.roundTimer = Math.max(0, this.roundTimer - dt);
      } else {
        // Training regeneration
        [this.p1, this.p2].forEach((f) => {
          f.regenIdleTimer += dt;
          if (f.regenIdleTimer > 1.8 && f.state === 'idle') {
            f.hp = Math.min(f.maxHp, f.hp + dt * 65);
          }
          f.energy = Math.min(100, f.energy + dt * 14);
        });
        this.updateTrainingDummyInput(dt);
      }

      if (this.cfg.mode === 'vs_ai' || this.cfg.mode === 'arcade') {
        this.updateAi(dt);
      }

      this.updateFighter(this.p1, this.p2, this.p1Input, dt);
      this.updateFighter(this.p2, this.p1, this.p2Input, dt);
      this.resolveBodyPush();

      this.checkAttackHit(this.p1, this.p2);
      this.checkAttackHit(this.p2, this.p1);

      if (this.cfg.mode === 'online' && this.cfg.onSendOnlineState) {
        this.netSendAccum += dt;
        if (this.netSendAccum >= 0.04) {
          this.netSendAccum = 0;
          const local = this.cfg.onlineRole === 'guest' ? this.p2 : this.p1;
          this.cfg.onSendOnlineState({
            type: 'fighter_sync',
            x: local.x,
            y: local.y,
            state: local.state,
            stateTime: local.stateTime,
            hp: local.hp,
            energy: local.energy,
            facing: local.facing,
            buff: local.buff,
          });
        }
      }

      if (this.cfg.mode !== 'training' && (this.p1.hp <= 0 || this.p2.hp <= 0 || this.roundTimer <= 0)) {
        this.handleRoundEnd();
      }
    } else if (this.roundPhase === 'ko_slowmo') {
      this.phaseTimer -= dt;
      this.updateFighterPhysicsOnly(this.p1, dt);
      this.updateFighterPhysicsOnly(this.p2, dt);
      if (this.phaseTimer <= 0) {
        this.finalizeRoundOutcome();
      }
    } else if (this.roundPhase === 'round_over') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        if (this.p1.roundsWon >= 2 || this.p2.roundsWon >= 2) {
          this.finishMatch();
        } else {
          this.roundNumber += 1;
          this.resetRound();
        }
      }
    }

    [this.p1, this.p2].forEach((f) => {
      if (f.slapRedness > 0) {
        f.slapRedness = Math.max(0, f.slapRedness - dt * 0.14);
        f.rig.setRedness(f.slapRedness);
      }
      if (f.stun > 0 && f.state !== 'stun') {
        f.stun = Math.max(0, f.stun - dt * 4.5);
      }
    });

    animateFighterRig(
      this.p1.rig,
      this.p1.fighterId,
      this.p1.state,
      this.p1.stateTime,
      this.p1.stateDuration,
      elapsed,
      dt,
      this.p1.buff,
    );
    animateFighterRig(
      this.p2.rig,
      this.p2.fighterId,
      this.p2.state,
      this.p2.stateTime,
      this.p2.stateDuration,
      elapsed + 1.2,
      dt,
      this.p2.buff,
    );

    [this.p1, this.p2].forEach((f) => {
      f.rig.root.position.set(f.x, f.y, f.z + f.dodgeZOffset);
      f.rig.root.rotation.y = THREE.MathUtils.damp(
        f.rig.root.rotation.y,
        f.facing === 1 ? Math.PI / 2 : -Math.PI / 2,
        20,
        dt,
      );
      f.shadow.position.set(f.x, 0.02, f.z + f.dodgeZOffset);
      const sScale = Math.max(0.5, 1 - f.y * 0.25);
      f.shadow.scale.set(sScale, sScale, sScale);
    });
  }

  private updateFighterPhysicsOnly(f: FighterRuntime, dt: number): void {
    f.stateTime += dt;
    f.x = THREE.MathUtils.clamp(f.x + f.vx * dt, -6.2, 6.2);
    f.vx = THREE.MathUtils.damp(f.vx, 0, 9, dt);
    if (f.y > 0 || f.vy !== 0) {
      f.y += f.vy * dt;
      f.vy -= 22 * dt;
      if (f.y <= 0) {
        f.y = 0;
        f.vy = 0;
      }
    }
  }

  private pickRequestedMove(f: FighterRuntime, opp: FighterRuntime, input: FighterInputState): MoveId | null {
    const prev = f.prevInput;
    const edge = (now?: boolean, old?: boolean) => Boolean(now && !old);

    if (edge(input.finisher, prev.finisher) && f.energy >= 100) return 'finisher_move';
    if (edge(input.powerMove, prev.powerMove) && f.energy >= POWERS[f.powerId].energyCost) return 'power_move';
    if (edge(input.specialCombo, prev.specialCombo) && f.energy >= MOVES.special_combo.energyCost) return 'special_combo';
    if (edge(input.special1, prev.special1)) return 'special_1';
    if (edge(input.special2, prev.special2)) return 'special_2';
    if (edge(input.grab, prev.grab)) return 'grab';
    if (edge(input.parry, prev.parry)) return 'parry';
    if (edge(input.taunt, prev.taunt)) return 'taunt';

    if (f.y > 0.15) {
      if (edge(input.punchLight || input.punchMed || input.punchHeavy || input.quickPunch || input.heavyPunch || input.slap, prev.punchLight || prev.punchMed || prev.punchHeavy || prev.quickPunch || prev.heavyPunch || prev.slap)) {
        return 'air_punch';
      }
      if (edge(input.kickLight || input.kickMed || input.kickHeavy || input.kick, prev.kickLight || prev.kickMed || prev.kickHeavy || prev.kick)) {
        return 'air_kick';
      }
      return null;
    }

    if (input.crouch) {
      if (edge(input.punchLight || input.punchMed || input.punchHeavy || input.quickPunch, prev.punchLight || prev.punchMed || prev.punchHeavy || prev.quickPunch)) {
        return 'crouch_punch';
      }
      if (edge(input.kickLight || input.kickMed || input.kickHeavy || input.kick, prev.kickLight || prev.kickMed || prev.kickHeavy || prev.kick)) {
        return 'crouch_kick';
      }
    }

    if (edge(input.punchHeavy || input.heavyPunch, prev.punchHeavy || prev.heavyPunch)) return 'punch_heavy';
    if (edge(input.punchMed, prev.punchMed)) return 'punch_med';
    if (edge(input.slap, prev.slap)) return 'slap';
    if (edge(input.kickHeavy, prev.kickHeavy)) return 'kick_heavy';
    if (edge(input.kickMed || input.kick, prev.kickMed || prev.kick)) return 'kick_med';
    if (edge(input.kickLight, prev.kickLight)) return 'kick_light';

    if (edge(input.punchLight || input.quickPunch, prev.punchLight || prev.quickPunch)) {
      if (f.fighterId === 'policial') {
        const step = f.comboCount % 4;
        if (step === 0) return 'punch_light';
        if (step === 1) return 'punch_med';
        if (step === 2) return 'slap';
        return 'punch_heavy';
      }
      if (f.comboCount % 3 === 2) return 'kick_light';
      if (f.comboCount % 3 === 1) return 'punch_med';
      return 'punch_light';
    }

    if (edge(input.dodge, prev.dodge)) {
      const dist = Math.abs(opp.x - f.x);
      const movingFwd = Math.sign(input.moveX) === f.facing && Math.abs(input.moveX) > 0.2;
      if ((movingFwd && dist < 1.38 && opp.y < 0.45) || (f.state === 'dodge' && f.dodgedThisMove && dist < 1.55)) {
        return 'grab';
      }
      return 'dodge';
    }
    return null;
  }

  private updateFighter(
    f: FighterRuntime,
    opp: FighterRuntime,
    input: FighterInputState,
    dt: number,
  ): void {
    if (f.buffTimer > 0) {
      f.buffTimer -= dt;
      if (f.buffTimer <= 0) f.buff = null;
    }
    if (f.counterWindowTimer > 0) f.counterWindowTimer = Math.max(0, f.counterWindowTimer - dt);
    if (f.grabWindowTimer > 0) f.grabWindowTimer = Math.max(0, f.grabWindowTimer - dt);
    if (f.parryWindowTimer > 0) f.parryWindowTimer = Math.max(0, f.parryWindowTimer - dt);

    if (f.comboResetTimer > 0) {
      f.comboResetTimer -= dt;
      if (f.comboResetTimer <= 0) f.comboCount = 0;
    }

    // Input Buffer (~110ms = ~6.5 frames)
    const newlyPressed = this.pickRequestedMove(f, opp, input);
    if (newlyPressed) {
      f.bufferedMove = newlyPressed;
      f.bufferTimer = 0.11;
    } else if (f.bufferTimer > 0) {
      f.bufferTimer -= dt;
      if (f.bufferTimer <= 0) f.bufferedMove = null;
    }
    f.prevInput = { ...input };

    const targetZ =
      f.state === 'dodge'
        ? -0.28 * Math.sin((f.stateTime / Math.max(0.1, f.stateDuration)) * Math.PI)
        : 0;
    f.dodgeZOffset = THREE.MathUtils.damp(f.dodgeZOffset, targetZ, 24, dt);

    // Gravity & airborne physics
    if (f.y > 0 || f.vy !== 0) {
      f.y += f.vy * dt;
      f.vy -= 22 * dt;
      if (f.y <= 0) {
        f.y = 0;
        f.vy = 0;
        if (f.state === 'jump' || f.state === 'air_punch' || f.state === 'air_kick') {
          f.state = 'idle';
          f.stateTime = 0;
          f.stateDuration = 0;
        }
      }
    }

    const bal = FIGHTERS[f.fighterId].balance;
    const speedMult = f.buff === 'speed' ? 1.45 : 1.0;
    const moveSpeed = bal.walkSpeed * speedMult;

    const isNeutral =
      f.state === 'idle' ||
      f.state === 'walk_fwd' ||
      f.state === 'walk_back' ||
      f.state === 'run' ||
      f.state === 'crouch' ||
      f.state === 'block' ||
      f.state === 'crouch_block' ||
      f.state === 'jump';

    // Hit-confirm special cancel!
    const currentSpec = MOVES[f.state];
    const canCancelOnHit =
      Boolean(currentSpec.cancellable) &&
      f.hasHitCurrentMove &&
      f.bufferedMove &&
      (f.bufferedMove === 'special_1' ||
        f.bufferedMove === 'special_2' ||
        f.bufferedMove === 'special_combo' ||
        f.bufferedMove === 'power_move' ||
        f.bufferedMove === 'finisher_move');

    const canDodgeIntoGrab = f.state === 'dodge' && f.bufferedMove === 'grab';

    if ((canCancelOnHit || canDodgeIntoGrab) && f.bufferedMove) {
      const m = f.bufferedMove;
      f.bufferedMove = null;
      f.bufferTimer = 0;
      this.executeBufferedMove(f, m);
    } else if (isNeutral) {
      f.facing = opp.x >= f.x ? 1 : -1;

      if (f.bufferedMove) {
        const m = f.bufferedMove;
        f.bufferedMove = null;
        f.bufferTimer = 0;
        this.executeBufferedMove(f, m);
      } else if (input.jump && f.y <= 0.02) {
        f.vy = bal.jumpForce;
        f.y = 0.05;
        f.vx = input.moveX * moveSpeed * 0.95;
        f.state = 'jump';
        f.stateTime = 0;
        f.stateDuration = 0.72;
        gameAudio.playWhoosh();
      } else if (f.y > 0.02) {
        f.state = 'jump';
      } else if (input.block && input.crouch) {
        f.state = 'crouch_block';
        f.vx = 0;
      } else if (input.block) {
        f.state = 'block';
        f.vx = 0;
      } else if (input.crouch) {
        f.state = 'crouch';
        f.vx = 0;
      } else if (Math.abs(input.moveX) > 0.15) {
        const movingFwd = Math.sign(input.moveX) === f.facing;
        f.runHold = movingFwd && Math.abs(input.moveX) > 0.7 ? f.runHold + dt : 0;
        const running = f.runHold > 0.35;
        f.state = movingFwd ? (running ? 'run' : 'walk_fwd') : 'walk_back';
        f.vx = input.moveX * moveSpeed * (movingFwd ? (running ? 1.75 : 1) : 0.82);
      } else {
        f.runHold = 0;
        f.state = 'idle';
        f.vx = 0;
      }
    } else {
      f.stateTime += dt * (f.buff === 'speed' ? 1.25 : 1.0);
      f.vx = THREE.MathUtils.damp(f.vx, 0, 8.5, dt);

      // Paired Clinch Grab locking & climax throw
      if (f.state === 'grab' && f.grabClinched) {
        f.vx = 0;
        if (!f.grabHitApplied) {
          opp.x = THREE.MathUtils.clamp(f.x + f.facing * 0.68, -6.0, 6.0);
          opp.y = 0;
          opp.vx = 0;
          opp.facing = f.facing === 1 ? -1 : 1;
        }
        if (f.stateTime >= 0.42 && !f.grabHitApplied) {
          f.grabHitApplied = true;
          const isCounter = f.counterWindowTimer > 0;
          if (isCounter) f.counterWindowTimer = 0;
          const rawDmg = MOVES.grab.damage * bal.damageScale * (isCounter ? 1.25 : 1);
          const dmg = Math.max(1, Math.round(opp.buff === 'shield' ? rawDmg * 0.55 : rawDmg));
          opp.hp = Math.max(0, opp.hp - dmg);
          f.damageDealt += dmg;
          f.comboCount += 1;
          f.comboResetTimer = 1.45;
          f.maxComboAchieved = Math.max(f.maxComboAchieved, f.comboCount);
          f.energy = Math.min(100, f.energy + MOVES.grab.energyGain);
          opp.energy = Math.min(100, opp.energy + 6);
          if (opp.hp > 0 && opp.buff !== 'shield') {
            opp.stun = Math.min(100, opp.stun + MOVES.grab.stunDamage);
          }

          gameAudio.playPunch(true);
          this.spawnImpactVfx((f.x + opp.x) * 0.5, 1.15, 0.15, 0xfacc15, 16);
          this.addDamagePopup(opp.x, 1.6, dmg, isCounter ? 'counter' : 'normal');
          if (this.cfg.cameraShake) this.shakeAmount = 0.22;
          this.hitstopTimer = 0.045;

          opp.vx = f.facing * MOVES.grab.knockback;
          opp.state = opp.hp <= 0 ? 'ko' : opp.stun >= 100 ? 'stun' : 'knockdown';
          opp.stateTime = 0;
          opp.stateDuration = opp.hp <= 0 ? 2.8 : opp.stun >= 100 ? 1.65 : 0.44;
          if (opp.stun >= 100 && opp.hp > 0) {
            gameAudio.playStun();
            this.triggerCallout('ATORDOADO!', opp.slot === 'p1' ? 'left' : 'right');
          } else if (opp.hp <= 0) {
            this.triggerCallout('FINALIZAÇÃO!', f.slot === 'p1' ? 'left' : 'right');
          }
        }
      }

      if (f.stateTime >= f.stateDuration) {
        if (f.state === 'stun') f.stun = 0;
        f.state = f.y > 0.05 ? 'jump' : 'idle';
        f.stateTime = 0;
        f.stateDuration = 0;
        f.hasHitCurrentMove = false;
        f.dodgedThisMove = false;
        f.grabClinched = false;
        f.grabHitApplied = false;
      }
    }

    f.x = THREE.MathUtils.clamp(f.x + f.vx * dt, -6.2, 6.2);
  }

  private executeBufferedMove(f: FighterRuntime, moveId: MoveId): void {
    if (moveId === 'power_move') {
      if (f.energy >= POWERS[f.powerId].energyCost) {
        this.startPowerMove(f);
      }
      return;
    }
    if (moveId === 'finisher_move') {
      if (f.energy >= 100) {
        this.startFinisherMove(f);
      }
      return;
    }
    this.startMove(f, moveId);
  }

  private startMove(f: FighterRuntime, moveId: MoveId): void {
    const spec = MOVES[moveId];
    if (spec.energyCost > 0) {
      if (f.energy < spec.energyCost) return;
      f.energy = Math.max(0, f.energy - spec.energyCost);
    }

    const bal = FIGHTERS[f.fighterId].balance;
    f.state = moveId;
    f.stateTime = 0;
    f.stateDuration = (spec.startup + spec.active + spec.recovery) * bal.recoveryScale;
    f.hasHitCurrentMove = false;
    f.dodgedThisMove = false;
    f.multiHitCount = 0;
    f.grabClinched = false;
    f.grabHitApplied = false;

    const currentInputX = (f.slot === 'p1' ? this.p1Input.moveX : this.p2Input.moveX) || 0;

    if (moveId === 'grab') {
      f.grabWindowTimer = 0.16;
      f.vx = f.facing * 3.1;
    } else if (moveId === 'parry') {
      f.parryWindowTimer = 0.13; // ~7-8 frames forgiving parry window
      f.vx = 0;
    } else if (moveId === 'dodge') {
      // Boxing slip: step forward under punches if holding forward, slip back if holding back, weave tight if neutral
      if (Math.sign(currentInputX) === f.facing && Math.abs(currentInputX) > 0.2) {
        f.vx = f.facing * 2.55;
      } else if (Math.sign(currentInputX) === -f.facing && Math.abs(currentInputX) > 0.2) {
        f.vx = -f.facing * 2.8;
      } else {
        f.vx = f.facing * 0.7;
      }
    } else if (moveId === 'taunt') {
      f.vx = 0;
      f.energy = Math.min(100, f.energy + 12);
      this.triggerRandomQuote(f, f.slot === 'p1' ? 'left' : 'right');
    } else if (moveId === 'special_1' || moveId === 'special_2' || moveId === 'special_combo' || moveId === 'punch_heavy') {
      f.vx = f.facing * 2.85;
    } else if (f.y <= 0.05) {
      f.vx = f.facing * 1.15;
    }

    if (moveId === 'dodge') gameAudio.playDodge();
    else if (moveId === 'special_1' || moveId === 'special_2' || moveId === 'special_combo') {
      gameAudio.playSpecial();
      const custom =
        moveId === 'special_1'
          ? FIGHTERS[f.fighterId].specialMoves.special_1.name
          : moveId === 'special_2'
            ? FIGHTERS[f.fighterId].specialMoves.special_2.name
            : 'COMBO ESPECIAL!';
      this.triggerCallout(custom.toUpperCase(), f.slot === 'p1' ? 'left' : 'right');
    } else if (moveId !== 'parry' && moveId !== 'taunt') {
      gameAudio.playWhoosh();
    }
  }

  private startPowerMove(f: FighterRuntime): void {
    const power = POWERS[f.powerId];
    f.energy = Math.max(0, f.energy - power.energyCost);
    f.state = 'power_move';
    f.stateTime = 0;
    f.stateDuration = power.durationSec;
    f.hasHitCurrentMove = false;
    f.dodgedThisMove = false;
    f.multiHitCount = 0;

    if (power.id === 'gatos_pretos') {
      this.launchBlackCatSwarm(f);
      this.triggerCallout('ENXAME DE GATOS PRETOS!', f.slot === 'p1' ? 'left' : 'right');
      gameAudio.announce('Gatos Pretos!');
    } else if (power.id === 'velocidade_extrema') {
      f.buff = 'speed';
      f.buffTimer = 6.0;
      this.triggerCallout('VELOCIDADE EXTREMA!', f.slot === 'p1' ? 'left' : 'right');
    } else if (power.id === 'escudo') {
      f.buff = 'shield';
      f.buffTimer = 5.0;
      this.triggerCallout('ESCUDO DE AXÉ!', f.slot === 'p1' ? 'left' : 'right');
    } else {
      f.vx = f.facing * 4.4;
      this.superFlashTimer = 0.24;
      this.triggerCallout(power.name.toUpperCase() + '!', f.slot === 'p1' ? 'left' : 'right');
    }

    gameAudio.playSpecial();
    this.spawnImpactVfx(f.x, 1.15, f.z, parseInt(power.colorHex.replace('#', ''), 16), 16);
  }

  private startFinisherMove(f: FighterRuntime): void {
    f.energy = 0;
    f.state = 'finisher_move';
    f.stateTime = 0;
    f.stateDuration = MOVES.finisher_move.startup + MOVES.finisher_move.active + MOVES.finisher_move.recovery;
    f.hasHitCurrentMove = false;
    f.dodgedThisMove = false;
    f.multiHitCount = 0;
    f.vx = f.facing * 4.8;
    f.finisherUsed = true;

    this.finisherCamTimer = 1.15;
    this.superFlashTimer = 0.42;

    if (f.fighterId === 'policial') {
      this.launchBlackCatSwarm(f);
    }

    const finName = FIGHTERS[f.fighterId].finisherName;
    this.triggerCallout(`GOLPE FINAL: ${finName}!`, f.slot === 'p1' ? 'left' : 'right');
    gameAudio.playFinisher();
    gameAudio.announce(finName);
    this.spawnImpactVfx(f.x, 1.25, f.z, 0xfacc15, 22);
  }

  private resolveBodyPush(): void {
    if (
      this.p1.grabClinched ||
      this.p2.grabClinched ||
      this.p1.state === 'grabbed' ||
      this.p2.state === 'grabbed'
    ) {
      return;
    }
    const minSep = 0.92;
    const dx = this.p2.x - this.p1.x;
    const dist = Math.abs(dx);
    if (dist < minSep && this.p1.state !== 'dodge' && this.p2.state !== 'dodge' && Math.abs(this.p1.y - this.p2.y) < 0.85) {
      const push = (minSep - dist) * 0.5;
      const dir = dx >= 0 ? 1 : -1;
      this.p1.x = THREE.MathUtils.clamp(this.p1.x - dir * push, -6.2, 6.2);
      this.p2.x = THREE.MathUtils.clamp(this.p2.x + dir * push, -6.2, 6.2);
    }
  }

  private checkAttackHit(attacker: FighterRuntime, defender: FighterRuntime): void {
    const spec = MOVES[attacker.state];
    if (spec.damage <= 0 && attacker.state !== 'power_move') return;

    if (
      attacker.state === 'power_move' &&
      (attacker.powerId === 'velocidade_extrema' || attacker.powerId === 'escudo')
    ) {
      return;
    }

    const inActiveWindow =
      attacker.stateTime >= spec.startup &&
      attacker.stateTime <= spec.startup + spec.active;
    if (!inActiveWindow) return;

    const maxHits =
      attacker.state === 'finisher_move'
        ? 4
        : attacker.state === 'special_combo'
          ? 3
          : attacker.state === 'power_move' &&
              (attacker.powerId === 'combo_relampago' || attacker.powerId === 'gatos_pretos')
            ? 4
            : 1;

    if (maxHits === 1 && attacker.hasHitCurrentMove) return;
    if (maxHits > 1) {
      const slice = spec.active / maxHits;
      const expectedHitIndex = Math.floor((attacker.stateTime - spec.startup) / slice) + 1;
      if (attacker.multiHitCount >= expectedHitIndex || attacker.multiHitCount >= maxHits) return;
    }

    const dx = defender.x - attacker.x;
    const dist = Math.abs(dx);
    const inFront = Math.sign(dx) === attacker.facing || dist < 0.75;
    const rangeScale = FIGHTERS[attacker.fighterId].balance.rangeScale;
    const baseRange =
      attacker.state === 'power_move'
        ? attacker.powerId === 'gatos_pretos'
          ? 5.6
          : 2.85
        : attacker.state === 'finisher_move'
          ? 4.2
          : spec.range;
    const range = baseRange * rangeScale;

    if (!inFront || dist > range) return;
    if (Math.abs(attacker.y - defender.y) > 1.35) return;

    // Grab Break Check!
    if (attacker.state === 'grab' && defender.grabWindowTimer > 0) {
      attacker.hasHitCurrentMove = true;
      attacker.state = 'grab_break';
      attacker.stateTime = 0;
      attacker.stateDuration = 0.32;
      attacker.vx = -attacker.facing * 2.4;

      defender.state = 'grab_break';
      defender.stateTime = 0;
      defender.stateDuration = 0.32;
      defender.vx = -defender.facing * 2.4;

      gameAudio.playGrabBreak();
      this.spawnImpactVfx((attacker.x + defender.x) * 0.5, 1.3, 0, 0xfacc15, 12);
      this.triggerCallout('QUEBRA DE AGARRÃO!', defender.slot === 'p1' ? 'left' : 'right');
      return;
    }

    // Perfect Parry (6-8 frames window)
    if (defender.parryWindowTimer > 0 && attacker.state !== 'finisher_move' && attacker.state !== 'grab') {
      attacker.hasHitCurrentMove = true;
      attacker.state = 'hitstun';
      attacker.stateTime = 0;
      attacker.stateDuration = 0.42;
      attacker.vx = -attacker.facing * 1.4;

      defender.parryWindowTimer = 0;
      defender.perfectParries += 1;
      defender.energy = Math.min(100, defender.energy + 18);
      defender.counterWindowTimer = 1.1;

      gameAudio.playParry();
      gameAudio.announce('Defesa perfeita!');
      this.hitstopTimer = 0.08;
      this.spawnImpactVfx(defender.x, 1.35, 0.2, 0xfacc15, 16);
      this.addDamagePopup(defender.x, 1.75, 0, 'parry');
      this.triggerCallout('DEFESA PERFEITA!', defender.slot === 'p1' ? 'left' : 'right');
      return;
    }

    // Boxing Slip Dodge!
    if (defender.state === 'dodge') {
      if (!defender.dodgedThisMove) {
        defender.dodgedThisMove = true;
        defender.energy = Math.min(100, defender.energy + 16);
        defender.counterWindowTimer = 1.0;
        gameAudio.playDodge();
        this.triggerCallout('ESQUIVA DE BOXE!', defender.slot === 'p1' ? 'left' : 'right');
      }
      return;
    }

    // Paired Clinch Grab initiation
    if (attacker.state === 'grab') {
      if (defender.state === 'grabbed' || defender.y > 0.65 || defender.state === 'ko' || defender.state === 'knockdown') {
        return;
      }
      attacker.hasHitCurrentMove = true;
      attacker.grabClinched = true;
      attacker.grabHitApplied = false;
      attacker.stateTime = 0.12;
      attacker.stateDuration = 0.62;
      attacker.vx = 0;

      defender.state = 'grabbed';
      defender.stateTime = 0.12;
      defender.stateDuration = 0.62;
      defender.vx = 0;
      defender.bufferedMove = null;
      defender.x = THREE.MathUtils.clamp(attacker.x + attacker.facing * 0.68, -6.0, 6.0);
      defender.facing = attacker.facing === 1 ? -1 : 1;

      gameAudio.playWhoosh();
      this.spawnImpactVfx((attacker.x + defender.x) * 0.5, 1.25, 0.1, 0xfacc15, 8);
      this.triggerCallout('AGARRÃO!', attacker.slot === 'p1' ? 'left' : 'right');
      return;
    }

    attacker.hasHitCurrentMove = true;
    attacker.multiHitCount += 1;
    defender.regenIdleTimer = 0;

    // Directional guard check (low hits crouch-block, overhead hits high-block)
    const isBlocked =
      !spec.isUnblockable &&
      ((defender.state === 'block' && spec.hitHeight !== 'low') ||
        (defender.state === 'crouch_block' && spec.hitHeight !== 'overhead'));

    const fighterBal = FIGHTERS[attacker.fighterId].balance;
    const baseDmg =
      attacker.state === 'power_move'
        ? POWERS[attacker.powerId].damage / maxHits
        : spec.damage / maxHits;

    const isCounterHit =
      !isBlocked &&
      (attacker.counterWindowTimer > 0 ||
        (MOVES[defender.state].startup > 0 && defender.stateTime < MOVES[defender.state].startup));

    let dmg = baseDmg * fighterBal.damageScale;
    if (isCounterHit) {
      dmg *= 1.25;
      attacker.counterWindowTimer = 0;
    }

    if (!isBlocked) {
      attacker.comboCount += 1;
      attacker.comboResetTimer = 1.45;
      attacker.maxComboAchieved = Math.max(attacker.maxComboAchieved, attacker.comboCount);
      // Combo scaling prevents infinite 1-touch KOs while rewarding chains
      const comboScale = Math.max(0.48, 1 - Math.max(0, attacker.comboCount - 1) * 0.1);
      dmg *= comboScale;
    }

    if (isBlocked) {
      dmg = Math.max(1, spec.chipDamage);
    }
    if (defender.buff === 'shield') {
      dmg *= 0.45;
    }

    const finalDamage = Math.max(1, Math.round(dmg));
    defender.hp = Math.max(0, defender.hp - finalDamage);
    attacker.damageDealt += finalDamage;

    attacker.energy = Math.min(100, attacker.energy + spec.energyGain);
    defender.energy = Math.min(100, defender.energy + 5);

    _hitPos.set((attacker.x + defender.x) * 0.5, 1.32 + defender.y * 0.6, 0.12);
    if (isBlocked) {
      gameAudio.playBlock();
      this.spawnImpactVfx(_hitPos.x, _hitPos.y, _hitPos.z, 0x38bdf8, 6);
      defender.vx = attacker.facing * (spec.knockback * 0.45);
      this.addDamagePopup(defender.x, 1.5 + defender.y, finalDamage, 'normal');
    } else {
      const isSlap =
        attacker.state === 'slap' ||
        (attacker.state === 'power_move' && attacker.powerId === 'tapa_explosivo');

      if (isSlap) {
        gameAudio.playSlap();
        defender.slapRedness = Math.min(1, defender.slapRedness + 0.55);
        defender.rig.setRedness(defender.slapRedness);
      } else if (
        attacker.state === 'kick' ||
        attacker.state === 'kick_light' ||
        attacker.state === 'kick_med' ||
        attacker.state === 'kick_heavy' ||
        attacker.state === 'air_kick' ||
        attacker.state === 'crouch_kick'
      ) {
        gameAudio.playKick();
      } else {
        gameAudio.playPunch(finalDamage >= 13);
      }

      const vfxColor =
        attacker.state === 'power_move'
          ? parseInt(POWERS[attacker.powerId].colorHex.replace('#', ''), 16)
          : isSlap
            ? 0xef4444
            : spec.vfxColor;

      this.spawnImpactVfx(_hitPos.x, _hitPos.y, _hitPos.z, vfxColor, finalDamage >= 14 ? 16 : 10);
      this.stageHitPulse = Math.min(1, this.stageHitPulse + 0.45);

      const popKind: DamagePopup['kind'] =
        attacker.state === 'finisher_move'
          ? 'finisher'
          : attacker.state === 'power_move'
            ? 'super'
            : isSlap
              ? 'slap'
              : isCounterHit
                ? 'counter'
                : 'normal';
      this.addDamagePopup(defender.x, 1.6 + defender.y, finalDamage, popKind);

      if (this.cfg.cameraShake) {
        this.shakeAmount = Math.min(0.38, 0.08 + finalDamage * 0.008);
      }
      this.hitstopTimer = isSlap || finalDamage >= 14 ? 0.055 : 0.03;

      // Accumulate Stun / Dizzy gauge
      if (defender.hp > 0 && defender.buff !== 'shield') {
        defender.stun = Math.min(100, defender.stun + spec.stunDamage);
        if (defender.stun >= 100 && defender.state !== 'stun') {
          defender.state = 'stun';
          defender.stateTime = 0;
          defender.stateDuration = 1.75;
          gameAudio.playStun();
          this.triggerCallout('ATORDOADO!', defender.slot === 'p1' ? 'left' : 'right');
        } else if (defender.state !== 'stun') {
          defender.state = finalDamage >= 18 ? 'knockdown' : 'hitstun';
          defender.stateTime = 0;
          defender.stateDuration = spec.hitstun;
        }
      } else if (defender.hp <= 0) {
        defender.state = 'ko';
        defender.stateTime = 0;
        defender.stateDuration = 2.8;
      }

      defender.vx = attacker.facing * spec.knockback;
      if (finalDamage >= 10 || isSlap) this.catJumpTimer = 0.5;

      const side = attacker.slot === 'p1' ? 'left' : 'right';
      if (defender.hp <= 0) {
        this.triggerCallout('FINALIZAÇÃO!', side);
      } else if (isCounterHit && attacker.comboCount === 1) {
        this.triggerCallout('CONTRA-ATAQUE!', side);
      } else if (isSlap && attacker.fighterId === 'policial' && attacker.comboCount <= 2) {
        this.triggerCallout('TAPÃO! FICOU VERMELHO!', side);
      } else if (attacker.comboCount >= 5) {
        this.triggerCallout('COMBO PERFEITO!', side);
      } else if (attacker.comboCount === 3 || attacker.comboCount === 4) {
        this.triggerCallout(`${attacker.comboCount} HITS!`, side);
      } else if (attacker.comboCount === 2) {
        this.triggerCallout('2 HITS!', side);
      }
    }
  }

  private getComboMultiplier(hits: number): number {
    if (hits >= 5) return 1.5;
    if (hits >= 3) return 1.25;
    if (hits >= 2) return 1.1;
    return 1.0;
  }

  private triggerCallout(text: string, side: 'left' | 'right'): void {
    this.calloutText = text;
    this.calloutSide = side;
    this.calloutTimer = 1.25;
  }

  private triggerRandomQuote(f: FighterRuntime, side: 'left' | 'right'): void {
    const quotes = FIGHTERS[f.fighterId].quotes;
    if (!quotes || quotes.length === 0) return;
    this.quoteText = quotes[Math.floor(Math.random() * quotes.length)];
    this.quoteSide = side;
    this.quoteTimer = 2.5;
  }

  private updateTrainingDummyInput(dt: number): void {
    if (this.trainingDummyMode === 'cpu') {
      this.updateAi(dt);
      return;
    }
    const input = createEmptyInput();
    if (this.trainingDummyMode === 'crouch') {
      input.crouch = true;
    } else if (this.trainingDummyMode === 'guard_all') {
      input.block = true;
    } else if (this.trainingDummyMode === 'counter') {
      if (this.p2.state === 'hitstun') {
        this.p2.aiThinkTimer = 0.35;
      } else if (this.p2.aiThinkTimer > 0) {
        this.p2.aiThinkTimer -= dt;
        if (this.p2.aiThinkTimer <= 0) input.punchLight = true;
      }
    }
    this.p2Input = input;
  }

  private updateAi(dt: number): void {
    const ai = this.p2;
    const player = this.p1;
    ai.aiThinkTimer -= dt;
    if (ai.aiThinkTimer > 0) {
      this.p2Input = ai.aiDesiredMove;
      return;
    }

    const diff = this.cfg.aiDifficulty;
    ai.aiThinkTimer = diff === 'hard' ? 0.1 : diff === 'medium' ? 0.18 : 0.3;

    const input = createEmptyInput();
    const dx = player.x - ai.x;
    const dist = Math.abs(dx);
    const dirToPlayer = dx >= 0 ? 1 : -1;

    const playerAttacking =
      player.state.startsWith('punch') ||
      player.state.startsWith('kick') ||
      player.state === 'slap' ||
      player.state === 'special_1' ||
      player.state === 'special_2' ||
      player.state === 'special_combo';

    const blockChance = diff === 'hard' ? 0.65 : diff === 'medium' ? 0.36 : 0.15;
    if (playerAttacking && dist < 2.2 && Math.random() < blockChance) {
      if (diff === 'hard' && Math.random() < 0.22) input.parry = true;
      else if (Math.random() < 0.3) input.dodge = true;
      else input.block = true;
    } else if (dist > 1.85) {
      input.moveX = dirToPlayer;
      if (ai.energy >= 100 && Math.random() < (diff === 'hard' ? 0.45 : 0.15)) {
        input.finisher = true;
      } else if (dist < 2.6 && ai.energy >= POWERS[ai.powerId].energyCost && Math.random() < (diff === 'hard' ? 0.3 : 0.14)) {
        input.powerMove = true;
      } else if (dist < 3.4 && diff !== 'easy' && Math.random() < 0.12) {
        input.jump = true;
      }
    } else {
      const r = Math.random();
      const aggression = diff === 'hard' ? 0.88 : diff === 'medium' ? 0.72 : 0.48;
      if (r < aggression) {
        if (ai.energy >= 100 && Math.random() < 0.3) {
          input.finisher = true;
        } else if (ai.energy >= MOVES.special_combo.energyCost && Math.random() < 0.2) {
          input.specialCombo = true;
        } else if (player.state === 'block' && Math.random() < 0.38) {
          input.grab = true;
        } else {
          const roll = Math.random();
          if (roll < 0.2) input.punchLight = true;
          else if (roll < 0.36) input.punchMed = true;
          else if (roll < 0.5) input.punchHeavy = true;
          else if (roll < 0.66) input.kickLight = true;
          else if (roll < 0.8) input.kickHeavy = true;
          else if (roll < 0.9) input.special1 = true;
          else input.special2 = true;
        }
      } else {
        input.moveX = -dirToPlayer * 0.7;
      }
    }

    ai.aiDesiredMove = input;
    this.p2Input = input;
  }

  private handleRoundEnd(): void {
    this.roundPhase = 'ko_slowmo';
    this.phaseTimer = 1.65;
    gameAudio.playKO();
    if (this.p1.hp <= 0 || this.p2.hp <= 0) {
      this.bannerText = 'K.O.!';
      gameAudio.announce('Nocaute!');
      if (this.p1.hp <= 0) this.p1.state = 'ko';
      if (this.p2.hp <= 0) this.p2.state = 'ko';
    } else {
      this.bannerText = 'TEMPO ESGOTADO!';
      gameAudio.announce('Tempo esgotado!');
    }
    this.emitHud();
  }

  private finalizeRoundOutcome(): void {
    this.roundPhase = 'round_over';
    this.phaseTimer = 2.1;

    const p1Ratio = this.p1.hp / this.p1.maxHp;
    const p2Ratio = this.p2.hp / this.p2.maxHp;

    const p1Name = getDisplayFighterMeta(this.p1.fighterId, this.cfg.authorizationMode).name;
    const p2Name = getDisplayFighterMeta(this.p2.fighterId, this.cfg.authorizationMode).name;

    if (p1Ratio > p2Ratio) {
      this.p1.roundsWon += 1;
      const vStates: MoveId[] = ['victory', 'victory_1', 'victory_2'];
      this.p1.state = vStates[(this.roundNumber - 1) % 3];
      this.bannerText = `${p1Name} VENCEU!`;
      this.triggerRandomQuote(this.p1, 'left');
      if (this.p1.hp === this.p1.maxHp) this.perfectRoundsP1 += 1;
    } else if (p2Ratio > p1Ratio) {
      this.p2.roundsWon += 1;
      const vStates: MoveId[] = ['victory', 'victory_1', 'victory_2'];
      this.p2.state = vStates[(this.roundNumber - 1) % 3];
      this.bannerText = `${p2Name} VENCEU!`;
      this.triggerRandomQuote(this.p2, 'right');
    } else {
      this.bannerText = 'EMPATE!';
    }
    this.emitHud();
  }

  private finishMatch(): void {
    if (this.roundPhase === 'match_over') return;
    this.roundPhase = 'match_over';

    const winner: 'p1' | 'p2' | 'draw' =
      this.p1.roundsWon > this.p2.roundsWon ? 'p1' : this.p2.roundsWon > this.p1.roundsWon ? 'p2' : 'draw';

    const score = Math.round(
      this.p1.damageDealt * 12 +
        this.p1.maxComboAchieved * 85 +
        this.p1.perfectParries * 120 +
        this.perfectRoundsP1 * 300 +
        (this.p1.finisherUsed ? 250 : 0) +
        (winner === 'p1' ? 500 : 150),
    );
    const xpEarned = winner === 'p1' ? 130 + this.p1.maxComboAchieved * 8 : 60;
    const coinsEarned = winner === 'p1' ? 150 + this.perfectRoundsP1 * 50 : 50;
    const masteryXpEarned = winner === 'p1' ? 95 + this.p1.perfectParries * 15 : 40;

    this.emitHud();
    this.cfg.onMatchFinish({
      winner,
      mode: this.cfg.mode,
      arenaId: this.cfg.arenaId,
      p1FighterId: this.p1.fighterId,
      p2FighterId: this.p2.fighterId,
      p1RoundsWon: this.p1.roundsWon,
      p2RoundsWon: this.p2.roundsWon,
      maxCombo: this.p1.maxComboAchieved,
      damageDealt: this.p1.damageDealt,
      perfectRounds: this.perfectRoundsP1,
      perfectParries: this.p1.perfectParries,
      finisherUsed: this.p1.finisherUsed,
      score,
      xpEarned,
      coinsEarned,
      masteryXpEarned,
      durationSec: Math.round(this.matchElapsed),
      timestamp: new Date().toISOString(),
      opponentName: this.cfg.p2Nickname,
      arcadeStage: this.cfg.arcadeStage,
    });
  }

  private updateCamera(dt: number, elapsed: number): void {
    const midX = (this.p1.x + this.p2.x) * 0.5;
    const separation = Math.abs(this.p1.x - this.p2.x);
    const isPortrait = this.camera.aspect < 0.85;

    if (this.finisherCamTimer > 0) {
      const orbitAngle = elapsed * 2.4;
      const targetX = midX + Math.sin(orbitAngle) * 2.2;
      const targetZ = 4.2 + Math.cos(orbitAngle) * 1.1;
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, targetX, 10, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, 1.85, 10, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, targetZ, 10, dt);
      this.camera.lookAt(midX, 1.25, 0);
      return;
    }

    const portraitScale = isPortrait ? 1.45 / Math.max(0.55, this.camera.aspect + 0.15) : 1.0;
    // Paisagem: câmera baixa e próxima (estilo jogo de luta), enquadrando só o necessário
    const halfFovTan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    const fitZ = (separation + 3.4) / (2 * halfFovTan * this.camera.aspect);
    const targetZ = isPortrait
      ? THREE.MathUtils.clamp((5.7 + separation * 0.78) * portraitScale, 6.0, 13.5)
      : THREE.MathUtils.clamp(Math.max(5.6, fitZ), 5.6, 11);
    const targetY = isPortrait
      ? THREE.MathUtils.clamp(2.5 + separation * 0.08, 2.0, 3.2)
      : THREE.MathUtils.clamp(1.75 + separation * 0.05, 1.75, 2.4);

    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, midX * 0.85, 7, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, targetY, 6, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, targetZ, 6, dt);

    if (this.shakeAmount > 0.002) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeAmount;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeAmount;
      this.shakeAmount = THREE.MathUtils.damp(this.shakeAmount, 0, 14, dt);
    }

    this.camera.lookAt(midX * 0.85, isPortrait ? 0.95 : 1.2, 0);
  }

  private updateMascotCat(dt: number, elapsed: number): void {
    if (!this.catGroup) return;
    this.catTail.rotation.z = Math.sin(elapsed * 4.5) * 0.35;
    if (this.catJumpTimer > 0) {
      this.catJumpTimer -= dt;
      this.catGroup.position.y = 0.22 + Math.abs(Math.sin(this.catJumpTimer * Math.PI * 2)) * 0.42;
    } else {
      this.catGroup.position.y = 0.22;
    }
  }

  private updateBlackCatSwarm(dt: number, elapsed: number): void {
    for (let i = 0; i < this.swarmCats.length; i++) {
      const cat = this.swarmCats[i];
      if (!cat.active) continue;
      if (cat.delay > 0) {
        cat.delay -= dt;
        continue;
      }
      cat.group.visible = true;
      cat.life -= dt;
      cat.x += cat.vx * dt;
      const hop = Math.abs(Math.sin(elapsed * 14 + cat.phaseOffset));
      cat.y = hop * 0.65;
      cat.group.position.set(cat.x, cat.y, cat.z);
      cat.group.rotation.z = Math.cos(elapsed * 14 + cat.phaseOffset) * 0.25;
      cat.tail.rotation.z = 0.75 + Math.sin(elapsed * 18 + cat.phaseOffset) * 0.4;
      if (cat.life <= 0) {
        cat.active = false;
        cat.group.visible = false;
      }
    }
  }

  private updateVfx(dt: number): void {
    if (this.shockwaveLife > 0) {
      this.shockwaveLife -= dt;
      const p = 1 - Math.max(0, this.shockwaveLife / 0.24);
      const s = 0.5 + p * 2.9;
      this.shockwaveRing.scale.set(s, s, s);
      (this.shockwaveRing.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.85;
      if (this.shockwaveLife <= 0) this.shockwaveRing.visible = false;
    }

    for (let i = 0; i < this.particles.length; i++) {
      const pt = this.particles[i];
      if (pt.life > 0) {
        pt.life -= dt;
        pt.mesh.position.x += pt.vx * dt;
        pt.mesh.position.y += pt.vy * dt;
        pt.mesh.position.z += pt.vz * dt;
        pt.vy -= 9.5 * dt;
        const alpha = Math.max(0, pt.life / pt.maxLife);
        (pt.mesh.material as THREE.MeshBasicMaterial).opacity = alpha;
        if (pt.life <= 0) pt.mesh.visible = false;
      }
    }

    for (let i = this.damagePopups.length - 1; i >= 0; i--) {
      this.damagePopups[i].life -= dt;
      this.damagePopups[i].y -= dt * 9;
      if (this.damagePopups[i].life <= 0) {
        this.damagePopups.splice(i, 1);
      }
    }
  }

  private computeDebugHitboxes(): HitboxDebugRect[] {
    if (!this.showHitboxes) return [];
    const rects: HitboxDebugRect[] = [];

    [this.p1, this.p2].forEach((f) => {
      const topY = f.state === 'crouch' || f.state === 'crouch_block' ? 1.25 : 1.9;
      const tl = this.projectToPercent(f.x - 0.4, topY + f.y, 0);
      const br = this.projectToPercent(f.x + 0.4, f.y, 0);
      rects.push({
        x: Math.min(tl.x, br.x),
        y: Math.min(tl.y, br.y),
        w: Math.max(4, Math.abs(br.x - tl.x)),
        h: Math.max(8, Math.abs(br.y - tl.y)),
        kind: f.parryWindowTimer > 0 ? 'parry' : 'hurt',
      });

      const spec = MOVES[f.state];
      if (spec.damage > 0 && f.stateTime >= spec.startup && f.stateTime <= spec.startup + spec.active) {
        const reach = spec.range * 0.72 * f.facing;
        const h1 = this.projectToPercent(f.x + reach * 0.25, 1.45 + f.y, 0);
        const h2 = this.projectToPercent(f.x + reach, 0.75 + f.y, 0);
        rects.push({
          x: Math.min(h1.x, h2.x),
          y: Math.min(h1.y, h2.y),
          w: Math.max(4, Math.abs(h2.x - h1.x)),
          h: Math.max(6, Math.abs(h2.y - h1.y)),
          kind: 'hit',
        });
      }
    });

    return rects;
  }

  private emitHud(): void {
    const p1Def = FIGHTERS[this.p1.fighterId];
    const p2Def = FIGHTERS[this.p2.fighterId];

    this.cfg.onHudUpdate({
      p1Hp: this.p1.hp,
      p1MaxHp: this.p1.maxHp,
      p1Energy: Math.round(this.p1.energy),
      p1Stun: Math.round(this.p1.stun),
      p1Combo: this.p1.comboCount,
      p1Multiplier: this.getComboMultiplier(this.p1.comboCount),
      p1Rounds: this.p1.roundsWon,
      p1State: this.p1.state,
      p1Buff: this.p1.buff,
      p1Title: p1Def.title,
      p2Hp: this.p2.hp,
      p2MaxHp: this.p2.maxHp,
      p2Energy: Math.round(this.p2.energy),
      p2Stun: Math.round(this.p2.stun),
      p2Combo: this.p2.comboCount,
      p2Multiplier: this.getComboMultiplier(this.p2.comboCount),
      p2Rounds: this.p2.roundsWon,
      p2State: this.p2.state,
      p2Buff: this.p2.buff,
      p2Title: p2Def.title,
      timer: this.cfg.mode === 'training' ? 99 : Math.ceil(this.roundTimer),
      roundNumber: this.roundNumber,
      bannerText: this.bannerText,
      calloutText: this.calloutText,
      calloutSide: this.calloutSide,
      quoteText: this.quoteText,
      quoteSide: this.quoteSide,
      damagePopups: this.damagePopups.map((d) => ({ ...d })),
      hitboxRects: this.computeDebugHitboxes(),
      showHitboxes: this.showHitboxes,
      isFinisherSlowmo: this.finisherCamTimer > 0,
      isPaused: this.isPaused,
      matchFinished: this.roundPhase === 'match_over',
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    clearTimeout(this.bannerTimer);
    clearTimeout(this.contextLostTimer);
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestored);
    gameAudio.stopStageMusic();

    this.p1?.rig.dispose();
    this.p2?.rig.dispose();
    this.disposables.forEach((d) => d.dispose());
    this.renderer.dispose();
    try {
      this.renderer.forceContextLoss();
    } catch {
      // ignore if already lost
    }
    if (this.renderer.domElement.parentNode === this.cfg.container) {
      this.cfg.container.removeChild(this.renderer.domElement);
    }
  }
}
