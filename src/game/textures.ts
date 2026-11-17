import * as THREE from 'three';

function safeRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  if (typeof (ctx as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const rad = Math.min(r, w * 0.5, h * 0.5);
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function get2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  try {
    return canvas.getContext('2d');
  } catch {
    return null;
  }
}

function generateNormalMapData(
  size: number,
  strength: number,
  heightFn: (x: number, y: number) => number,
): Uint8Array {
  const heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      heights[y * size + x] = heightFn(x, y);
    }
  }

  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;

      const dX = (heights[y * size + xp] - heights[y * size + xm]) * strength;
      const dY = (heights[yp * size + x] - heights[ym * size + x]) * strength;

      let nx = -dX;
      let ny = -dY;
      let nz = 1.0;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;

      const idx = (y * size + x) * 4;
      data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }
  return data;
}

function createDataTextureFromBuffer(
  data: Uint8Array,
  size: number,
  maxAnisotropy = 4,
  repeatX = 1,
  repeatY = 1,
): THREE.DataTexture {
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates a linear-space tangent-space normal map from a height callback.
 */
function buildNormalMap(
  size: number,
  strength: number,
  heightFn: (x: number, y: number) => number,
  maxAnisotropy = 4,
  repeatX = 1,
  repeatY = 1,
): THREE.DataTexture {
  const data = generateNormalMapData(size, strength, heightFn);
  return createDataTextureFromBuffer(data, size, maxAnisotropy, repeatX, repeatY);
}

let cachedSkinNormalData: Uint8Array | null = null;
const cachedFabricNormalData: Partial<Record<'weave' | 'ripstop' | 'denim' | 'lace', Uint8Array>> = {};

export function createSkinMicroNormalTexture(): THREE.DataTexture {
  if (!cachedSkinNormalData) {
    cachedSkinNormalData = generateNormalMapData(128, 1.35, (x, y) => {
      const n1 = Math.sin(x * 0.72) * Math.cos(y * 0.72) * 0.35;
      const n2 = Math.sin(x * 1.9 + y * 1.3) * 0.22;
      const n3 = Math.cos(x * 3.1 - y * 2.7) * 0.14;
      return n1 + n2 + n3;
    });
  }
  return createDataTextureFromBuffer(cachedSkinNormalData, 128, 2, 4, 4);
}

export function createFabricNormalTexture(
  kind: 'weave' | 'ripstop' | 'denim' | 'lace' = 'weave',
): THREE.DataTexture {
  let data = cachedFabricNormalData[kind];
  if (!data) {
    data = generateNormalMapData(
      128,
      kind === 'ripstop' ? 2.4 : kind === 'denim' ? 2.0 : 1.7,
      (x, y) => {
        if (kind === 'ripstop') {
          const grid = x % 16 < 2 || y % 16 < 2 ? 0.85 : 0;
          const weave = (x + y) % 4 < 2 ? 0.25 : -0.25;
          return grid + weave;
        }
        if (kind === 'denim') {
          return Math.sin((x + y) * 0.95) * 0.45 + Math.cos(x * 0.45) * 0.15;
        }
        if (kind === 'lace') {
          const dx = ((x % 16) - 8) / 8;
          const dy = ((y % 16) - 8) / 8;
          return Math.max(0, 1 - (dx * dx + dy * dy)) * 0.9;
        }
        return Math.sin(x * 1.4) * 0.3 + Math.cos(y * 1.4) * 0.3;
      },
    );
    cachedFabricNormalData[kind] = data;
  }
  return createDataTextureFromBuffer(data, 128, 4, 3, 3);
}

export function createPelourinhoCobbleNormalTexture(maxAnisotropy: number): THREE.DataTexture {
  const size = 256;
  const rows = 7;
  const cols = 5;
  const cw = size / cols;
  const ch = size / rows;

  return buildNormalMap(
    size,
    3.6,
    (x, y) => {
      const r = Math.floor(y / ch);
      const off = (r % 2) * (cw * 0.5);
      const lx = ((x - off + size) % cw) / cw;
      const ly = (y % ch) / ch;
      const edgeX = Math.min(lx, 1 - lx);
      const edgeY = Math.min(ly, 1 - ly);
      const bevel = Math.min(1, Math.min(edgeX, edgeY) * 6.5);
      const stoneGrain = Math.sin(x * 0.45 + y * 0.32) * 0.08 + Math.cos(x * 0.9 - y * 0.7) * 0.05;
      return bevel * 0.88 + stoneGrain;
    },
    maxAnisotropy,
    7,
    5,
  );
}

export function createAsphaltNormalTexture(maxAnisotropy: number): THREE.DataTexture {
  return buildNormalMap(
    256,
    2.2,
    (x, y) => {
      const h = Math.sin(x * 1.7 + y * 2.3) * 0.35 + Math.cos(x * 3.9 - y * 2.9) * 0.25 + Math.sin(x * 0.23) * 0.15;
      return h;
    },
    maxAnisotropy,
    5,
    3,
  );
}

export function createWoodNormalTexture(maxAnisotropy: number): THREE.DataTexture {
  return buildNormalMap(
    256,
    2.8,
    (x, y) => {
      const plankGap = y % 32 < 3 ? -0.9 : 0.25;
      const grain = Math.sin(y * 0.8 + Math.sin(x * 0.08) * 3.0) * 0.22;
      return plankGap + grain;
    },
    maxAnisotropy,
    6,
    4,
  );
}

export function createWaterNormalTexture(maxAnisotropy: number): THREE.DataTexture {
  return buildNormalMap(
    256,
    2.5,
    (x, y) => {
      const w1 = Math.sin(x * 0.14 + Math.cos(y * 0.12) * 1.5) * 0.45;
      const w2 = Math.cos(y * 0.24 - x * 0.09) * 0.32;
      const w3 = Math.sin((x + y) * 0.42) * 0.14;
      return w1 + w2 + w3;
    },
    maxAnisotropy,
    8,
    4,
  );
}

export function createStreetGroundTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#8b857b';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 9500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 112 + Math.floor(Math.random() * 54);
    ctx.fillStyle = `rgb(${v},${v - 4},${v - 9})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Sunlit weathering & expansion joints
  ctx.strokeStyle = 'rgba(42, 38, 34, 0.48)';
  ctx.lineWidth = 3;
  for (let x = 0; x <= 512; x += 128) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let y = 0; y <= 512; y += 128) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 3);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createPelourinhoCobbleTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = get2dContext(canvas);
  if (!ctx) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  ctx.fillStyle = '#3b3329';
  ctx.fillRect(0, 0, 512, 512);

  const stones = ['#8c7d68', '#786a56', '#9d8c73', '#6b5f4d', '#847560', '#a6967d'];
  const rows = 14;
  const cols = 10;
  const w = 512 / cols;
  const h = 512 / rows;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (w * 0.5);
    for (let c = -1; c <= cols; c++) {
      const sx = c * w + offset + 2.5;
      const sy = r * h + 2.5;
      const sw = w - 5;
      const sh = h - 5;
      const base = stones[(r * 5 + c * 3 + 20) % stones.length];
      const grad = ctx.createLinearGradient(sx, sy, sx + sw, sy + sh);
      grad.addColorStop(0, base);
      grad.addColorStop(1, '#584d3f');
      ctx.fillStyle = grad;
      ctx.beginPath();
      safeRoundRect(ctx, sx, sy, sw, sh, 5);
      ctx.fill();

      // Sun-worn specular polish & ambient shadow edge
      ctx.fillStyle = 'rgba(255,244,222,0.16)';
      ctx.fillRect(sx + 4, sy + 3, sw - 8, 4);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(sx + 3, sy + sh - 4, sw - 6, 3);
    }
  }

  // Damp puddle sheen variation
  for (let p = 0; p < 5; p++) {
    const px = 70 + p * 95;
    const py = 90 + ((p * 130) % 350);
    const rg = ctx.createRadialGradient(px, py, 6, px, py, 58);
    rg.addColorStop(0, 'rgba(18, 22, 28, 0.24)');
    rg.addColorStop(1, 'rgba(18, 22, 28, 0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(px, py, 58, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(7, 5);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createAsphaltRoadTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#252830';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 26 + Math.floor(Math.random() * 40);
    ctx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Painted street markings with subtle wear
  ctx.fillStyle = 'rgba(229, 231, 235, 0.85)';
  ctx.fillRect(0, 240, 512, 12);
  ctx.fillStyle = 'rgba(250, 204, 21, 0.85)';
  for (let x = 20; x < 512; x += 96) {
    ctx.fillRect(x, 120, 52, 8);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 3);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createWoodDockTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const planks = ['#7a5134', '#6b462c', '#8a5d3b', '#5e3c25'];
  const h = 32;
  for (let y = 0; y < 512; y += h) {
    ctx.fillStyle = planks[(y / h) % planks.length];
    ctx.fillRect(0, y, 512, h - 3);
    ctx.strokeStyle = 'rgba(38, 22, 10, 0.28)';
    ctx.lineWidth = 1.5;
    for (let g = 0; g < 6; g++) {
      ctx.beginPath();
      ctx.moveTo(0, y + 5 + g * 4);
      ctx.bezierCurveTo(170, y + 3 + g * 4, 340, y + 8 + g * 4, 512, y + 5 + g * 4);
      ctx.stroke();
    }
    ctx.fillStyle = '#26170b';
    ctx.fillRect(0, y + h - 3, 512, 3);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 4);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createWaterWaveTexture(maxAnisotropy: number, baseHex = '#0284c7'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, baseHex);
  grad.addColorStop(0.5, '#075985');
  grad.addColorStop(1, baseHex);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2.2;
  for (let y = 12; y < 256; y += 26) {
    ctx.beginPath();
    for (let x = 0; x <= 256; x += 16) {
      const wy = y + Math.sin((x / 256) * Math.PI * 4) * 5;
      if (x === 0) ctx.moveTo(x, wy);
      else ctx.lineTo(x, wy);
    }
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 4);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createCajazeiraParedaoTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0e0e13';
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = '#a855f7';
  ctx.lineWidth = 10;
  ctx.strokeRect(10, 10, 492, 492);

  [
    [136, 150],
    [376, 150],
    [136, 370],
    [376, 370],
  ].forEach(([cx, cy]) => {
    const cg = ctx.createRadialGradient(cx - 12, cy - 12, 10, cx, cy, 88);
    cg.addColorStop(0, '#3f3f46');
    cg.addColorStop(0.7, '#18181b');
    cg.addColorStop(1, '#09090b');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(cx, cy, 88, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.fillStyle = '#050507';
    ctx.beginPath();
    ctx.arc(cx, cy, 34, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(54, 24, 404, 34);
  ctx.fillStyle = '#111116';
  ctx.font = '900 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PAREDÃO CAJAZEIRAS', 256, 42);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createRioVermelhoNeonTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#070a18';
  ctx.fillRect(0, 0, 512, 192);
  ctx.strokeStyle = '#ec4899';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 496, 176);

  ctx.fillStyle = '#fde047';
  ctx.font = '900 42px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ACARAJÉ QUENTE', 256, 74);

  ctx.fillStyle = '#38bdf8';
  ctx.font = '800 28px sans-serif';
  ctx.fillText('RIO VERMELHO · AO VIVO', 256, 134);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createBaianaLaceTexture(baseHex: string, trimHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  // Realistic cotton weave & eyelet embroidery
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  for (let y = 0; y < 256; y += 8) {
    ctx.fillRect(0, y, 256, 1);
  }

  ctx.strokeStyle = trimHex;
  ctx.lineWidth = 2.5;
  for (let y = 28; y < 220; y += 38) {
    for (let x = 16; x < 256; x += 28) {
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = trimHex;
  ctx.fillRect(0, 224, 256, 20);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(3, 1);
  return tex;
}

export function createTorcedorFlagTexture(primaryHex: string, secondaryHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const stripes = 6;
  const sh = 256 / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 3 === 0 ? primaryHex : i % 3 === 1 ? '#f8fafc' : secondaryHex;
    ctx.fillRect(0, i * sh, 256, sh + 1);
  }
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.arc(128, 128, 36, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSalvadorSkyTexture(
  isSunset = false,
  timeOfDay: 'manha' | 'meio_dia' | 'tarde' | 'por_do_sol' | 'crepusculo' | 'noite' = isSunset ? 'por_do_sol' : 'manha',
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  if (timeOfDay === 'noite') {
    grad.addColorStop(0, '#040712');
    grad.addColorStop(0.55, '#111633');
    grad.addColorStop(1, '#26245e');
  } else if (timeOfDay === 'crepusculo') {
    grad.addColorStop(0, '#141336');
    grad.addColorStop(0.46, '#582491');
    grad.addColorStop(0.76, '#ea821d');
    grad.addColorStop(1, '#fcd34d');
  } else if (timeOfDay === 'por_do_sol' || isSunset) {
    grad.addColorStop(0, '#172554');
    grad.addColorStop(0.36, '#6b21a8');
    grad.addColorStop(0.68, '#ea580c');
    grad.addColorStop(1, '#fde047');
  } else if (timeOfDay === 'tarde') {
    grad.addColorStop(0, '#1e40af');
    grad.addColorStop(0.52, '#60a5fa');
    grad.addColorStop(1, '#fef3c7');
  } else {
    grad.addColorStop(0, '#1e609e');
    grad.addColorStop(0.45, '#4b98d1');
    grad.addColorStop(0.78, '#9ccde8');
    grad.addColorStop(1, '#e8f4fb');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  if (timeOfDay === 'noite' || timeOfDay === 'crepusculo') {
    for (let s = 0; s < 160; s++) {
      ctx.fillStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.55})`;
      ctx.fillRect(Math.random() * 1024, Math.random() * 270, s % 7 === 0 ? 2 : 1.5, s % 7 === 0 ? 2 : 1.5);
    }
    const moonGrad = ctx.createRadialGradient(820, 96, 6, 820, 96, 32);
    moonGrad.addColorStop(0, '#fef9c3');
    moonGrad.addColorStop(0.55, 'rgba(254, 240, 138, 0.28)');
    moonGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
    ctx.fillStyle = moonGrad;
    ctx.beginPath();
    ctx.arc(820, 96, 32, 0, Math.PI * 2);
    ctx.fill();
  } else {
    for (let i = 0; i < 42; i++) {
      const cx = Math.random() * 1024;
      const cy = 85 + Math.random() * 215;
      const rx = 55 + Math.random() * 110;
      const ry = 16 + Math.random() * 28;
      const cGrad = ctx.createRadialGradient(cx, cy, 4, cx, cy, rx);
      cGrad.addColorStop(0, isSunset || timeOfDay === 'por_do_sol' ? 'rgba(255,224,185,0.42)' : 'rgba(255,255,255,0.48)');
      cGrad.addColorStop(0.55, isSunset || timeOfDay === 'por_do_sol' ? 'rgba(251,146,60,0.18)' : 'rgba(240,248,255,0.22)');
      cGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = cGrad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createColonialFacadeTexture(
  baseHex: string,
  trimHex: string,
  maxAnisotropy: number,
  archWindows = false,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 512, 512);

  // Weathered plaster grain & rain streaks
  for (let i = 0; i < 110; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.025 + Math.random() * 0.055})`;
    ctx.fillRect(Math.random() * 480, Math.random() * 480, 18 + Math.random() * 42, 16 + Math.random() * 38);
  }
  ctx.fillStyle = 'rgba(24, 18, 12, 0.14)';
  ctx.fillRect(0, 460, 512, 52);

  ctx.fillStyle = trimHex;
  ctx.fillRect(0, 0, 512, 20);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(0, 20, 512, 8);

  const winXs = [86, 200, 314, 428];
  const winYs = [125, 325];
  winYs.forEach((wy, row) => {
    winXs.forEach((wx) => {
      ctx.fillStyle = trimHex;
      if (archWindows) {
        ctx.beginPath();
        ctx.arc(wx, wy - 44, 34, Math.PI, 0);
        ctx.rect(wx - 34, wy - 44, 68, 108);
        ctx.fill();

        ctx.fillStyle = row === 1 ? '#291d14' : '#131d2b';
        ctx.beginPath();
        ctx.arc(wx, wy - 42, 26, Math.PI, 0);
        ctx.rect(wx - 26, wy - 42, 52, 98);
        ctx.fill();
      } else {
        ctx.fillRect(wx - 34, wy - 56, 68, 114);
        ctx.fillStyle = '#131d2b';
        ctx.fillRect(wx - 26, wy - 48, 52, 98);
      }

      // Subtle window glass sky reflection
      ctx.fillStyle = 'rgba(255, 224, 165, 0.16)';
      ctx.fillRect(wx - 22, wy - 42, 20, 44);

      ctx.fillStyle = trimHex;
      for (let m = -24; m <= 24; m += 24) {
        ctx.fillRect(wx - 26, wy + m, 52, 3);
      }
      ctx.fillRect(wx - 2, wy - 48, 4, 98);
    });
  });

  // Wrought-iron balcony railing
  ctx.fillStyle = '#111827';
  ctx.fillRect(24, 212, 464, 6);
  ctx.fillRect(24, 238, 464, 6);
  for (let bx = 30; bx <= 480; bx += 18) {
    ctx.fillRect(bx, 212, 3, 28);
  }

  ctx.fillStyle = trimHex;
  ctx.fillRect(0, 484, 512, 28);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createChurchTowerTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#dcd2c0';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.02 + Math.random() * 0.04})`;
    ctx.fillRect(Math.random() * 480, Math.random() * 480, 26, 26);
  }

  ctx.fillStyle = '#f5f0e4';
  ctx.fillRect(0, 0, 46, 512);
  ctx.fillRect(466, 0, 46, 512);
  ctx.fillRect(0, 210, 512, 24);
  ctx.fillRect(0, 420, 512, 24);

  [125, 310].forEach((cy) => {
    ctx.fillStyle = '#241d17';
    ctx.beginPath();
    ctx.arc(256, cy, 62, Math.PI, 0);
    ctx.rect(194, cy, 124, 72);
    ctx.fill();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createBahiaSignTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#dc2626';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 82, 256, 92);
  ctx.fillStyle = '#1d4ed8';
  ctx.beginPath();
  ctx.arc(46, 128, 22, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1d4ed8';
  ctx.font = '900 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BAHIA', 148, 130);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createAtencaoSignTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = get2dContext(canvas);
  if (!ctx) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  safeRoundRect(ctx, 8, 8, 496, 240, 110);
  ctx.fill();

  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 14;
  ctx.stroke();

  ctx.fillStyle = '#1e3a8a';
  ctx.font = '900 56px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ATENÇÃO', 256, 108);
  ctx.font = '700 32px sans-serif';
  ctx.fillText('PELOURINHO · SSA', 256, 174);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createBahiaBannerTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#15803d';
  ctx.fillRect(0, 0, 128, 512);
  ctx.fillStyle = '#facc15';
  for (let y = 40; y < 480; y += 110) {
    ctx.beginPath();
    ctx.moveTo(64, y);
    ctx.lineTo(116, y + 40);
    ctx.lineTo(64, y + 80);
    ctx.lineTo(12, y + 40);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1d4ed8';
    ctx.beginPath();
    ctx.arc(64, y + 40, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#facc15';
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createHotelSignTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#18181b';
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#e4e4e7';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, 240, 112);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '900 58px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('HOTEL', 128, 66);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createAloJucaChestTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#111216';
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let i = 0; i < 16; i++) {
    ctx.fillRect(0, i * 16, 256, 2);
  }

  ctx.fillStyle = '#facc15';
  ctx.fillRect(38, 64, 134, 46);
  ctx.fillStyle = '#111216';
  ctx.font = '900 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ALÔ', 105, 88);

  ctx.fillStyle = '#dc2626';
  ctx.fillRect(176, 64, 42, 46);
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(197, 87, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(38, 114, 180, 44);
  ctx.fillStyle = '#1e3a8a';
  ctx.font = '900 34px sans-serif';
  ctx.fillText('ZUCA', 128, 138);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createPoloTexture(baseHex: string, trimHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let x = 0; x < 256; x += 6) {
    ctx.fillRect(x, 0, 2, 256);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let x = 3; x < 256; x += 6) {
    ctx.fillRect(x, 0, 1.5, 256);
  }

  ctx.fillStyle = trimHex;
  ctx.globalAlpha = 0.14;
  ctx.fillRect(0, 238, 256, 18);
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createDenimTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#27496c';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1.5;
  for (let i = -256; i < 512; i += 5) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 256, 256);
    ctx.stroke();
  }

  const wash = ctx.createLinearGradient(0, 0, 256, 0);
  wash.addColorStop(0, 'rgba(0,0,0,0.22)');
  wash.addColorStop(0.5, 'rgba(255,255,255,0.14)');
  wash.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createPoliceVestTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0e1116';
  ctx.fillRect(0, 0, 256, 256);

  // Ripstop Kevlar + MOLLE webbing channels
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 256; i += 14) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }

  for (let y = 128; y < 220; y += 26) {
    ctx.fillStyle = '#1b1f29';
    ctx.fillRect(28, y, 200, 14);
    ctx.fillStyle = '#050608';
    ctx.fillRect(28, y + 14, 200, 3);
  }

  ctx.fillStyle = '#07080b';
  ctx.fillRect(36, 46, 184, 58);
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 46, 184, 58);
  ctx.fillStyle = '#f8fafc';
  ctx.font = '900 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BETO', 128, 63);
  ctx.font = '900 15px sans-serif';
  ctx.fillText('CHUTA-PORTA', 128, 87);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createFavelaBrickTexture(
  paintHex: string | null,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  if (paintHex) {
    ctx.fillStyle = paintHex;
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 80; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.02 + Math.random() * 0.04})`;
      ctx.fillRect(Math.random() * 480, Math.random() * 480, 30, 24);
    }
    ctx.fillStyle = '#b45338';
    ctx.fillRect(280, 320, 170, 140);
  } else {
    ctx.fillStyle = '#6b655f';
    ctx.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 32) {
      const off = ((y / 32) % 2) * 32;
      for (let x = -32; x < 512; x += 64) {
        ctx.fillStyle = (x + y) % 128 === 0 ? '#a94f32' : '#bd5f3f';
        ctx.fillRect(x + off + 2, y + 2, 60, 28);
      }
    }
  }

  [120, 360].forEach((wx) => {
    ctx.fillStyle = '#141210';
    ctx.fillRect(wx - 40, 110, 80, 95);
    ctx.fillStyle = '#e7e5e4';
    ctx.fillRect(wx - 44, 202, 88, 10);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createLighthouseStripesTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const bands = 8;
  const h = 512 / bands;
  for (let i = 0; i < bands; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#18181b' : '#f4f4f5';
    ctx.fillRect(0, i * h, 256, h + 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createSleevePatchTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(10, 16, 108, 46);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(10, 62, 108, 46);
  ctx.fillStyle = '#1d4ed8';
  ctx.fillRect(10, 16, 48, 46);
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(34, 24);
  ctx.lineTo(48, 52);
  ctx.lineTo(20, 52);
  ctx.closePath();
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 8, 128, 128, 124);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.34)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
