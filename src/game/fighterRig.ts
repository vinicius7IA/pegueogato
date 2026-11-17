import * as THREE from 'three';
import { FIGHTERS, getSkinById } from './catalog';
import {
  createAloJucaChestTexture,
  createBaianaLaceTexture,
  createDenimTexture,
  createFabricNormalTexture,
  createPoliceVestTexture,
  createPoloTexture,
  createSkinMicroNormalTexture,
  createSleevePatchTexture,
  createTorcedorFlagTexture,
} from './textures';
import { FighterId, MoveId } from './types';

export interface FighterRigHandles {
  root: THREE.Group;
  pelvis: THREE.Group;
  torso: THREE.Group;
  chest: THREE.Group;
  headGroup: THREE.Group;
  leftBrow: THREE.Mesh;
  rightBrow: THREE.Mesh;
  mouth: THREE.Mesh;
  leftArm: THREE.Group;
  leftForearm: THREE.Group;
  rightArm: THREE.Group;
  rightForearm: THREE.Group;
  leftLeg: THREE.Group;
  leftShin: THREE.Group;
  rightLeg: THREE.Group;
  rightShin: THREE.Group;
  shieldAura: THREE.Mesh;
  speedTrail: THREE.Mesh;
  parryRing: THREE.Mesh;
  capeGroup: THREE.Group | null;
  skirtGroup: THREE.Group | null;
  hairLocksGroup: THREE.Group | null;
  setRedness: (amount: number) => void;
  dispose: () => void;
}

const FLUSHED_RED = new THREE.Color(0xd9302a);

export function buildFighterRig(
  fighterId: FighterId,
  skinId: string,
  authorizationMode = true,
): FighterRigHandles {
  const fighterDef = FIGHTERS[fighterId];
  const skin = getSkinById(skinId);
  const pal = skin.palette;
  const sil = fighterDef.silhouette;

  const isPolice = fighterId === 'policial';
  const isMaluco = fighterId === 'maluco';
  const isCapoeira = fighterId === 'roberto';
  const isBaiana = false; // legado: baiana removida do elenco
  const isTorcedor = fighterId === 'torcedor' || fighterId === 'torcedor_vitoria';
  const isJesse = fighterId === 'jesse';
  const isJuca = fighterId === 'alo_juca';
  const isDani = fighterId === 'alo_dani';
  const isFemale = isDani || isBaiana;
  const isShirtless = isMaluco || isCapoeira;
  const isMuscular = isPolice || isTorcedor || isCapoeira;
  const useSubstituteOutfit = Boolean(fighterDef.requiresAuthorization && !authorizationMode);

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    textures.push(t);
    return t;
  };

  // Procedural linear-space normal maps for skin pores & realistic cloth fibers
  const skinNormalTex = trackTex(createSkinMicroNormalTexture());
  const weaveNormalTex = trackTex(createFabricNormalTexture('weave'));
  const ripstopNormalTex = trackTex(createFabricNormalTexture('ripstop'));
  const denimNormalTex = trackTex(createFabricNormalTexture('denim'));
  const laceNormalTex = trackTex(createFabricNormalTexture('lace'));

  const baseSkinColor = new THREE.Color(pal.skin);
  const darkerSkinColor = baseSkinColor.clone().multiplyScalar(0.84);
  const lipColor = baseSkinColor.clone().lerp(new THREE.Color(0x8c423b), isFemale ? 0.58 : 0.36);

  // Standard matte skin & hair materials
  const skinMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: pal.skin,
      normalMap: skinNormalTex,
      normalScale: new THREE.Vector2(0.28, 0.28),
      roughness: 0.76,
      metalness: 0.02,
    }),
  );

  const lidSkinMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: darkerSkinColor,
      normalMap: skinNormalTex,
      normalScale: new THREE.Vector2(0.2, 0.2),
      roughness: 0.78,
    }),
  );

  const lipMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: lipColor,
      roughness: isFemale ? 0.55 : 0.7,
    }),
  );

  const cheekSlapMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd92626,
      roughness: 0.72,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );

  const backSlapMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xb93c34,
      normalMap: skinNormalTex,
      normalScale: new THREE.Vector2(0.25, 0.25),
      roughness: 0.76,
      transparent: true,
      opacity: 0.44,
      depthWrite: false,
    }),
  );

  const hairMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: pal.hair,
      roughness: 0.85,
      metalness: 0.02,
    }),
  );

  const stubbleMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(pal.hair).lerp(baseSkinColor, 0.42),
      normalMap: skinNormalTex,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.85,
    }),
  );

  const topHex = '#' + pal.top.toString(16).padStart(6, '0');
  const trimHex = '#' + pal.vestOrTrim.toString(16).padStart(6, '0');
  const poloTex = isJuca || isDani ? trackTex(createPoloTexture(topHex, trimHex)) : null;
  const vestTex = isPolice ? trackTex(createPoliceVestTexture()) : null;
  const denimTex = isJesse && pal.pants === 0x2d537a ? trackTex(createDenimTexture()) : null;
  const baianaLaceTex = isBaiana
    ? trackTex(createBaianaLaceTexture('#' + pal.pants.toString(16).padStart(6, '0'), trimHex))
    : null;
  const torcedorFlagTex = isTorcedor ? trackTex(createTorcedorFlagTexture(topHex, trimHex)) : null;

  const topMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: poloTex ? 0xffffff : pal.top,
      map: poloTex || undefined,
      normalMap: isPolice ? ripstopNormalTex : weaveNormalTex,
      normalScale: new THREE.Vector2(0.42, 0.42),
      roughness: 0.86,
      metalness: 0.02,
    }),
  );

  const vestMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: vestTex ? 0xffffff : pal.vestOrTrim,
      map: vestTex || undefined,
      normalMap: isPolice ? ripstopNormalTex : weaveNormalTex,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughness: 0.84,
      metalness: isPolice ? 0.06 : 0.02,
    }),
  );

  const pantsMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: denimTex ? 0xffffff : pal.pants,
      map: denimTex || undefined,
      normalMap: denimTex ? denimNormalTex : isPolice ? ripstopNormalTex : weaveNormalTex,
      normalScale: new THREE.Vector2(isPolice ? 0.22 : 0.5, isPolice ? 0.22 : 0.5),
      roughness: 0.88,
      metalness: 0.02,
    }),
  );

  const gloveMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: pal.glovesOrWraps,
      normalMap: isPolice || isJesse ? ripstopNormalTex : skinNormalTex,
      normalScale: new THREE.Vector2(0.3, 0.3),
      roughness: isPolice || isJesse ? 0.58 : 0.72,
      metalness: 0.04,
    }),
  );

  const accentMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: pal.accent,
      roughness: 0.55,
      metalness: 0.15,
    }),
  );

  const metalMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd4d4d8,
      roughness: 0.38,
      metalness: 0.75,
    }),
  );

  const brassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xeab308,
      roughness: 0.4,
      metalness: 0.72,
    }),
  );

  const bootMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x15161c,
      normalMap: ripstopNormalTex,
      normalScale: new THREE.Vector2(0.3, 0.3),
      roughness: 0.65,
      metalness: 0.08,
    }),
  );

  const soleMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x09090b,
      roughness: 0.88,
      metalness: 0.04,
    }),
  );

  const woodMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x92400e,
      roughness: 0.58,
      metalness: 0.04,
    }),
  );

  const darkFeatureMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x070709, roughness: 0.22, metalness: 0.08 }),
  );
  const eyeWhiteMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf4f4f6,
      roughness: 0.38,
    }),
  );
  const irisMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: isDani ? 0x3b2314 : 0x26170e,
      roughness: 0.42,
    }),
  );
  const teethMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xf8f8f5, roughness: 0.45 }),
  );

  const root = new THREE.Group();
  root.scale.setScalar(sil.heightScale);

  const pelvis = new THREE.Group();
  pelvis.position.set(0, 0.95, 0);
  root.add(pelvis);

  // Sculpted Anatomical Pelvis / Glutes + Hip Block
  const girth = sil.girth ?? 1;
  const hipWidth = (isPolice || isTorcedor ? 0.37 : isDani ? 0.32 : 0.335) * Math.min(1.12, sil.shoulderScale) * (1 + (girth - 1) * 0.6);
  const pelvisGeo = trackGeo(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.085, -0.09),
        new THREE.Vector2(isDani ? 0.158 : 0.168, -0.03),
        new THREE.Vector2(isPolice || isTorcedor ? 0.184 : isDani ? 0.165 : 0.172, 0.03),
        new THREE.Vector2(isPolice || isTorcedor ? 0.176 : isDani ? 0.14 : 0.158, 0.095),
      ],
      24,
    ),
  );
  const pelvisMesh = new THREE.Mesh(pelvisGeo, pantsMat);
  pelvisMesh.scale.set(1.14, 1, isDani ? 0.84 : 0.78);
  pelvisMesh.castShadow = true;
  pelvisMesh.receiveShadow = true;
  pelvis.add(pelvisMesh);

  // Detailed Tactical Belt / Cordão / Leather Dress Belt
  const beltMesh = new THREE.Mesh(
    trackGeo(
      new THREE.CylinderGeometry(
        isPolice || isTorcedor ? 0.182 : isDani ? 0.146 : 0.162,
        isPolice || isTorcedor ? 0.185 : isDani ? 0.149 : 0.164,
        isCapoeira ? 0.072 : isDani ? 0.036 : 0.056,
        24,
      ),
    ),
    isCapoeira ? vestMat : isPolice || isJuca || isDani || isJesse ? bootMat : pantsMat,
  );
  beltMesh.scale.set(1.14, 1, 0.79);
  beltMesh.position.y = 0.082;
  beltMesh.castShadow = true;
  pelvis.add(beltMesh);

  if (isCapoeira) {
    const tailGeo = trackGeo(new THREE.CylinderGeometry(0.015, 0.01, 0.34, 10));
    [-0.03, 0.02].forEach((tz, idx) => {
      const cTail = new THREE.Mesh(tailGeo, idx === 0 ? vestMat : accentMat);
      cTail.position.set(-0.18, -0.06, tz);
      cTail.rotation.z = 0.22;
      cTail.castShadow = true;
      pelvis.add(cTail);
    });
  }

  if (isPolice || isJuca || isDani || isJesse) {
    const buckleFrame = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(isDani ? 0.042 : 0.074, isDani ? 0.034 : 0.052, 0.022)),
      isPolice ? brassMat : metalMat,
    );
    buckleFrame.position.set(0, 0.082, 0.145);
    pelvis.add(buckleFrame);

    if (isPolice) {
      // Tactical duty belt holsters & mag pouches
      [-0.175, 0.175].forEach((hx) => {
        const dutyPouch = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(0.068, 0.11, 0.088)),
          bootMat,
        );
        dutyPouch.position.set(hx, 0.025, 0.02);
        dutyPouch.castShadow = true;
        pelvis.add(dutyPouch);
      });
    }
  }

  // Baiana layered lace bell skirt with realistic weave normal map
  let skirtGroup: THREE.Group | null = null;
  if (isBaiana && baianaLaceTex) {
    skirtGroup = new THREE.Group();
    skirtGroup.position.y = 0.05;
    pelvis.add(skirtGroup);
    const skirtMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: baianaLaceTex,
        normalMap: laceNormalTex,
        normalScale: new THREE.Vector2(0.5, 0.5),
        roughness: 0.85,
        side: THREE.DoubleSide,
      }),
    );
    const skirtProfile = [
      new THREE.Vector2(0.18, 0.02),
      new THREE.Vector2(0.28, -0.14),
      new THREE.Vector2(0.38, -0.38),
      new THREE.Vector2(0.45, -0.62),
      new THREE.Vector2(0.49, -0.76),
    ];
    const skirtMesh = new THREE.Mesh(trackGeo(new THREE.LatheGeometry(skirtProfile, 28)), skirtMat);
    skirtMesh.castShadow = true;
    skirtMesh.receiveShadow = true;
    skirtGroup.add(skirtMesh);
  }

  const torso = new THREE.Group();
  torso.position.set(0, 0.1, 0);
  pelvis.add(torso);
  // Policial usa o perfil de cintura; os demais escalam o tronco inteiro (magro < 1 < corpulento)
  if (!isPolice && girth !== 1) torso.scale.set(girth, 1, girth);

  // High-resolution anatomical torso profile (waist -> obliques -> lats -> chest -> trapezius)
  const shoulderScale = sil.shoulderScale;
  const girthK = (w: number) => 1 + (girth - 1) * w;
  const waistProfile =
    isPolice || isTorcedor
      ? [
          new THREE.Vector2(0.158 * girthK(1), 0),
          new THREE.Vector2(0.174 * girthK(1), 0.09),
          new THREE.Vector2(0.198 * girthK(1.05), 0.2),
          new THREE.Vector2(0.228 * girthK(0.9), 0.31),
          new THREE.Vector2(0.248 * Math.min(1.12, shoulderScale * 0.9) * girthK(0.55), 0.39),
          new THREE.Vector2(0.21 * girthK(0.4), 0.46),
          new THREE.Vector2(0.14, 0.49),
        ]
      : isDani
        ? [
            new THREE.Vector2(0.128, 0),
            new THREE.Vector2(0.114, 0.11),
            new THREE.Vector2(0.128, 0.21),
            new THREE.Vector2(0.156, 0.32),
            new THREE.Vector2(0.165, 0.4),
            new THREE.Vector2(0.135, 0.46),
            new THREE.Vector2(0.095, 0.49),
          ]
        : isMaluco || isCapoeira
          ? [
              new THREE.Vector2(0.14, 0),
              new THREE.Vector2(0.138, 0.11),
              new THREE.Vector2(0.165, 0.22),
              new THREE.Vector2(0.196, 0.33),
              new THREE.Vector2(0.212, 0.4),
              new THREE.Vector2(0.172, 0.47),
              new THREE.Vector2(0.115, 0.5),
            ]
          : [
              new THREE.Vector2(0.145, 0),
              new THREE.Vector2(0.154, 0.11),
              new THREE.Vector2(0.178, 0.23),
              new THREE.Vector2(0.202, 0.34),
              new THREE.Vector2(0.212, 0.4),
              new THREE.Vector2(0.168, 0.47),
              new THREE.Vector2(0.115, 0.5),
            ];

  const torsoLathe = new THREE.Mesh(
    trackGeo(new THREE.LatheGeometry(waistProfile, 28)),
    isShirtless ? skinMat : topMat,
  );
  torsoLathe.scale.set(1.16, 1, 0.74);
  torsoLathe.castShadow = true;
  torsoLathe.receiveShadow = true;
  torso.add(torsoLathe);

  // Sculpted abdominal definition for shirtless fighters (O Maluco & Capoeira)
  if (isShirtless) {
    for (let row = 0; row < 3; row++) {
      [-0.042, 0.042].forEach((ax) => {
        const ab = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.036, 10, 8)), skinMat);
        ab.scale.set(1.0, 0.78, 0.48);
        ab.position.set(ax, 0.19 - row * 0.056, 0.116 - row * 0.006);
        torso.add(ab);
      });
    }
  }

  const chest = new THREE.Group();
  chest.position.set(0, 0.28, 0);
  torso.add(chest);

  const shoulderSpan = (isPolice || isTorcedor ? 0.52 : isDani ? 0.39 : 0.455) * (0.9 + shoulderScale * 0.1);

  // Sculpted anatomical deltoid & clavicle caps
  [-1, 1].forEach((side) => {
    const delt = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(isPolice || isTorcedor ? 0.088 : isDani ? 0.058 : 0.076, 18, 14)),
      isShirtless ? skinMat : topMat,
    );
    delt.scale.set(0.95, 1.12, 0.88);
    delt.position.set(side * (shoulderSpan * 0.46), 0.155, 0);
    delt.castShadow = true;
    chest.add(delt);

    if (isShirtless) {
      // Collarbone sculpt
      const clav = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.014, 0.11, 5, 8)), skinMat);
      clav.rotation.z = side * (Math.PI / 2 - 0.14);
      clav.position.set(side * 0.095, 0.175, 0.075);
      chest.add(clav);
    }
  });

  // Character-specific Realistic Torso Gear & Anatomy
  let capeGroup: THREE.Group | null = null;
  if (isMaluco || isCapoeira) {
    [-0.084, 0.084].forEach((px) => {
      const pec = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.088, 14, 10)), skinMat);
      pec.scale.set(1.15, 0.74, 0.54);
      pec.position.set(px, 0.068, 0.096);
      pec.castShadow = true;
      chest.add(pec);
    });
    if (isMaluco) {
      // Realistic slap handprint / sun-flushed welt on upper back
      const backMark = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.11, 12, 10)), backSlapMat);
      backMark.scale.set(1.12, 0.85, 0.14);
      backMark.position.set(0.02, 0.06, -0.13);
      chest.add(backMark);
    }
    if (isCapoeira) {
      const necklace = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.105, 0.011, 8, 22)), accentMat);
      necklace.rotation.x = Math.PI / 2.2;
      necklace.position.set(0, 0.185, 0.02);
      chest.add(necklace);
    }
  } else if (isBaiana) {
    [0xfacc15, 0xef4444, 0x38bdf8].forEach((col, idx) => {
      const guiaMat = trackMat(
        new THREE.MeshStandardMaterial({ color: col, roughness: 0.55 }),
      );
      const guia = new THREE.Mesh(
        trackGeo(new THREE.TorusGeometry(0.115 + idx * 0.02, 0.011, 10, 24)),
        guiaMat,
      );
      guia.rotation.x = Math.PI / 2.6;
      guia.position.set(0, 0.15 - idx * 0.035, 0.045);
      chest.add(guia);
    });
  } else if (isTorcedor) {
    const sash = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.36, 0.085, 0.25)), vestMat);
    sash.position.set(0, 0.05, 0.02);
    chest.add(sash);

    if (torcedorFlagTex) {
      capeGroup = new THREE.Group();
      capeGroup.position.set(0, 0.18, -0.17);
      chest.add(capeGroup);
      const capeMat = trackMat(
        new THREE.MeshStandardMaterial({
          map: torcedorFlagTex,
          normalMap: weaveNormalTex,
          normalScale: new THREE.Vector2(0.4, 0.4),
          roughness: 0.86,
          side: THREE.DoubleSide,
        }),
      );
      const capeMesh = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.56, 0.88, 6, 8)), capeMat);
      capeMesh.position.set(0, -0.44, -0.02);
      capeMesh.rotation.x = 0.16;
      capeMesh.castShadow = true;
      capeGroup.add(capeMesh);
    }
  } else if (isPolice) {
    // Sculpted ballistic plate carrier (front & rear trauma plates + MOLLE webbing + comms)
    const vestLathe = new THREE.Mesh(
      trackGeo(
        new THREE.LatheGeometry(
          [
            new THREE.Vector2(0.205, -0.18),
            new THREE.Vector2(0.222, -0.04),
            new THREE.Vector2(0.236, 0.12),
            new THREE.Vector2(0.195, 0.21),
          ],
          24,
        ),
      ),
      vestMat,
    );
    vestLathe.scale.set(1.16, 1, 0.8);
    vestLathe.castShadow = true;
    vestLathe.receiveShadow = true;
    chest.add(vestLathe);

    // Front Kevlar plate bevel
    const frontPlate = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.27, 0.26, 0.036)),
      vestMat,
    );
    frontPlate.position.set(0, 0.04, 0.165);
    frontPlate.castShadow = true;
    chest.add(frontPlate);

    // Padded shoulder straps + D-rings
    [-0.135, 0.135].forEach((sx) => {
      const strap = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.088, 0.058, 0.255)), vestMat);
      strap.position.set(sx, 0.205, 0);
      strap.castShadow = true;
      chest.add(strap);
    });

    // Triple magazine pouches
    [-0.11, 0, 0.11].forEach((px) => {
      const pouch = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.072, 0.105, 0.055)), bootMat);
      pouch.position.set(px, -0.09, 0.182);
      pouch.castShadow = true;
      chest.add(pouch);
    });

    // Metallic state police crest
    const badge = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.038, 0.038, 0.016, 8)), brassMat);
    badge.rotation.x = Math.PI / 2;
    badge.position.set(0.115, 0.105, 0.186);
    chest.add(badge);

    // Shoulder PTT radio + whip antenna
    const radio = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.046, 0.092, 0.036)), bootMat);
    radio.position.set(-0.145, 0.135, 0.145);
    chest.add(radio);

    const antenna = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.004, 0.007, 0.125, 8)), darkFeatureMat);
    antenna.position.set(-0.145, 0.23, 0.145);
    chest.add(antenna);
  } else if (isJuca) {
    const placket = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.044, 0.16, 0.016)), vestMat);
    placket.position.set(0, 0.11, 0.145);
    chest.add(placket);
    [0.14, 0.08].forEach((by) => {
      const btn = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.008, 0.008, 0.01, 10)), bootMat);
      btn.rotation.x = Math.PI / 2;
      btn.position.set(0, by, 0.155);
      chest.add(btn);
    });
  } else if (isDani) {
    const placket = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.036, 0.13, 0.014)), vestMat);
    placket.position.set(0, 0.11, 0.132);
    chest.add(placket);

    const lapelMic = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.026, 0.036, 0.02)), bootMat);
    lapelMic.position.set(0, 0.065, 0.142);
    chest.add(lapelMic);
  } else if (isJesse) {
    if (!useSubstituteOutfit) {
      const jucaLogoTex = trackTex(createAloJucaChestTexture());
      const jucaLogoMat = trackMat(
        new THREE.MeshStandardMaterial({ map: jucaLogoTex, normalMap: weaveNormalTex, roughness: 0.82 }),
      );
      const logoPlate = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.19, 0.16)), jucaLogoMat);
      logoPlate.position.set(0, 0.07, 0.152);
      chest.add(logoPlate);
    }
    [-0.105, 0.105].forEach((sx) => {
      const packStrap = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.034, 0.34, 0.022)), bootMat);
      packStrap.position.set(sx, 0.04, 0.135);
      chest.add(packStrap);
    });
  }

  // Sculpted Realistic Human Head & Facial Anatomy
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.24, 0);
  headGroup.scale.setScalar(sil.headScale);
  chest.add(headGroup);

  // Anatomical Neck with Sternocleidomastoid taper
  const neckGeo = trackGeo(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(isPolice ? 0.084 : isDani ? 0.056 : 0.072, -0.015),
        new THREE.Vector2(isPolice ? 0.072 : isDani ? 0.048 : 0.062, 0.045),
        new THREE.Vector2(isPolice ? 0.068 : isDani ? 0.046 : 0.059, 0.105),
      ],
      20,
    ),
  );
  const neck = new THREE.Mesh(neckGeo, skinMat);
  neck.castShadow = true;
  headGroup.add(neck);

  if (isPolice || isJuca || isDani || isJesse) {
    const collar = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(isDani ? 0.07 : 0.084, isDani ? 0.016 : 0.022, 10, 22)),
      isDani ? vestMat : topMat,
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.008;
    headGroup.add(collar);
  }

  // Sculpted Cranium + Cheekbones + Jawline + Chin
  const cranium = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.128, 28, 24)), skinMat);
  cranium.scale.set(0.91, 1.12, 0.99);
  cranium.position.set(0, 0.2, -0.004);
  cranium.castShadow = true;
  cranium.receiveShadow = true;
  headGroup.add(cranium);

  // Mandible / Jawline sculpt
  const jawGeo = trackGeo(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.032, 0.074),
        new THREE.Vector2(0.068, 0.092),
        new THREE.Vector2(0.095, 0.132),
        new THREE.Vector2(0.102, 0.178),
      ],
      24,
    ),
  );
  const jaw = new THREE.Mesh(jawGeo, isPolice || isTorcedor ? stubbleMat : skinMat);
  jaw.scale.set(isDani ? 0.84 : 0.96, 1, 1.04);
  jaw.position.set(0, 0.005, 0.018);
  jaw.castShadow = true;
  headGroup.add(jaw);

  // Chin prominence
  const chin = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.036, 12, 10)), isPolice || isTorcedor ? stubbleMat : skinMat);
  chin.scale.set(1.1, 0.85, 0.95);
  chin.position.set(0, 0.094, 0.094);
  headGroup.add(chin);

  // Zygomatic cheekbones + supraorbital brow ridge
  [-1, 1].forEach((side) => {
    const cheek = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.044, 12, 10)), skinMat);
    cheek.scale.set(0.92, 0.72, 0.82);
    cheek.position.set(side * 0.064, 0.168, 0.088);
    headGroup.add(cheek);

    const browArch = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.014, 0.042, 6, 10)), skinMat);
    browArch.rotation.z = Math.PI / 2 - side * 0.08;
    browArch.position.set(side * 0.044, 0.222, 0.112);
    headGroup.add(browArch);
  });

  // Dynamic Slap Flush Erythema on Cheek
  const cheekSlapMark = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.056, 12, 10)), cheekSlapMat);
  cheekSlapMark.scale.set(0.55, 0.88, 0.82);
  cheekSlapMark.position.set(0.084, 0.165, 0.086);
  headGroup.add(cheekSlapMark);

  // Anatomically Sculpted Nose (Bridge + Tip + Nostril Wings — no cone!)
  const noseBridge = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.012, 0.034, 6, 10)), skinMat);
  noseBridge.rotation.x = -0.32;
  noseBridge.position.set(0, 0.184, 0.123);
  headGroup.add(noseBridge);

  const noseTip = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.017, 12, 10)), skinMat);
  noseTip.scale.set(1.05, 0.88, 1.0);
  noseTip.position.set(0, 0.162, 0.134);
  headGroup.add(noseTip);

  [-0.014, 0.014].forEach((nx) => {
    const nostril = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.0095, 8, 8)), skinMat);
    nostril.position.set(nx, 0.158, 0.126);
    headGroup.add(nostril);
  });

  // Sculpted Ears (Outer Helix + Lobe)
  [-1, 1].forEach((side) => {
    const ear = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.02, 0.0085, 8, 14)), skinMat);
    ear.scale.set(0.65, 1.25, 0.7);
    ear.rotation.y = side * 0.35;
    ear.position.set(side * 0.114, 0.186, -0.004);
    headGroup.add(ear);

    const lobe = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.012, 8, 8)), skinMat);
    lobe.position.set(side * 0.112, 0.162, 0.0);
    headGroup.add(lobe);
  });

  // Torcedor Bahia face paint stripes
  if (isTorcedor) {
    [-0.082, 0.082].forEach((cx) => {
      const paint = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.034, 0.012, 0.012)), accentMat);
      paint.position.set(cx, 0.162, 0.108);
      headGroup.add(paint);
    });
  }

  // Deep Orbital Sockets + Upper/Lower Eyelids + Glossy Corneal Eyes
  [-0.042, 0.042].forEach((ex) => {
    const socket = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.023, 12, 10)), lidSkinMat);
    socket.scale.set(1.22, 0.85, 0.45);
    socket.position.set(ex, 0.201, 0.11);
    headGroup.add(socket);

    const sclera = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.0185, 14, 12)), eyeWhiteMat);
    sclera.scale.set(1.16, 0.78, 0.65);
    sclera.position.set(ex, 0.201, 0.115);
    headGroup.add(sclera);

    const iris = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.011, 12, 10)), irisMat);
    iris.scale.set(1, 1, 0.55);
    iris.position.set(ex, 0.201, 0.123);
    headGroup.add(iris);

    const pupil = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.0058, 10, 8)), darkFeatureMat);
    pupil.position.set(ex, 0.201, 0.127);
    headGroup.add(pupil);

    // Upper Eyelid fold
    const upperLid = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.006, 0.026, 4, 8)), lidSkinMat);
    upperLid.rotation.z = Math.PI / 2;
    upperLid.position.set(ex, 0.211, 0.121);
    headGroup.add(upperLid);
  });

  const leftBrow = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.0065, 0.034, 5, 8)), hairMat);
  leftBrow.rotation.z = Math.PI / 2;
  leftBrow.position.set(-0.043, 0.228, 0.122);
  headGroup.add(leftBrow);

  const rightBrow = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.0065, 0.034, 5, 8)), hairMat);
  rightBrow.rotation.z = Math.PI / 2;
  rightBrow.position.set(0.043, 0.228, 0.122);
  headGroup.add(rightBrow);

  // Sculpted Upper/Lower Lips + Expressive Mouth Cavity (animateFighterRig scales `mouth`)
  const upperLip = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.0065, 0.034, 5, 8)), lipMat);
  upperLip.rotation.z = Math.PI / 2;
  upperLip.position.set(0, 0.131, 0.118);
  headGroup.add(upperLip);

  const lowerLip = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.007, 0.028, 5, 8)), lipMat);
  lowerLip.rotation.z = Math.PI / 2;
  lowerLip.position.set(0, 0.116, 0.117);
  headGroup.add(lowerLip);

  const mouth = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.0085, 0.038, 5, 8)),
    isMaluco || isJuca || isCapoeira ? teethMat : darkFeatureMat,
  );
  mouth.rotation.z = Math.PI / 2;
  mouth.position.set(0, 0.123, 0.118);
  headGroup.add(mouth);

  // Stylized reporter visor when likeness authorizationMode is OFF
  if (useSubstituteOutfit) {
    const visor = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.205, 0.048, 0.076)),
      trackMat(
        new THREE.MeshStandardMaterial({
          color: 0x0ea5e9,
          roughness: 0.35,
          metalness: 0.5,
        }),
      ),
    );
    visor.position.set(0, 0.201, 0.11);
    headGroup.add(visor);
  }

  let hairLocksGroup: THREE.Group | null = null;

  // High-detail Hairstyles & Headgear
  if (isMaluco) {
    const curlGeo = trackGeo(new THREE.SphereGeometry(0.042, 10, 10));
    for (let i = 0; i < 52; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / 52);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const r = 0.136;
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = 0.215 + r * Math.cos(phi) * 0.96;
      const z = r * Math.sin(phi) * Math.sin(theta) - 0.022;
      if (z > 0.048 && y < 0.268) continue;
      const curl = new THREE.Mesh(curlGeo, hairMat);
      curl.position.set(x, y, z);
      curl.scale.setScalar(0.82 + (i % 3) * 0.2);
      curl.castShadow = true;
      headGroup.add(curl);
    }
  } else if (isPolice) {
    const buzzCap = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.13, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.52)),
      hairMat,
    );
    buzzCap.scale.set(0.92, 1.11, 0.99);
    buzzCap.position.set(0, 0.205, -0.008);
    headGroup.add(buzzCap);

    // Óculos (marca registrada do Beto): lentes escuras, aro e hastes
    const frameMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.35, metalness: 0.5 }));
    const lensMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x22303d, roughness: 0.12, metalness: 0.7, transparent: true, opacity: 0.85 }));
    [-0.045, 0.045].forEach((lx) => {
      const lens = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.058, 0.034, 0.008)), lensMat);
      lens.position.set(lx, 0.198, 0.128);
      headGroup.add(lens);
      const rim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.062, 0.008, 0.012)), frameMat);
      rim.position.set(lx, 0.217, 0.128);
      headGroup.add(rim);
      const temple = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.008, 0.008, 0.12)), frameMat);
      temple.position.set(lx > 0 ? 0.106 : -0.106, 0.21, 0.07);
      headGroup.add(temple);
    });
    const bridge = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.03, 0.008, 0.01)), frameMat);
    bridge.position.set(0, 0.208, 0.13);
    headGroup.add(bridge);
  } else if (isCapoeira) {
    const band = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.129, 0.02, 10, 24)), accentMat);
    band.rotation.x = Math.PI / 2;
    band.position.set(0, 0.245, 0);
    headGroup.add(band);

    hairLocksGroup = new THREE.Group();
    headGroup.add(hairLocksGroup);
    const lockGeo = trackGeo(new THREE.CapsuleGeometry(0.019, 0.15, 6, 10));
    [-0.08, -0.04, 0, 0.04, 0.08].forEach((lx, i) => {
      const lock = new THREE.Mesh(lockGeo, hairMat);
      lock.position.set(lx, 0.22 - (i % 2) * 0.02, -0.125);
      lock.rotation.x = 0.45;
      lock.castShadow = true;
      hairLocksGroup!.add(lock);
    });
  } else if (isBaiana) {
    const turbanBase = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.142, 22, 18)), topMat);
    turbanBase.scale.set(1.04, 0.85, 1.05);
    turbanBase.position.set(0, 0.245, -0.008);
    turbanBase.castShadow = true;
    headGroup.add(turbanBase);

    const turbanWrap = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.136, 0.034, 12, 24)), topMat);
    turbanWrap.rotation.x = Math.PI / 2;
    turbanWrap.position.set(0, 0.275, -0.005);
    headGroup.add(turbanWrap);

    const turbanKnot = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.056, 14, 10)), vestMat);
    turbanKnot.position.set(0.06, 0.315, 0.06);
    headGroup.add(turbanKnot);
  } else if (isTorcedor) {
    const capDome = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.138, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.55)),
      topMat,
    );
    capDome.position.set(0, 0.21, -0.005);
    capDome.castShadow = true;
    headGroup.add(capDome);

    const backVisor = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 0.016, 0.095)), vestMat);
    backVisor.position.set(0, 0.225, -0.145);
    backVisor.rotation.x = -0.18;
    headGroup.add(backVisor);
  } else if (isJesse) {
    const mustache = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.008, 0.036, 5, 8)), hairMat);
    mustache.rotation.z = Math.PI / 2;
    mustache.position.set(0, 0.141, 0.123);
    headGroup.add(mustache);

    const helmetMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x16181f,
        roughness: 0.45,
        metalness: 0.15,
      }),
    );
    const helmetShell = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.156, 26, 20, -Math.PI * 0.28, Math.PI * 1.56, 0, Math.PI * 0.76)),
      helmetMat,
    );
    helmetShell.rotation.y = Math.PI * 0.5;
    helmetShell.position.set(0, 0.21, -0.012);
    helmetShell.castShadow = true;
    headGroup.add(helmetShell);

    const helmetBrim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.168, 0.016, 0.072)), helmetMat);
    helmetBrim.rotation.x = 0.22;
    helmetBrim.position.set(0, 0.275, 0.13);
    headGroup.add(helmetBrim);

    const camMount = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.012, 0.016, 0.036, 10)), bootMat);
    camMount.position.set(0, 0.37, 0.01);
    headGroup.add(camMount);

    const actionCam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.062, 0.044, 0.04)), bootMat);
    actionCam.position.set(0, 0.402, 0.015);
    actionCam.castShadow = true;
    headGroup.add(actionCam);

    const camLens = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.014, 0.014, 0.014, 14)), metalMat);
    camLens.rotation.x = Math.PI / 2;
    camLens.position.set(0.012, 0.402, 0.038);
    headGroup.add(camLens);
  } else if (isJuca) {
    const topHair = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.134, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.56)),
      hairMat,
    );
    topHair.scale.set(0.95, 1.09, 1.02);
    topHair.position.set(0, 0.21, -0.01);
    headGroup.add(topHair);
  } else if (isDani) {
    const crownHair = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.136, 22, 18, 0, Math.PI * 2, 0, Math.PI * 0.62)),
      hairMat,
    );
    crownHair.position.set(0, 0.21, -0.01);
    headGroup.add(crownHair);

    hairLocksGroup = new THREE.Group();
    headGroup.add(hairLocksGroup);

    [-0.095, 0, 0.095].forEach((hx) => {
      const lock = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.052, 0.24, 8, 12)), hairMat);
      lock.position.set(hx, 0.08, -0.085);
      lock.castShadow = true;
      hairLocksGroup!.add(lock);
    });

    [-0.112, 0.112].forEach((sx) => {
      const sideLock = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.034, 0.22, 8, 10)), hairMat);
      sideLock.position.set(sx, 0.07, 0.025);
      hairLocksGroup!.add(sideLock);

      const hoop = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.02, 0.004, 8, 18)), brassMat);
      hoop.rotation.y = Math.PI / 2;
      hoop.position.set(sx * 1.12, 0.155, 0.01);
      headGroup.add(hoop);
    });
  }

  const patchTex = isPolice ? trackTex(createSleevePatchTexture()) : null;
  const patchMat = patchTex
    ? trackMat(new THREE.MeshStandardMaterial({ map: patchTex, normalMap: ripstopNormalTex, roughness: 0.78 }))
    : null;

  // Sculpted Muscular Arms + Articulated Hands/Fingers + Tactical Gloves
  const upperArmScale = isMuscular ? 1.16 : isDani ? 0.76 : 0.96;
  const buildArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * (shoulderSpan * 0.46), 0.15, 0);
    chest.add(shoulder);

    const upperLen = 0.26;
    const upperGeo = trackGeo(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.044 * upperArmScale, -upperLen),
          new THREE.Vector2(0.05 * upperArmScale, -upperLen * 0.65),
          new THREE.Vector2(0.06 * upperArmScale, -upperLen * 0.35),
          new THREE.Vector2(0.056 * upperArmScale, 0),
        ],
        20,
      ),
    );
    const upperArm = new THREE.Mesh(upperGeo, isShirtless ? skinMat : topMat);
    upperArm.castShadow = true;
    upperArm.receiveShadow = true;
    shoulder.add(upperArm);

    if (isDani) {
      const cuffTrim = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.042, 0.042, 0.022, 16)), bootMat);
      cuffTrim.position.y = -upperLen + 0.035;
      shoulder.add(cuffTrim);
    }

    if (isPolice && patchMat) {
      const patch = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.012, 0.065, 0.055)), patchMat);
      patch.position.set(side * 0.06, -0.09, 0);
      shoulder.add(patch);
    }

    const forearm = new THREE.Group();
    forearm.position.set(0, -upperLen, 0);
    shoulder.add(forearm);

    const foreLen = 0.25;
    const foreMat = isPolice || isJesse ? topMat : skinMat;
    const foreGeo = trackGeo(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.034 * upperArmScale, -foreLen),
          new THREE.Vector2(0.044 * upperArmScale, -foreLen * 0.52),
          new THREE.Vector2(0.052 * upperArmScale, -foreLen * 0.2),
          new THREE.Vector2(0.044 * upperArmScale, 0),
        ],
        20,
      ),
    );
    const foreMesh = new THREE.Mesh(foreGeo, foreMat);
    foreMesh.castShadow = true;
    foreMesh.receiveShadow = true;
    forearm.add(foreMesh);

    // Rolled sleeve cuff for Juca / Police
    if (isPolice || isJesse) {
      const gloveCuff = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.043 * upperArmScale, 0.041 * upperArmScale, 0.048, 16)),
        gloveMat,
      );
      gloveCuff.position.y = -foreLen + 0.012;
      forearm.add(gloveCuff);
    }

    if ((isJuca || isDani) && side === 1) {
      const watchStrap = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(isDani ? 0.036 : 0.044, isDani ? 0.036 : 0.044, 0.028, 16)),
        bootMat,
      );
      watchStrap.position.set(0, -foreLen + 0.035, 0);
      forearm.add(watchStrap);

      const watchFace = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(isDani ? 0.018 : 0.022, isDani ? 0.018 : 0.022, 0.012, 16)),
        metalMat,
      );
      watchFace.rotation.z = Math.PI / 2;
      watchFace.position.set(isDani ? 0.035 : 0.042, -foreLen + 0.035, 0);
      forearm.add(watchFace);
    }

    // Articulated Sculpted Fist / Hand (Palm + Knuckle Guard + Curled Fingers + Thumb)
    const handGroup = new THREE.Group();
    handGroup.position.set(0, -foreLen - 0.022, 0);
    handGroup.scale.setScalar(sil.fistScale * (isDani ? 0.8 : 1.0));
    forearm.add(handGroup);

    const palm = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.046, 0.068, 0.072)), gloveMat);
    palm.castShadow = true;
    handGroup.add(palm);

    const knuckleBar = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.014, 0.048, 5, 10)),
      isJesse ? bootMat : gloveMat,
    );
    knuckleBar.rotation.x = Math.PI / 2;
    knuckleBar.position.set(side * -0.014, -0.032, 0.008);
    handGroup.add(knuckleBar);

    for (let f = 0; f < 4; f++) {
      const finger = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.009, 0.028, 4, 8)), gloveMat);
      finger.position.set(side * -0.008, -0.046, -0.024 + f * 0.016);
      finger.rotation.z = side * 0.45;
      finger.castShadow = true;
      handGroup.add(finger);
    }

    const thumb = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.01, 0.026, 4, 8)), gloveMat);
    thumb.position.set(side * -0.024, -0.012, 0.034);
    thumb.rotation.x = 0.65;
    handGroup.add(thumb);

    // Baiana signature Colher de Pau in right hand
    if (isBaiana && side === 1) {
      const spoonHandle = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.011, 0.013, 0.42, 10)), woodMat);
      spoonHandle.rotation.x = Math.PI / 2;
      spoonHandle.position.set(0, -foreLen - 0.04, 0.16);
      forearm.add(spoonHandle);

      const spoonBowl = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.048, 14, 10)), woodMat);
      spoonBowl.scale.set(0.85, 0.32, 1.25);
      spoonBowl.position.set(0, -foreLen - 0.04, 0.38);
      forearm.add(spoonBowl);
    }

    // Torcedor golden Corneta horn in right hand
    if (isTorcedor && side === 1) {
      const horn = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.048, 0.24, 16)), brassMat);
      horn.rotation.x = -Math.PI / 2;
      horn.position.set(0, -foreLen - 0.04, 0.14);
      forearm.add(horn);
    }

    return { shoulder, forearm };
  };

  const leftA = buildArm(-1);
  const rightA = buildArm(1);

  // Sculpted Muscular Legs + Knees + Lugged Footwear / Bare Feet
  const legScale = isMuscular ? 1.15 : isDani ? 0.8 : 0.96;
  const buildLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * (hipWidth * 0.28), -0.05, 0);
    pelvis.add(hip);

    const thighLen = 0.42;
    const thighGeo = trackGeo(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.056 * legScale, -thighLen),
          new THREE.Vector2(0.068 * legScale, -thighLen * 0.6),
          new THREE.Vector2(0.084 * legScale, -thighLen * 0.22),
          new THREE.Vector2(0.08 * legScale, 0),
        ],
        20,
      ),
    );
    const thigh = new THREE.Mesh(thighGeo, pantsMat);
    thigh.castShadow = true;
    thigh.receiveShadow = true;
    hip.add(thigh);

    if (isMaluco) {
      const sidePrint = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.015, 0.09, 0.06)), vestMat);
      sidePrint.position.set(side * 0.072, -0.32, 0.02);
      hip.add(sidePrint);
    }

    const shin = new THREE.Group();
    shin.position.set(0, -thighLen, 0);
    hip.add(shin);

    // Sculpted knee joint cap
    const knee = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.054 * legScale, 14, 12)),
      isMaluco ? skinMat : pantsMat,
    );
    knee.scale.set(0.95, 0.9, 0.95);
    knee.castShadow = true;
    shin.add(knee);

    const shinLen = 0.4;
    const bareLegs = isMaluco;
    const calfGeo = trackGeo(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.038 * legScale, -shinLen),
          new THREE.Vector2(0.044 * legScale, -shinLen * 0.72),
          new THREE.Vector2(0.064 * legScale, -shinLen * 0.34),
          new THREE.Vector2(0.054 * legScale, 0),
        ],
        20,
      ),
    );
    const calf = new THREE.Mesh(calfGeo, bareLegs ? skinMat : pantsMat);
    calf.castShadow = true;
    calf.receiveShadow = true;
    shin.add(calf);

    // Realistic Multi-Part Footwear or Bare Foot
    const footGroup = new THREE.Group();
    footGroup.position.set(0, -shinLen - 0.02, 0);
    shin.add(footGroup);

    const isBarefoot = isMaluco || isCapoeira;
    if (isBarefoot) {
      const instep = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.082, 0.046, 0.165)), skinMat);
      instep.position.set(0, -0.02, 0.048);
      instep.castShadow = true;
      footGroup.add(instep);

      const heel = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.04, 12, 10)), skinMat);
      heel.position.set(0, -0.018, -0.018);
      footGroup.add(heel);

      const toeCap = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.042, 12, 10)), skinMat);
      toeCap.scale.set(1.02, 0.62, 1.0);
      toeCap.position.set(0, -0.026, 0.125);
      footGroup.add(toeCap);

      if (isMaluco) {
        // Chinelo: sola branca com tira azul
        const soleMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf1f3f6, roughness: 0.7 }));
        const strapMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.6 }));
        const sole = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 0.016, 0.215)), soleMat);
        sole.position.set(0, -0.052, 0.05);
        sole.castShadow = true;
        footGroup.add(sole);
        const strapL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.008, 0.012, 0.09)), strapMat);
        strapL.position.set(-0.03, -0.035, 0.085);
        strapL.rotation.y = 0.45;
        footGroup.add(strapL);
        const strapR = strapL.clone();
        strapR.position.x = 0.03;
        strapR.rotation.y = -0.45;
        footGroup.add(strapR);
      }
    } else {
      const shoeMat = isDani ? vestMat : bootMat;
      const bootCollar = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.046 * legScale, 0.05 * legScale, 0.065, 16)),
        shoeMat,
      );
      bootCollar.position.set(0, 0.005, 0);
      footGroup.add(bootCollar);

      const vamp = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.09, 0.052, 0.185)), shoeMat);
      vamp.position.set(0, -0.022, 0.052);
      vamp.castShadow = true;
      footGroup.add(vamp);

      const toeBox = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.048, 14, 10)), shoeMat);
      toeBox.scale.set(0.98, 0.65, 1.15);
      toeBox.position.set(0, -0.028, 0.13);
      footGroup.add(toeBox);

      const outsole = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.098, 0.022, 0.225)), soleMat);
      outsole.position.set(0, -0.052, 0.058);
      outsole.castShadow = true;
      footGroup.add(outsole);
    }

    return { hip, shin };
  };

  const leftL = buildLeg(-1);
  const rightL = buildLeg(1);

  const shieldAura = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.95, 20, 16)),
    trackMat(new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.22, wireframe: true })),
  );
  shieldAura.position.y = 1.02;
  shieldAura.visible = false;
  root.add(shieldAura);

  const speedTrail = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.5, 0.5, 1.65, 16, 1, true)),
    trackMat(new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.2, side: THREE.DoubleSide })),
  );
  speedTrail.position.y = 0.88;
  speedTrail.visible = false;
  root.add(speedTrail);

  const parryRing = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.7, 0.036, 10, 28)),
    trackMat(new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.85 })),
  );
  parryRing.position.set(0, 1.22, 0.25);
  parryRing.visible = false;
  root.add(parryRing);

  const setRedness = (amount: number) => {
    const clamped = Math.max(0, Math.min(1, amount));
    skinMat.color.copy(baseSkinColor).lerp(FLUSHED_RED, clamped * 0.78);
    cheekSlapMat.opacity = clamped * 0.92;
  };

  return {
    root,
    pelvis,
    torso,
    chest,
    headGroup,
    leftBrow,
    rightBrow,
    mouth,
    leftArm: leftA.shoulder,
    leftForearm: leftA.forearm,
    rightArm: rightA.shoulder,
    rightForearm: rightA.forearm,
    leftLeg: leftL.hip,
    leftShin: leftL.shin,
    rightLeg: rightL.hip,
    rightShin: rightL.shin,
    shieldAura,
    speedTrail,
    parryRing,
    capeGroup,
    skirtGroup,
    hairLocksGroup,
    setRedness,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}

function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  return THREE.MathUtils.damp(current, target, lambda, dt);
}

export function animateFighterRig(
  rig: FighterRigHandles,
  fighterId: FighterId,
  move: MoveId,
  moveTime: number,
  moveDuration: number,
  globalTime: number,
  dt: number,
  buff: 'speed' | 'shield' | null,
): void {
  const rate = 28;
  const p = moveDuration > 0 ? Math.min(1, moveTime / moveDuration) : 0;
  const isPolicial = fighterId === 'policial';
  const isBoxerStance = isPolicial || fighterId === 'jesse';
  const isCapoeira = fighterId === 'roberto';
  const isBrute = fighterId === 'torcedor' || fighterId === 'torcedor_vitoria';

  let pelvisY = 0.94;
  let pelvisRotX = 0;
  let pelvisRotZ = 0;
  let torsoRotX = isPolicial ? 0.14 : isBoxerStance ? 0.1 : isCapoeira ? 0.14 : 0.05;
  let torsoRotY = isPolicial ? 0.34 : isBoxerStance ? 0.24 : isCapoeira ? 0.32 : 0.12;
  let torsoRotZ = 0;
  let chestRotY = 0;
  let headRotX = isPolicial ? -0.06 : 0;
  let headRotY = isPolicial ? -0.28 : isBoxerStance ? -0.18 : isCapoeira ? -0.22 : -0.08;
  let headRotZ = 0;

  let lArmX = isPolicial ? -1.62 : isBoxerStance ? -1.45 : isCapoeira ? -1.1 : -1.05;
  let lArmY = 0.12;
  let lArmZ = isPolicial ? 0.22 : 0.18;
  let lForeX = isPolicial ? -1.88 : isBoxerStance ? -1.75 : -1.35;

  let rArmX = isPolicial ? -1.55 : isBoxerStance ? -1.55 : isCapoeira ? -1.25 : -1.2;
  let rArmY = -0.12;
  let rArmZ = isPolicial ? -0.26 : -0.18;
  let rForeX = isPolicial ? -2.02 : isBoxerStance ? -1.85 : -1.45;

  let lLegX = isPolicial ? -0.32 : -0.24;
  let lShinX = isPolicial ? 0.42 : 0.26;
  let rLegX = isPolicial ? 0.28 : 0.22;
  let rShinX = isPolicial ? 0.28 : 0.18;

  let browTilt = isPolicial || isBrute ? 0.36 : 0.1;
  let mouthScaleY = 1;
  let mouthScaleX = 1;

  if (move === 'idle' || move === 'intro') {
    if (isCapoeira) {
      // Rhythmic continuous Capoeira ginga idle
      const ginga = Math.sin(globalTime * 5.2);
      pelvisY = 0.88 + Math.abs(ginga) * 0.05;
      torsoRotY = ginga * 0.45;
      torsoRotX = 0.16;
      lArmX = -1.2 + ginga * 0.35;
      rArmX = -1.2 - ginga * 0.35;
      lLegX = -0.28 + ginga * 0.22;
      rLegX = 0.28 - ginga * 0.22;
    } else if (isPolicial) {
      // Boxer bounce + rhythmic head-slip peek-a-boo idle
      const bounce = Math.abs(Math.sin(globalTime * 6.2));
      const slip = Math.sin(globalTime * 3.1);
      pelvisY = 0.905 + bounce * 0.032;
      torsoRotZ = slip * 0.075;
      torsoRotY = 0.34 + slip * 0.08;
      headRotZ = -slip * 0.05;
      headRotY = -0.28 - slip * 0.06;
      lArmX = -1.62 + bounce * 0.06;
      rArmX = -1.55 - bounce * 0.04;
      lLegX = -0.34 - bounce * 0.04;
      lShinX = 0.46 + bounce * 0.05;
      rLegX = 0.28 + bounce * 0.04;
      rShinX = 0.3 + bounce * 0.04;
    } else {
      const bob = Math.sin(globalTime * (isBoxerStance ? 5.6 : 4.6));
      pelvisY = 0.93 + bob * 0.028;
      torsoRotZ = isBoxerStance ? Math.sin(globalTime * 2.8) * 0.065 : 0;
      lArmX = (isBoxerStance ? -1.45 : -1.05) + bob * 0.08;
      rArmX = (isBoxerStance ? -1.55 : -1.18) - bob * 0.08;
    }
    if (move === 'intro') {
      if (isPolicial) {
        // Double boxing glove tap then snap to high guard
        const tap = Math.max(0, Math.sin(globalTime * 9.5));
        lArmX = -1.64;
        rArmX = -1.64;
        lArmZ = 0.28 + tap * 0.16;
        rArmZ = -0.28 - tap * 0.16;
        lForeX = -1.65;
        rForeX = -1.65;
        browTilt = 0.44;
      } else {
        rArmX = -2.25;
        rForeX = -0.35;
        headRotY = Math.sin(globalTime * 4) * 0.15;
      }
    }
  } else if (move === 'run') {
    // Corrida: passada longa, tronco inclinado e braços bombeando
    const cycle = globalTime * 17;
    pelvisY = 0.88 + Math.abs(Math.sin(cycle)) * 0.06;
    lLegX = Math.sin(cycle) * 0.95;
    rLegX = -Math.sin(cycle) * 0.95;
    lShinX = Math.max(0.15, -Math.cos(cycle) * 1.2);
    rShinX = Math.max(0.15, Math.cos(cycle) * 1.2);
    torsoRotX = 0.38;
    torsoRotY = 0.08;
    headRotX = -0.18;
    lArmX = -0.6 - Math.sin(cycle) * 0.9;
    rArmX = -0.6 + Math.sin(cycle) * 0.9;
    lForeX = -1.5;
    rForeX = -1.5;
  } else if (move === 'walk_fwd' || move === 'walk_back') {
    const dir = move === 'walk_fwd' ? 1 : -1;
    const cycle = globalTime * (isPolicial ? 12.2 : 11.5) * dir;
    pelvisY = 0.91 + Math.abs(Math.sin(cycle)) * 0.038;
    lLegX = Math.sin(cycle) * (isPolicial ? 0.46 : 0.54);
    rLegX = -Math.sin(cycle) * (isPolicial ? 0.46 : 0.54);
    lShinX = Math.max(0.1, -Math.cos(cycle) * 0.48);
    rShinX = Math.max(0.1, Math.cos(cycle) * 0.48);
    torsoRotX = move === 'walk_fwd' ? 0.16 : -0.02;
    if (isPolicial) {
      // Boxer keeps tight guard up while shuffling feet
      torsoRotY = 0.32 + Math.sin(cycle) * 0.06;
      lArmX = -1.6 + Math.cos(cycle) * 0.08;
      lArmZ = 0.22;
      lForeX = -1.9;
      rArmX = -1.54 - Math.cos(cycle) * 0.08;
      rArmZ = -0.26;
      rForeX = -2.02;
    } else {
      lArmX = (isBoxerStance ? -1.45 : -1.05) + Math.cos(cycle) * 0.16;
      rArmX = (isBoxerStance ? -1.55 : -1.18) - Math.cos(cycle) * 0.16;
    }
  } else if (move === 'crouch' || move === 'crouch_block') {
    pelvisY = 0.58;
    torsoRotX = 0.34;
    lLegX = -0.82;
    lShinX = 1.35;
    rLegX = -0.62;
    rShinX = 1.15;
    if (move === 'crouch_block') {
      lArmX = -1.78;
      lArmZ = 0.28;
      rArmX = -1.78;
      rArmZ = -0.28;
      lForeX = -1.92;
      rForeX = -1.92;
      browTilt = 0.48;
    }
  } else if (move === 'jump') {
    pelvisY = 0.98;
    torsoRotX = 0.15;
    lLegX = -0.58;
    lShinX = 0.95;
    rLegX = -0.25;
    rShinX = 0.72;
    lArmX = -1.65;
    rArmX = -1.65;
  } else if (move === 'block' || move === 'parry') {
    pelvisY = move === 'parry' ? 0.92 : 0.84;
    torsoRotX = move === 'parry' ? -0.05 : 0.18;
    torsoRotY = move === 'parry' ? -0.38 : 0.12;
    lArmX = move === 'parry' ? -1.95 : -1.82;
    lArmZ = move === 'parry' ? -0.35 : 0.28;
    lForeX = move === 'parry' ? -0.45 : -1.95;
    rArmX = -1.82;
    rArmZ = -0.28;
    rForeX = -1.95;
    lLegX = -0.36;
    lShinX = 0.48;
    rLegX = 0.32;
    rShinX = 0.32;
    browTilt = 0.54;
  } else if (move === 'dodge') {
    // Authentic Boxing Bob-and-Weave / U-Slip with Peek-a-Boo Guard
    const arc = Math.sin(p * Math.PI);
    const weave = Math.sin(p * Math.PI * 2);
    pelvisY = 0.94 - arc * 0.36;
    pelvisRotZ = weave * 0.16;
    torsoRotX = 0.48 * arc;
    torsoRotY = 0.28 + weave * 0.46;
    torsoRotZ = weave * 0.34;
    headRotX = -0.26 * arc;
    headRotY = -0.24 - weave * 0.32;
    headRotZ = -weave * 0.2;
    lArmX = -1.84;
    lArmZ = 0.26;
    lForeX = -2.06;
    rArmX = -1.84;
    rArmZ = -0.26;
    rForeX = -2.06;
    lLegX = -0.68 * arc;
    lShinX = 1.08 * arc;
    rLegX = -0.44 * arc;
    rShinX = 0.92 * arc;
    browTilt = 0.48;
  } else if (move === 'taunt') {
    const wave = Math.sin(p * Math.PI * 3);
    pelvisY = 0.96 + Math.abs(wave) * 0.04;
    torsoRotY = wave * 0.25;
    lArmX = -2.35;
    lArmZ = -0.38;
    lForeX = -0.48;
    rArmX = -2.35;
    rArmZ = 0.38;
    rForeX = -0.48;
    mouthScaleX = 1.5;
    mouthScaleY = 1.8;
  } else if (move === 'quick_punch' || move === 'punch_light' || move === 'punch_med' || move === 'crouch_punch' || move === 'air_punch') {
    const thrust = Math.sin(Math.min(1, p * 1.45) * Math.PI);
    const isCrouch = move === 'crouch_punch';
    const isCross = move === 'punch_med';
    pelvisY = isCrouch ? 0.58 : 0.91 - thrust * 0.03;
    if (isCrouch) {
      lLegX = -0.82;
      lShinX = 1.35;
      rLegX = -0.62;
      rShinX = 1.15;
    }
    torsoRotX = (isCrouch ? 0.34 : 0.18) * (0.5 + thrust * 0.7);
    if (isCross) {
      // Right Power Cross rotating right shoulder cleanly forward (-Y)
      torsoRotY = THREE.MathUtils.lerp(0.28, -0.68, thrust);
      chestRotY = THREE.MathUtils.lerp(0.1, -0.38, thrust);
      rArmX = THREE.MathUtils.lerp(-1.55, -1.62, thrust);
      rArmZ = THREE.MathUtils.lerp(-0.24, -0.14, thrust);
      rForeX = THREE.MathUtils.lerp(-1.95, -0.04, thrust);
      lArmX = -1.62;
      lArmZ = 0.24;
      lForeX = -1.96;
    } else {
      // Crisp Left Lead Jab driving left shoulder forward (+Y) while rear fist protects chin
      torsoRotY = THREE.MathUtils.lerp(0.26, 0.58, thrust);
      chestRotY = THREE.MathUtils.lerp(0.08, 0.32, thrust);
      lArmX = THREE.MathUtils.lerp(-1.58, -1.62, thrust);
      lArmZ = THREE.MathUtils.lerp(0.22, 0.14, thrust);
      lForeX = THREE.MathUtils.lerp(-1.85, -0.04, thrust);
      rArmX = -1.58;
      rArmZ = -0.26;
      rForeX = -2.04;
    }
    browTilt = 0.46;
    mouthScaleY = 1.6;
  } else if (move === 'heavy_punch' || move === 'punch_heavy') {
    if (p < 0.32) {
      const w = p / 0.32;
      pelvisY = 0.92 - 0.14 * w;
      torsoRotX = 0.24 * w;
      torsoRotY = 0.62 * w;
      torsoRotZ = 0.18 * w;
      rArmX = -0.92;
      rArmZ = 0.34 * w;
      rForeX = -1.65;
      lArmX = -1.62;
      lArmZ = 0.24;
      lForeX = -1.95;
    } else {
      const s = Math.sin(((p - 0.32) / 0.68) * Math.PI);
      const snap = Math.min(1, (p - 0.32) * 2.8);
      pelvisY = 0.78 + s * 0.24;
      torsoRotX = 0.22 - 0.18 * snap;
      torsoRotY = THREE.MathUtils.lerp(0.62, -0.88, snap);
      chestRotY = THREE.MathUtils.lerp(0.25, -0.45, snap);
      rArmX = THREE.MathUtils.lerp(-1.1, -2.02, snap);
      rArmZ = THREE.MathUtils.lerp(0.25, -0.22, snap);
      rForeX = THREE.MathUtils.lerp(-1.55, -1.02, snap);
      lArmX = -1.58;
      lArmZ = 0.26;
      lForeX = -1.95;
    }
    browTilt = 0.56;
    mouthScaleY = 2.2;
  } else if (move === 'slap') {
    if (p < 0.28) {
      const w = p / 0.28;
      pelvisY = 0.9;
      torsoRotX = -0.06 * w;
      torsoRotY = 0.76 * w;
      chestRotY = 0.35 * w;
      rArmX = -1.46;
      rArmZ = 1.24 * w;
      rForeX = -0.18;
      lArmX = -1.55;
      lArmZ = 0.25;
      lForeX = -1.92;
    } else {
      const swing = Math.min(1, (p - 0.28) / 0.3);
      pelvisY = 0.92;
      torsoRotX = 0.24 * swing;
      torsoRotY = THREE.MathUtils.lerp(0.76, -1.04, swing);
      chestRotY = THREE.MathUtils.lerp(0.35, -0.42, swing);
      rArmX = -1.58;
      rArmZ = THREE.MathUtils.lerp(1.24, -0.56, swing);
      rForeX = -0.06;
      lArmX = -1.55;
      lArmZ = 0.25;
      lForeX = -1.92;
    }
    browTilt = 0.5;
    mouthScaleX = 1.4;
    mouthScaleY = 1.85;
  } else if (move === 'kick' || move === 'kick_light' || move === 'kick_med' || move === 'kick_heavy' || move === 'crouch_kick' || move === 'air_kick') {
    const arc = Math.sin(p * Math.PI);
    const isLow = move === 'crouch_kick' || move === 'kick_light';
    if (move === 'crouch_kick') {
      pelvisY = 0.46;
      torsoRotX = -0.18;
      torsoRotY = 0.85 * arc;
      rLegX = -1.45 * arc;
      rShinX = 0.08;
      lLegX = -0.9;
      lShinX = 1.45;
    } else {
      pelvisY = 0.96 + arc * (move === 'kick_heavy' ? 0.14 : 0.08);
      torsoRotX = (isLow ? -0.12 : -0.34) * arc;
      torsoRotY = (move === 'kick_heavy' ? 0.85 : 0.52) * arc;
      rLegX = (isLow ? -1.15 : -1.85) * arc;
      rShinX = 0.06;
      lLegX = 0.14;
      lShinX = 0.18;
    }
    browTilt = 0.42;
    mouthScaleY = 1.9;
  } else if (move === 'grab') {
    if (p < 0.25) {
      // Lunge forward with open clinch hands
      const r = p / 0.25;
      pelvisY = 0.9 - 0.06 * r;
      torsoRotX = 0.32 * r;
      lArmX = -1.56;
      lArmZ = 0.12;
      lForeX = -0.18;
      rArmX = -1.56;
      rArmZ = -0.12;
      rForeX = -0.18;
    } else if (p < 0.68) {
      // Paired clinch lock + heavy body uppercut & knee drive
      const c = (p - 0.25) / 0.43;
      const hitPulse = Math.sin(c * Math.PI);
      pelvisY = 0.88;
      torsoRotX = 0.22;
      torsoRotY = -0.38 * hitPulse;
      lArmX = -1.62;
      lArmZ = 0.32;
      lForeX = -1.18;
      rArmX = THREE.MathUtils.lerp(-1.32, -1.88, hitPulse);
      rArmZ = -0.2;
      rForeX = -1.28;
      rLegX = -0.92 * hitPulse;
      rShinX = 1.25 * hitPulse;
    } else {
      // Explosive shove throw
      const s = Math.min(1, (p - 0.68) / 0.25);
      pelvisY = 0.93;
      torsoRotX = 0.38 * s;
      lArmX = -1.62;
      lArmZ = 0.08;
      lForeX = -0.05;
      rArmX = -1.62;
      rArmZ = -0.08;
      rForeX = -0.05;
    }
    browTilt = 0.54;
    mouthScaleY = 2.0;
  } else if (move === 'grabbed') {
    if (p < 0.62) {
      pelvisY = 0.84;
      torsoRotX = 0.36;
      headRotX = 0.22;
      lArmX = -1.22;
      lArmZ = 0.28;
      lForeX = -0.95;
      rArmX = -1.22;
      rArmZ = -0.28;
      rForeX = -0.95;
      lLegX = -0.35;
      lShinX = 0.52;
      rLegX = 0.28;
      rShinX = 0.42;
    } else {
      const rec = (p - 0.62) / 0.38;
      pelvisY = 0.88;
      torsoRotX = -0.38 * rec;
      headRotX = -0.45 * rec;
      lArmX = -0.45;
      lArmZ = -0.58 * rec;
      rArmX = -0.45;
      rArmZ = 0.58 * rec;
    }
    browTilt = -0.38;
    mouthScaleY = 2.2;
  } else if (move === 'grab_break') {
    const lunge = Math.sin(p * Math.PI);
    torsoRotX = -0.32 * lunge;
    lArmX = -1.56;
    lArmZ = -0.72 * lunge;
    lForeX = -0.18;
    rArmX = -1.56;
    rArmZ = 0.72 * lunge;
    rForeX = -0.18;
    browTilt = 0.5;
    mouthScaleY = 2.0;
  } else if (move === 'special_1' || move === 'special_2' || move === 'special_combo') {
    if (isPolicial && move === 'special_1') {
      // Tapao da Ordem (heavy windup open-hand whip)
      if (p < 0.3) {
        const w = p / 0.3;
        pelvisY = 0.88;
        torsoRotY = 0.84 * w;
        rArmX = -1.48;
        rArmZ = 1.32 * w;
        rForeX = -0.15;
      } else {
        const swing = Math.min(1, (p - 0.3) / 0.32);
        pelvisY = 0.94;
        torsoRotX = 0.28 * swing;
        torsoRotY = THREE.MathUtils.lerp(0.84, -1.12, swing);
        rArmX = -1.6;
        rArmZ = THREE.MathUtils.lerp(1.32, -0.62, swing);
        rForeX = -0.04;
      }
    } else if (isPolicial && move === 'special_2') {
      // Avanco de Boxe (Bob-slip step -> Body Hook -> Rising Uppercut)
      if (p < 0.34) {
        const s = p / 0.34;
        pelvisY = 0.92 - 0.3 * s;
        torsoRotX = 0.42 * s;
        torsoRotY = 0.45 * s;
        lArmX = -1.8;
        lArmZ = 0.26;
        lForeX = -2.0;
        rArmX = -1.8;
        rArmZ = -0.26;
        rForeX = -2.0;
      } else if (p < 0.65) {
        const c = (p - 0.34) / 0.31;
        pelvisY = 0.76 + 0.14 * c;
        torsoRotY = THREE.MathUtils.lerp(0.45, -0.65, c);
        lArmX = -1.62;
        lForeX = -0.05;
        rArmX = -1.4;
        rForeX = -1.8;
      } else {
        const u = Math.min(1, (p - 0.65) / 0.25);
        pelvisY = 0.9 + 0.16 * Math.sin(u * Math.PI);
        torsoRotY = THREE.MathUtils.lerp(-0.65, 0.35, u);
        rArmX = -2.08;
        rForeX = -1.05;
        rArmZ = -0.22;
      }
    } else {
      const rapid = Math.sin(p * Math.PI * (move === 'special_combo' ? 6 : 2));
      torsoRotY = rapid * 0.72;
      torsoRotX = 0.24;
      if (move === 'special_2' || isCapoeira) {
        pelvisY = 1.02 + Math.sin(p * Math.PI) * 0.22;
        rLegX = -1.85 * Math.sin(p * Math.PI);
        rShinX = 0.1;
      } else {
        lArmX = -1.58;
        rArmX = -1.58;
        lForeX = rapid > 0 ? -0.05 : -1.45;
        rForeX = rapid <= 0 ? -0.05 : -1.45;
      }
    }
    browTilt = 0.58;
    mouthScaleY = 2.4;
  } else if (move === 'power_move' || move === 'finisher_move') {
    const isFinisher = move === 'finisher_move';
    if (isPolicial && !isFinisher) {
      // Tactical forward command + guard snap summoning the 7 black cats
      const rise = Math.min(1, p * 2.4);
      pelvisY = 0.88 + Math.sin(p * Math.PI) * 0.12;
      torsoRotX = -0.08 * rise;
      torsoRotY = -0.34 * rise;
      rArmX = -1.64;
      rForeX = -0.04;
      rArmZ = -0.08;
      lArmX = -1.56;
      lArmZ = 0.26;
      lForeX = -1.92;
    } else if (isPolicial && isFinisher) {
      // Blitz dos 7 Gatos: Rapid 3-punch boxing flurry into soaring uppercut!
      if (p < 0.22) {
        const coil = p / 0.22;
        pelvisY = 0.92 - 0.22 * coil;
        torsoRotX = 0.36 * coil;
        lArmX = -1.8;
        rArmX = -1.8;
        lArmZ = 0.26;
        rArmZ = -0.26;
        lForeX = -2.0;
        rForeX = -2.0;
      } else if (p < 0.74) {
        const sub = (p - 0.22) / 0.52;
        const flurry = Math.sin(sub * Math.PI * 5);
        pelvisY = 0.93;
        torsoRotX = 0.22;
        torsoRotY = flurry * 0.68;
        chestRotY = flurry * 0.38;
        lArmX = -1.62;
        rArmX = -1.62;
        lForeX = flurry > 0 ? -0.04 : -1.85;
        rForeX = flurry <= 0 ? -0.04 : -1.85;
      } else {
        const up = Math.sin(((p - 0.74) / 0.26) * Math.PI);
        pelvisY = 0.92 + up * 0.28;
        torsoRotX = -0.18 * up;
        torsoRotY = -0.78 * up;
        rArmX = -2.18;
        rForeX = -0.95;
        rArmZ = -0.22;
      }
    } else if (p < 0.28) {
      pelvisY = 0.78;
      torsoRotX = 0.36;
      lArmX = -0.5;
      rArmX = -0.5;
      lArmZ = -0.62;
      rArmZ = 0.62;
    } else {
      const subP = (p - 0.28) / 0.72;
      const boom = Math.sin(subP * Math.PI * (isFinisher ? 3 : 1));
      pelvisY = 0.96 + Math.abs(boom) * (isFinisher ? 0.34 : 0.22);
      torsoRotX = 0.28;
      torsoRotY = (isFinisher ? Math.sin(subP * Math.PI * 4) : -0.9) * boom;
      rArmX = -1.66;
      rForeX = -0.04;
      lArmX = -1.55;
      lForeX = isFinisher ? -0.08 : -0.25;
      if (isFinisher) {
        rLegX = -Math.abs(Math.sin(subP * Math.PI * 2)) * 1.45;
      }
    }
    browTilt = 0.65;
    mouthScaleY = 2.6;
  } else if (move === 'hitstun' || move === 'stun') {
    const recoil = move === 'stun' ? 0.65 : Math.sin(p * Math.PI);
    const sway = move === 'stun' ? Math.sin(globalTime * 7) * 0.24 : 0;
    pelvisY = 0.9 - recoil * 0.06;
    torsoRotX = -0.32 * recoil;
    torsoRotY = 0.42 * recoil + sway;
    torsoRotZ = sway * 0.7;
    headRotX = -0.4 * recoil;
    headRotY = 0.65 * recoil + sway;
    headRotZ = -0.25 * recoil;
    lArmX = -0.35;
    rArmX = -0.35;
    lArmZ = -0.5;
    rArmZ = 0.5;
    browTilt = -0.38;
    mouthScaleY = 2.3;
  } else if (move === 'knockdown' || move === 'ko') {
    const fall = move === 'ko' ? Math.min(1, p * 2.2) : Math.sin(p * Math.PI);
    pelvisY = THREE.MathUtils.lerp(0.94, 0.22, fall);
    pelvisRotX = -1.48 * fall;
    lArmX = -0.2;
    rArmX = -0.2;
    lArmZ = -0.75 * fall;
    rArmZ = 0.75 * fall;
    browTilt = -0.4;
    mouthScaleY = 2.2;
  } else if (move === 'victory' || move === 'victory_1' || move === 'victory_2') {
    if (isPolicial) {
      // Crisp 1-2 shadowboxing cycle into raised champion fist
      const phase = globalTime % 2.4;
      if (phase < 1.0) {
        const combo = Math.sin((phase / 1.0) * Math.PI * 4);
        pelvisY = 0.92;
        torsoRotY = 0.28 + combo * 0.45;
        lArmX = -1.6;
        rArmX = -1.6;
        lForeX = combo > 0 ? -0.06 : -1.85;
        rForeX = combo <= 0 ? -0.06 : -1.85;
      } else {
        pelvisY = 0.97;
        torsoRotY = 0.16;
        rArmX = -2.42;
        rArmZ = 0.22;
        rForeX = -0.22;
        lArmX = -1.52;
        lArmZ = 0.26;
        lForeX = -1.92;
        headRotY = -0.14;
      }
      browTilt = 0.34;
    } else if (fighterId === 'maluco' || fighterId === 'jesse' || fighterId === 'torcedor' || fighterId === 'torcedor_vitoria') {
      pelvisY = 0.94 + Math.abs(Math.sin(globalTime * 7)) * 0.08;
      torsoRotY = Math.sin(globalTime * 5) * 0.3;
      lArmX = -2.5;
      rArmX = -2.5;
      lArmZ = -0.22;
      rArmZ = 0.22;
      lForeX = -0.4;
      rForeX = -0.4;
      mouthScaleX = 1.5;
      mouthScaleY = 1.7;
    } else {
      pelvisY = 0.96;
      lArmX = -1.25;
      rArmX = -2.35;
      lArmZ = 0.28;
      rArmZ = 0.22;
      lForeX = -1.55;
      rForeX = -0.2;
      headRotY = Math.sin(globalTime * 1.5) * 0.1;
    }
  }

  rig.pelvis.position.y = dampAngle(rig.pelvis.position.y, pelvisY, rate, dt);
  rig.pelvis.rotation.x = dampAngle(rig.pelvis.rotation.x, pelvisRotX, rate, dt);
  rig.pelvis.rotation.z = dampAngle(rig.pelvis.rotation.z, pelvisRotZ, rate, dt);

  rig.torso.rotation.x = dampAngle(rig.torso.rotation.x, torsoRotX, rate, dt);
  rig.torso.rotation.y = dampAngle(rig.torso.rotation.y, torsoRotY, rate, dt);
  rig.torso.rotation.z = dampAngle(rig.torso.rotation.z, torsoRotZ, rate, dt);
  rig.chest.rotation.y = dampAngle(rig.chest.rotation.y, chestRotY, rate, dt);

  rig.headGroup.rotation.x = dampAngle(rig.headGroup.rotation.x, headRotX, rate, dt);
  rig.headGroup.rotation.y = dampAngle(rig.headGroup.rotation.y, headRotY, rate, dt);
  rig.headGroup.rotation.z = dampAngle(rig.headGroup.rotation.z, headRotZ, rate, dt);

  rig.leftArm.rotation.x = dampAngle(rig.leftArm.rotation.x, lArmX, rate, dt);
  rig.leftArm.rotation.y = dampAngle(rig.leftArm.rotation.y, lArmY, rate, dt);
  rig.leftArm.rotation.z = dampAngle(rig.leftArm.rotation.z, lArmZ, rate, dt);
  rig.leftForearm.rotation.x = dampAngle(rig.leftForearm.rotation.x, lForeX, rate, dt);

  rig.rightArm.rotation.x = dampAngle(rig.rightArm.rotation.x, rArmX, rate, dt);
  rig.rightArm.rotation.y = dampAngle(rig.rightArm.rotation.y, rArmY, rate, dt);
  rig.rightArm.rotation.z = dampAngle(rig.rightArm.rotation.z, rArmZ, rate, dt);
  rig.rightForearm.rotation.x = dampAngle(rig.rightForearm.rotation.x, rForeX, rate, dt);

  rig.leftLeg.rotation.x = dampAngle(rig.leftLeg.rotation.x, lLegX, rate, dt);
  rig.leftShin.rotation.x = dampAngle(rig.leftShin.rotation.x, lShinX, rate, dt);
  rig.rightLeg.rotation.x = dampAngle(rig.rightLeg.rotation.x, rLegX, rate, dt);
  rig.rightShin.rotation.x = dampAngle(rig.rightShin.rotation.x, rShinX, rate, dt);

  rig.leftBrow.rotation.z = -browTilt;
  rig.rightBrow.rotation.z = browTilt;
  rig.mouth.scale.set(mouthScaleX, mouthScaleY, 1);

  // Secondary motion on cape, skirt, and hair locks!
  const speedActivity = move === 'run' || move === 'walk_fwd' || move === 'walk_back' || move === 'jump' || move === 'special_1' || move === 'special_2' ? 1 : 0.3;
  if (rig.capeGroup) {
    rig.capeGroup.rotation.x = dampAngle(
      rig.capeGroup.rotation.x,
      0.16 + speedActivity * 0.25 + Math.sin(globalTime * 7) * 0.08,
      14,
      dt,
    );
  }
  if (rig.skirtGroup) {
    rig.skirtGroup.rotation.z = dampAngle(
      rig.skirtGroup.rotation.z,
      Math.sin(globalTime * 5) * 0.04 * speedActivity,
      12,
      dt,
    );
  }
  if (rig.hairLocksGroup) {
    rig.hairLocksGroup.rotation.x = dampAngle(
      rig.hairLocksGroup.rotation.x,
      speedActivity * 0.14 + Math.sin(globalTime * 6) * 0.05,
      14,
      dt,
    );
  }

  rig.shieldAura.visible = buff === 'shield';
  if (rig.shieldAura.visible) rig.shieldAura.rotation.y += dt * 1.8;
  rig.speedTrail.visible = buff === 'speed';
  if (rig.speedTrail.visible) rig.speedTrail.rotation.y -= dt * 4.5;
  rig.parryRing.visible = move === 'parry';
  if (rig.parryRing.visible) rig.parryRing.rotation.z += dt * 12;
}
