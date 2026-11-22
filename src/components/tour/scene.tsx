"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Sparkles, useTexture } from "@react-three/drei";
import type { MotionValue } from "framer-motion";
import * as THREE from "three";
import { CAMERA_END_Z, CAMERA_START_Z, DOOR_Z, PORTALS, WALL_FRAMES, cameraZ, doorOpen } from "./path";

const W = 6; // corridor width
const H = 4.2; // corridor height
const LEN = 80;
const EYE = 1.6;

/* ───────────── Materials ───────────── */

// Chevron wall, like the black & violet zig-zag walls inside the spa.
function chevronMaterial(a: string, b: string, scale: number) {
  return new THREE.ShaderMaterial({
    uniforms: { cA: { value: new THREE.Color(a) }, cB: { value: new THREE.Color(b) }, uScale: { value: scale }, fogColor: { value: new THREE.Color("#120818") }, fogNear: { value: 4 }, fogFar: { value: 26 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying float vDepth;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 cA; uniform vec3 cB; uniform float uScale; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
      varying vec2 vUv; varying float vDepth;
      void main(){
        vec2 p = vUv * vec2(uScale * 20.0, uScale);
        float zig = abs(fract(p.x) - 0.5) * 2.0;
        float band = step(0.5, fract(p.y * 3.0 + zig * 0.5));
        vec3 col = mix(cA, cB, band);
        // soft vertical light falloff from the LED strip at the top
        col += vec3(0.20, 0.08, 0.32) * pow(vUv.y, 6.0);
        float f = smoothstep(fogNear, fogFar, vDepth);
        gl_FragColor = vec4(mix(col, fogColor, f), 1.0);
      }`,
  });
}

// Patterned carpet floor (diamond lattice, as in the photos).
function floorMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { fogColor: { value: new THREE.Color("#120818") } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying float vDepth;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 fogColor; varying vec2 vUv; varying float vDepth;
      void main(){
        vec2 p = vUv * vec2(6.0, 80.0);
        vec2 g = abs(fract(p) - 0.5);
        float d = g.x + g.y;
        float line = smoothstep(0.47, 0.5, d) + smoothstep(0.06, 0.0, abs(d - 0.25)) * 0.6;
        vec3 base = vec3(0.13, 0.07, 0.20);
        vec3 col = base + vec3(0.22, 0.14, 0.34) * line;
        // centre sheen
        col += vec3(0.10, 0.04, 0.16) * (1.0 - smoothstep(0.0, 0.5, abs(vUv.x - 0.5)));
        float f = smoothstep(4.0, 26.0, vDepth);
        gl_FragColor = vec4(mix(col, fogColor, f), 1.0);
      }`,
  });
}

// Glow strip: bright core with a soft falloff, additive.
function glowMaterial(color: string, intensity = 1) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { c: { value: new THREE.Color(color) }, k: { value: intensity } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 c; uniform float k; varying vec2 vUv;
      void main(){ float d = abs(vUv.y - 0.5) * 2.0; float a = (smoothstep(1.0, 0.0, d) * 0.55 + smoothstep(0.18, 0.0, d)) * k; gl_FragColor = vec4(c * a, a); }`,
  });
}

/* ───────────── Pieces ───────────── */

function Corridor() {
  const wallL = useMemo(() => chevronMaterial("#1a0d24", "#2c1640", 1.2), []);
  const wallR = useMemo(() => chevronMaterial("#1a0d24", "#311747", 1.2), []);
  const floor = useMemo(() => floorMaterial(), []);
  const cyan = useMemo(() => glowMaterial("#3fd0e0", 1.1), []);
  const magenta = useMemo(() => glowMaterial("#d6307f", 0.9), []);
  const zMid = DOOR_Z - LEN / 2;

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, zMid]} material={floor}>
        <planeGeometry args={[W, LEN]} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, H, zMid]}>
        <planeGeometry args={[W, LEN]} />
        <meshBasicMaterial color="#0d0612" />
      </mesh>
      <mesh rotation-y={Math.PI / 2} position={[-W / 2, H / 2, zMid]} material={wallL}>
        <planeGeometry args={[LEN, H]} />
      </mesh>
      <mesh rotation-y={-Math.PI / 2} position={[W / 2, H / 2, zMid]} material={wallR}>
        <planeGeometry args={[LEN, H]} />
      </mesh>
      {/* LED strips: cyan along the ceiling edges, magenta along the skirting */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh rotation-y={(s * -Math.PI) / 2} position={[(s * W) / 2 - s * 0.01, H - 0.12, zMid]} material={cyan}>
            <planeGeometry args={[LEN, 0.22]} />
          </mesh>
          <mesh rotation-y={(s * -Math.PI) / 2} position={[(s * W) / 2 - s * 0.01, 0.06, zMid]} material={magenta}>
            <planeGeometry args={[LEN, 0.14]} />
          </mesh>
        </group>
      ))}
      {/* cyan LED ceiling trays above each portal, as in the reception */}
      {PORTALS.map((p) => (
        <group key={p.z} position={[0, H - 0.02, p.z + 2.5]} rotation-x={Math.PI / 2}>
          {[
            [0, 1.6, 3.6, 0.12],
            [0, -1.6, 3.6, 0.12],
            [1.8, 0, 0.12, 3.2],
            [-1.8, 0, 0.12, 3.2],
          ].map(([x, y, w, h], i) => (
            <mesh key={i} position={[x, y, 0]} material={cyan}>
              <planeGeometry args={[w * 1.6, h * 2.2]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** Front wall with the entrance doors. */
function Entrance({ logo }: { logo: THREE.Texture }) {
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const logoRef = useRef<THREE.Mesh>(null);
  const wall = useMemo(() => chevronMaterial("#1c0e27", "#2a143a", 0.7), []);
  const gold = useMemo(() => new THREE.MeshBasicMaterial({ color: "#b8954f" }), []);
  const doorW = 1.55;
  const doorH = 2.9;

  useFrame(({ camera }) => {
    const t = doorOpen(camera.position.z);
    // doors swing inward, away from the visitor
    if (left.current) left.current.rotation.y = t * 1.75;
    if (right.current) right.current.rotation.y = -t * 1.75;
    if (logoRef.current) {
      const m = logoRef.current.material as THREE.MeshBasicMaterial;
      m.opacity = 1 - THREE.MathUtils.smoothstep(t, 0, 0.35);
      logoRef.current.position.y = 1.65 + t * 0.6;
      logoRef.current.visible = m.opacity > 0.01;
    }
  });

  const door = (side: 1 | -1) => (
    <group ref={side === -1 ? left : right} position={[side * doorW, 0, DOOR_Z]}>
      <group position={[-side * (doorW / 2), doorH / 2, 0]}>
        <mesh>
          <boxGeometry args={[doorW, doorH, 0.06]} />
          <meshStandardMaterial color="#24112f" roughness={0.6} />
        </mesh>
        {/* jaali-style inset panel and a gold pull */}
        <mesh position={[0, 0.1, 0.035]}>
          <planeGeometry args={[doorW * 0.7, doorH * 0.75]} />
          <meshStandardMaterial color="#3b1c4f" roughness={0.4} />
        </mesh>
        <mesh position={[-side * (doorW / 2 - 0.12), 0, 0.06]} material={gold}>
          <boxGeometry args={[0.03, 0.6, 0.03]} />
        </mesh>
      </group>
    </group>
  );

  const sideW = (W - doorW * 2) / 2;
  return (
    <group>
      <mesh position={[-(doorW + sideW / 2), H / 2, DOOR_Z]} material={wall}>
        <planeGeometry args={[sideW, H]} />
      </mesh>
      <mesh position={[doorW + sideW / 2, H / 2, DOOR_Z]} material={wall}>
        <planeGeometry args={[sideW, H]} />
      </mesh>
      <mesh position={[0, doorH + (H - doorH) / 2, DOOR_Z]} material={wall}>
        <planeGeometry args={[doorW * 2, H - doorH]} />
      </mesh>
      {/* gold door frame */}
      <mesh position={[0, doorH + 0.03, DOOR_Z + 0.02]} material={gold}>
        <boxGeometry args={[doorW * 2 + 0.12, 0.06, 0.05]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (doorW + 0.03), doorH / 2, DOOR_Z + 0.02]} material={gold}>
          <boxGeometry args={[0.06, doorH, 0.05]} />
        </mesh>
      ))}
      {door(-1)}
      {door(1)}
      <mesh ref={logoRef} position={[0, 1.65, DOOR_Z + 0.35]}>
        <circleGeometry args={[0.68, 64]} />
        <meshBasicMaterial map={logo} transparent toneMapped={false} />
      </mesh>
      {/* the corridor outside, behind the camera's start, so turning the head shows something */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, DOOR_Z + 5]}>
        <planeGeometry args={[W, 10]} />
        <meshStandardMaterial color="#1a0f22" roughness={0.9} />
      </mesh>
    </group>
  );
}

/** A photo hung in the middle of the corridor; the camera walks through it into the next space. */
function Portal({ texture, z, last }: { texture: THREE.Texture; z: number; last?: boolean }) {
  const group = useRef<THREE.Group>(null);
  const photo = useRef<THREE.MeshBasicMaterial>(null);
  const frame = useRef<THREE.MeshBasicMaterial>(null);
  const glow = useMemo(() => glowMaterial("#b14aed", 0.9), []);
  const w = 4.4;
  const h = w * 0.75;

  useFrame(({ camera }) => {
    const d = camera.position.z - z; // distance in front of the portal
    const near = last ? 1 : THREE.MathUtils.smoothstep(d, 0.4, 2.6);
    if (photo.current) photo.current.opacity = near;
    if (frame.current) frame.current.opacity = near;
    if (group.current) {
      group.current.visible = d > 0.05 || !!last;
      const grow = last ? 1 : 1 + (1 - THREE.MathUtils.smoothstep(d, 0, 6)) * 0.12;
      group.current.scale.setScalar(grow);
    }
  });

  return (
    <group ref={group} position={[0, EYE + 0.25, z]}>
      <mesh position={[0, 0, -0.03]}>
        <planeGeometry args={[w + 0.16, h + 0.16]} />
        <meshBasicMaterial ref={frame} color="#b8954f" transparent />
      </mesh>
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial ref={photo} map={texture} transparent toneMapped={false} />
      </mesh>
      <mesh position={[0, -h / 2 - 0.35, -0.05]} material={glow}>
        <planeGeometry args={[w * 0.9, 0.5]} />
      </mesh>
    </group>
  );
}

function WallFrame({ texture, x, z }: { texture: THREE.Texture; x: number; z: number }) {
  const side = Math.sign(x);
  return (
    <group position={[x - side * 0.04, EYE + 0.2, z]} rotation-y={(-side * Math.PI) / 2}>
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[2.32, 1.77]} />
        <meshBasicMaterial color="#b8954f" />
      </mesh>
      <mesh>
        <planeGeometry args={[2.2, 1.65]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 1.2, 0.8]} intensity={2.2} distance={4} color="#e9c8ff" />
    </group>
  );
}

/** Moves the camera along the corridor from the (smoothed) scroll progress, with a little mouse parallax. */
function CameraRig({ progress }: { progress: MotionValue<number> }) {
  const size = useThree((s) => s.size);
  const look = useMemo(() => new THREE.Vector3(), []);
  const mobile = size.width < 768;

  useFrame(({ camera, pointer }, dt) => {
    const p = progress.get();
    const z = cameraZ(p);
    const sway = Math.sin(z * 0.18) * 0.35;
    const tx = sway + pointer.x * (mobile ? 0.05 : 0.22);
    const ty = EYE + Math.sin(z * 0.9) * 0.015 + pointer.y * (mobile ? 0.03 : 0.12);
    const k = 1 - Math.exp(-dt * 6);
    camera.position.x += (tx - camera.position.x) * k;
    camera.position.y += (ty - camera.position.y) * k;
    camera.position.z = z;
    look.set(sway * 0.4 + pointer.x * 0.35, EYE + 0.15 + pointer.y * 0.2, z - 6);
    camera.lookAt(look);
  });
  return null;
}

export function TourScene({ progress, small }: { progress: MotionValue<number>; small: boolean }) {
  const suffix = small ? "-sm" : "";
  const urls = useMemo(
    () => [
      "/images/logo.webp",
      ...PORTALS.map((p) => `/images/${p.image}${suffix}.webp`),
      ...WALL_FRAMES.map((f) => `/images/${f.image}-sm.webp`),
    ],
    [suffix],
  );
  const textures = useTexture(urls, (loaded) => {
    (Array.isArray(loaded) ? loaded : [loaded]).forEach((t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
    });
  });
  const [logo, ...rest] = textures;
  const portalTex = rest.slice(0, PORTALS.length);
  const wallTex = rest.slice(PORTALS.length);

  return (
    <>
      <color attach="background" args={["#120818"]} />
      <fog attach="fog" args={["#120818", 4, 26]} />
      <ambientLight intensity={0.35} color="#b79ad1" />
      <pointLight position={[0, 3.6, DOOR_Z + 2.5]} intensity={6} distance={9} color="#ff7bd0" />
      <pointLight position={[0, 3.6, DOOR_Z - 3]} intensity={5} distance={10} color="#5be3f0" />
      <CameraRig progress={progress} />
      <Corridor />
      <Entrance logo={logo} />
      {PORTALS.map((p, i) => (
        <Portal key={p.z} texture={portalTex[i]} z={p.z} last={i === PORTALS.length - 1} />
      ))}
      {WALL_FRAMES.map((f, i) => (
        <WallFrame key={f.z + f.image} texture={wallTex[i]} x={f.side * (W / 2)} z={f.z} />
      ))}
      <Sparkles count={small ? 50 : 120} scale={[W, H, 60]} position={[0, H / 2, (CAMERA_START_Z + CAMERA_END_Z) / 2 - 3]} size={2.2} speed={0.25} opacity={0.55} color="#e6cf9a" />
    </>
  );
}
