import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { animateFighterRig, buildFighterRig, FighterRigHandles } from '../game/fighterRig';
import { isSoftwareWebGL, scheduleSoftwareGlFrame } from '../game/glUtils';
import { createContactShadowTexture } from '../game/textures';
import { FighterId, MoveId } from '../game/types';

interface FighterPreview3DProps {
  fighterId: FighterId;
  skinId: string;
  previewMove?: MoveId;
  interactiveSpin?: boolean;
  autoRotate?: boolean;
  authorizationMode?: boolean;
  className?: string;
}

export function FighterPreview3D({
  fighterId,
  skinId,
  previewMove = 'idle',
  interactiveSpin = true,
  autoRotate = false,
  authorizationMode = true,
  className = '',
}: FighterPreview3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({
    fighterId,
    skinId,
    previewMove,
    autoRotate,
    yaw: 0.38,
    isDragging: false,
    lastX: 0,
  });

  stateRef.current.previewMove = previewMove;
  stateRef.current.autoRotate = autoRotate;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = isSoftwareWebGL();
    const width = Math.max(180, container.clientWidth);
    const height = Math.max(180, container.clientHeight);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
        powerPreference: 'high-performance',
      });
      const gl = renderer.getContext();
      if (!gl || gl.isContextLost()) {
        renderer.dispose();
        return;
      }
    } catch {
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 30);
    camera.position.set(0, 1.32, 3.55);
    camera.lookAt(0, 1.04, 0);

    // Standard balanced 3-point lighting
    const hemi = new THREE.HemisphereLight(0xe2e8f0, 0x2a1d17, 0.65);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfff1dc, 1.25);
    key.position.set(3.2, 5.2, 4.4);
    key.castShadow = !isSoftwareGl;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xcbd5e1, 0.38);
    fill.position.set(-3.8, 2.6, 3.6);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xfde68a, 0.35);
    rim.position.set(-2.8, 3.2, -3.6);
    scene.add(rim);

    // Standard matte turntable pedestal
    const pedGeo = new THREE.CylinderGeometry(0.96, 1.08, 0.11, 48);
    const pedMat = new THREE.MeshStandardMaterial({
      color: 0x151821,
      roughness: 0.72,
      metalness: 0.25,
    });
    const ped = new THREE.Mesh(pedGeo, pedMat);
    ped.position.y = -0.055;
    ped.receiveShadow = true;
    scene.add(ped);

    const trimRingGeo = new THREE.TorusGeometry(0.955, 0.018, 12, 48);
    const trimRingMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.45,
      metalness: 0.65,
      emissive: 0x78350f,
      emissiveIntensity: 0.06,
    });
    const trimRing = new THREE.Mesh(trimRingGeo, trimRingMat);
    trimRing.rotation.x = Math.PI / 2;
    trimRing.position.y = 0.0;
    scene.add(trimRing);

    const shadowTex = createContactShadowTexture();
    const shadowGeo = new THREE.PlaneGeometry(1.42, 1.42);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.72,
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.008;
    scene.add(shadow);

    const rig: FighterRigHandles = buildFighterRig(fighterId, skinId, authorizationMode);
    scene.add(rig.root);

    let disposed = false;
    let contextLost = false;
    let frameId = 0;
    const clock = new THREE.Clock();

    const onContextLost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
    };
    const onContextRestored = () => {
      contextLost = false;
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const scheduleNextFrame = () => {
      if (disposed) return;
      if (isSoftwareGl) {
        scheduleSoftwareGlFrame(
          renderer.getContext(),
          () => disposed,
          (id) => {
            frameId = id;
          },
          tick,
        );
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    const tick = () => {
      if (disposed) return;
      const dt = Math.min(0.05, clock.getDelta());
      const elapsed = clock.elapsedTime;

      if (!contextLost) {
        if (stateRef.current.autoRotate && !stateRef.current.isDragging) {
          stateRef.current.yaw += dt * 0.6;
        }
        rig.root.rotation.y = stateRef.current.yaw;

        animateFighterRig(
          rig,
          fighterId,
          stateRef.current.previewMove,
          elapsed % 1.0,
          1.0,
          elapsed,
          dt,
          null,
        );

        try {
          renderer.render(scene, camera);
        } catch {
          // context lost or unavailable
        }
      }

      scheduleNextFrame();
    };

    const ro = new ResizeObserver(() => {
      if (disposed) return;
      const w = Math.max(180, container.clientWidth);
      const h = Math.max(180, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);

    clock.start();
    scheduleNextFrame();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      ro.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      rig.dispose();
      pedGeo.dispose();
      pedMat.dispose();
      trimRingGeo.dispose();
      trimRingMat.dispose();
      shadowTex.dispose();
      shadowGeo.dispose();
      shadowMat.dispose();
      renderer.dispose();
      try {
        renderer.forceContextLoss();
      } catch {
        // ignore if already lost
      }
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [fighterId, skinId, authorizationMode]);

  return (
    <div
      ref={mountRef}
      className={`relative w-full h-full touch-control ${interactiveSpin ? 'cursor-grab active:cursor-grabbing' : ''} ${className}`}
      onPointerDown={(e) => {
        if (!interactiveSpin) return;
        stateRef.current.isDragging = true;
        stateRef.current.lastX = e.clientX;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!interactiveSpin || !stateRef.current.isDragging) return;
        const dx = e.clientX - stateRef.current.lastX;
        stateRef.current.lastX = e.clientX;
        stateRef.current.yaw += dx * 0.015;
      }}
      onPointerUp={() => {
        stateRef.current.isDragging = false;
      }}
      onPointerCancel={() => {
        stateRef.current.isDragging = false;
      }}
    />
  );
}
