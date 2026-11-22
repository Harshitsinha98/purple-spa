/**
 * The walk-through path. Scroll progress (0 → 1) maps to the camera's z position.
 * Each portal is a real photo of the spa; the camera rests in front of it, then walks through.
 */
export const DOOR_Z = 0;

export const PORTALS = [
  { image: "reception-front", z: -7 },
  { image: "corridor-neon", z: -15 },
  { image: "lounge-mural", z: -23 },
  { image: "art-wall", z: -31 },
  { image: "room-magenta", z: -39 },
] as const;

// How far the camera stands from a photo, so it fills a comfortable part of the screen.
const VIEW = {
  desktop: { start: 6.2, dwell: 4.3, end: 2.55 },
  mobile: { start: 7.4, dwell: 3.7, end: 2.35 },
};

const smooth = (t: number) => t * t * (3 - 2 * t);

function keys(mobile: boolean): [number, number][] {
  const v = mobile ? VIEW.mobile : VIEW.desktop;
  const at = (i: number) => PORTALS[i].z + v.dwell;
  return [
    [0, v.start],
    [0.08, v.start - 0.6],
    [0.17, -1.2],
    [0.24, at(0)],
    [0.31, at(0) - 0.4],
    [0.38, at(1)],
    [0.45, at(1) - 0.4],
    [0.52, at(2)],
    [0.59, at(2) - 0.4],
    [0.66, at(3)],
    [0.73, at(3) - 0.4],
    [0.84, at(4)],
    [0.97, PORTALS[4].z + v.end],
    [1, PORTALS[4].z + v.end],
  ];
}
const KEYS = { desktop: keys(false), mobile: keys(true) };

export function cameraZ(p: number, mobile = false) {
  const k = mobile ? KEYS.mobile : KEYS.desktop;
  const x = Math.min(1, Math.max(0, p));
  for (let i = 1; i < k.length; i++) {
    const [p1, z1] = k[i];
    if (x <= p1) {
      const [p0, z0] = k[i - 1];
      return z0 + (z1 - z0) * smooth((x - p0) / (p1 - p0));
    }
  }
  return k[k.length - 1][1];
}

/** 0 = doors shut, 1 = fully open, driven by how close the camera is to the door. */
export function doorOpen(camZ: number, mobile = false) {
  const from = (mobile ? VIEW.mobile : VIEW.desktop).start - 1.4;
  const t = (from - camZ) / (from - 0.4);
  return smooth(Math.min(1, Math.max(0, t)));
}

/** Progress windows for the text chapters overlaid on the scene. */
export const CHAPTER_WINDOWS: [number, number][] = [
  [0.0, 0.13],
  [0.2, 0.33],
  [0.34, 0.47],
  [0.48, 0.61],
  [0.62, 0.75],
  [0.79, 0.9],
];
export const FINAL_WINDOW: [number, number] = [0.91, 1];
