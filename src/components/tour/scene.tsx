"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import type { MotionValue } from "framer-motion";
import * as THREE from "three";
import { DOOR_Z, PORTALS, cameraZ, doorOpen } from "./path";

const W = 5.2; // corridor width
const H = 3.6; // corridor height
const LEN = 70;
const EYE = 1.6;
const FOG = "#0e0613";

/* ───────────── Materials (unlit, so the look is identical on every GPU) ───────────── */

const fogged = (body: string) => /* glsl */ `
  uniform vec3 fogColor; varying vec2 vUv; varying float vDepth;
  void main(){ ${body}
    float f = smoothstep(3.0, 24.0, vDepth);
    gl_FragColor = vec4(mix(col, fogColor, f), 1.0);
  }`;
const vert = /* glsl */ `
  varying vec2 vUv; varying float vDepth;
  void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`;

/** Matte aubergine wall with a soft wash of violet light from the ceiling strip. */
function wallMaterial(tint: string) {
  return new THREE.ShaderMaterial({
    uniforms: { fogColor: { value: new THREE.Color(FOG) }, tint: { value: new THREE.Color(tint) } },
    vertexShader: vert,
    fragmentShader: "uniform vec3 tint;\n" + fogged(/* glsl */ `
      vec3 base = vec3(0.075, 0.035, 0.10);
      vec3 col = base + tint * (pow(vUv.y, 5.0) * 0.55 + pow(1.0 - vUv.y, 10.0) * 0.25);`),
  });
}

/** Dark polished floor: a soft centre sheen and faint reflections of the LED lines. */
function floorMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { fogColor: { value: new THREE.Color(FOG) } },
    vertexShader: vert,
    fragmentShader: fogged(/* glsl */ `
      float centre = 1.0 - smoothstep(0.0, 0.5, abs(vUv.x - 0.5));
      float edge = smoothstep(0.42, 0.5, abs(vUv.x - 0.5));
      vec3 col = vec3(0.05, 0.025, 0.07) + vec3(0.11, 0.05, 0.16) * centre * 0.6 + vec3(0.30, 0.06, 0.20) * edge * 0.35;`),
  });
}

/** Thin emissive line with a soft halo. */
function glowMaterial(color: string, intensity = 1) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { c: { value: new THREE.Color(color) }, k: { value: intensity } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 c; uniform float k; varying vec2 vUv;
      void main(){ float d = abs(vUv.y - 0.5) * 2.0; float a = (smoothstep(1.0, 0.0, d) * 0.35 + smoothstep(0.12, 0.0, d)) * k; gl_FragColor = vec4(c * a, a); }`,
  });
}

/* ───────────── Pieces ───────────── */

function Corridor() {
  const wallL = useMemo(() => wallMaterial("#5a2a86"), []);
  const wallR = useMemo(() => wallMaterial("#6a2470"), []);
  const floor = useMemo(() => floorMaterial(), []);
  const ceiling = useMemo(() => new THREE.MeshBasicMaterial({ color: "#07030a" }), []);
  const cyan = useMemo(() => glowMaterial("#3fd0e0", 0.9), []);
  const magenta = useMemo(() => glowMaterial("#d6307f", 0.7), []);
  const zMid = DOOR_Z - LEN / 2;

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, zMid]} material={floor}>
        <planeGeometry args={[W, LEN]} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, H, zMid]} material={ceiling}>
        <planeGeometry args={[W, LEN]} />
      </mesh>
      <mesh rotation-y={Math.PI / 2} position={[-W / 2, H / 2, zMid]} material={wallL}>
        <planeGeometry args={[LEN, H]} />
      </mesh>
      <mesh rotation-y={-Math.PI / 2} position={[W / 2, H / 2, zMid]} material={wallR}>
        <planeGeometry args={[LEN, H]} />
      </mesh>
      {/* LED lines like the spa's ceiling trays: cyan at the top, magenta along the floor */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh rotation-y={(s * -Math.PI) / 2} position={[(s * W) / 2 - s * 0.01, H - 0.08, zMid]} material={cyan}>
            <planeGeometry args={[LEN, 0.12]} />
          </mesh>
          <mesh rotation-y={(s * -Math.PI) / 2} position={[(s * W) / 2 - s * 0.01, 0.04, zMid]} material={magenta}>
            <planeGeometry args={[LEN, 0.08]} />
          </mesh>
        </group>
      ))}
      <mesh rotation-x={Math.PI / 2} position={[0, H - 0.01, zMid]} material={cyan}>
        <planeGeometry args={[0.1, LEN]} />
      </mesh>
    </group>
  );
}

/** Front wall with a pair of doors and the round logo. The doors swing inward as you walk up. */
function Entrance({ logo, mobile }: { logo: THREE.Texture; mobile: boolean }) {
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const logoRef = useRef<THREE.Mesh>(null);
  const wall = useMemo(() => wallMaterial("#4a2270"), []);
  const door = useMemo(() => new THREE.MeshBasicMaterial({ color: "#1d0d27" }), []);
  const gold = useMemo(() => new THREE.MeshBasicMaterial({ color: "#b8954f" }), []);
  const doorW = 1.2;
  const doorH = 2.7;

  useFrame(({ camera }) => {
    const t = doorOpen(camera.position.z, mobile);
    if (left.current) left.current.rotation.y = t * 1.7;
    if (right.current) right.current.rotation.y = -t * 1.7;
    if (logoRef.current) {
      const m = logoRef.current.material as THREE.MeshBasicMaterial;
      m.opacity = 1 - THREE.MathUtils.smoothstep(t, 0, 0.3);
      logoRef.current.visible = m.opacity > 0.01;
    }
  });

  const leaf = (side: 1 | -1) => (
    <group ref={side === -1 ? left : right} position={[side * doorW, 0, DOOR_Z]}>
      <group position={[-side * (doorW / 2), doorH / 2, 0]}>
        <mesh material={door}>
          <boxGeometry args={[doorW - 0.02, doorH, 0.05]} />
        </mesh>
      </group>
    </group>
  );

  const FW = 40; // front wall extends far beyond the screen so its edges are never seen
  const FH = 16;
  const sideW = (FW - doorW * 2) / 2;
  return (
    <group>
      <mesh position={[-(doorW + sideW / 2), FH / 2 - 4, DOOR_Z]} material={wall}>
        <planeGeometry args={[sideW, FH]} />
      </mesh>
      <mesh position={[doorW + sideW / 2, FH / 2 - 4, DOOR_Z]} material={wall}>
        <planeGeometry args={[sideW, FH]} />
      </mesh>
      <mesh position={[0, doorH + (FH - 4 - doorH) / 2, DOOR_Z]} material={wall}>
        <planeGeometry args={[doorW * 2, FH - 4 - doorH]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, DOOR_Z + 6]}>
        <planeGeometry args={[FW, 12]} />
        <meshBasicMaterial color="#0b0510" />
      </mesh>
      {/* hairline gold frame */}
      <mesh position={[0, doorH + 0.015, DOOR_Z + 0.01]} material={gold}>
        <boxGeometry args={[doorW * 2 + 0.06, 0.03, 0.02]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (doorW + 0.015), doorH / 2, DOOR_Z + 0.01]} material={gold}>
          <boxGeometry args={[0.03, doorH, 0.02]} />
        </mesh>
      ))}
      {leaf(-1)}
      {leaf(1)}
      <mesh ref={logoRef} position={[0, 1.55, DOOR_Z + 0.08]}>
        <circleGeometry args={[0.55, 64]} />
        <meshBasicMaterial map={logo} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

/** A photo of the spa hung in the corridor. The camera pauses in front, then walks through it. */
function Portal({ texture, z, w, h, y, last }: { texture: THREE.Texture; z: number; w: number; h: number; y: number; last?: boolean }) {
  const group = useRef<THREE.Group>(null);
  const photo = useRef<THREE.MeshBasicMaterial>(null);
  const line = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ camera }) => {
    const d = camera.position.z - z;
    const o = last ? 1 : THREE.MathUtils.smoothstep(d, 0.5, 2.4);
    if (photo.current) photo.current.opacity = o;
    if (line.current) line.current.opacity = o * 0.9;
    if (group.current) group.current.visible = d > 0.05 || !!last;
  });

  return (
    <group ref={group} position={[0, y, z]}>
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[w + 0.03, h + 0.03]} />
        <meshBasicMaterial ref={line} color="#c9a55c" transparent />
      </mesh>
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial ref={photo} map={texture} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

/**
 * Moves the camera from scroll progress. The view is shifted with setViewOffset so the photos sit
 * beside the text (desktop) or above it (phone) without bending the perspective.
 */
function CameraRig({ progress, mobile }: { progress: MotionValue<number>; mobile: boolean }) {
  const look = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera, pointer, size }, dt) => {
    const cam = camera as THREE.PerspectiveCamera;
    const p = progress.get();
    const z = cameraZ(p, mobile);
    const k = 1 - Math.exp(-dt * 5);
    const tx = mobile ? 0 : pointer.x * 0.12;
    const ty = EYE + (mobile ? 0 : pointer.y * 0.06);
    cam.position.x += (tx - cam.position.x) * k;
    cam.position.y += (ty - cam.position.y) * k;
    cam.position.z = z;
    look.set(cam.position.x * 0.5, EYE + 0.1, z - 6);
    cam.lookAt(look);

    // Offset fades out for the final room so it fills the screen.
    const shift = 1 - THREE.MathUtils.smoothstep(p, 0.84, 0.95);
    const ox = mobile ? 0 : -size.width * 0.17 * shift;
    const oy = mobile ? size.height * 0.16 * shift : 0;
    cam.setViewOffset(size.width, size.height, ox, oy, size.width, size.height);
  });
  return null;
}

/** Crops a 4:3 photo to fill a plane of a different shape (like CSS object-fit: cover). */
function cover(tex: THREE.Texture, planeAspect: number) {
  const img = tex.image as { width?: number; height?: number } | undefined;
  const imageAspect = img?.width && img?.height ? img.width / img.height : 4 / 3;
  if (planeAspect < imageAspect) {
    tex.repeat.set(planeAspect / imageAspect, 1);
    tex.offset.set((1 - tex.repeat.x) / 2, 0);
  } else {
    tex.repeat.set(1, imageAspect / planeAspect);
    tex.offset.set(0, (1 - tex.repeat.y) / 2);
  }
  tex.needsUpdate = true;
}

export function TourScene({ progress, small }: { progress: MotionValue<number>; small: boolean }) {
  const suffix = small ? "-sm" : "";
  const urls = useMemo(() => ["/images/logo.webp", ...PORTALS.map((p) => `/images/${p.image}${suffix}.webp`)], [suffix]);
  const textures = useTexture(urls, (loaded) => {
    (Array.isArray(loaded) ? loaded : [loaded]).forEach((t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
    });
  });
  const [logo, ...photos] = textures;

  // Photo sizes per screen: wide on desktop, narrow and tall-ish on phones.
  const regular = small ? { w: 2.0, h: 1.5, y: EYE + 0.15 } : { w: 3.6, h: 2.7, y: EYE + 0.1 };
  const final = small ? { w: 1.9, h: 3.3, y: EYE + 0.05 } : { w: 4.6, h: 3.0, y: EYE + 0.1 };
  const lastTex = photos[photos.length - 1];
  useMemo(() => cover(lastTex, final.w / final.h), [lastTex, final.w, final.h]);

  return (
    <>
      <color attach="background" args={[FOG]} />
      <CameraRig progress={progress} mobile={small} />
      <Corridor />
      <Entrance logo={logo} mobile={small} />
      {PORTALS.map((p, i) => {
        const last = i === PORTALS.length - 1;
        const s = last ? final : regular;
        return <Portal key={p.z} texture={photos[i]} z={p.z} last={last} {...s} />;
      })}
    </>
  );
}
