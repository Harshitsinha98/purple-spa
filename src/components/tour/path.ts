/**
 * The walk-through path. Scroll progress (0 → 1) maps to the camera's z position.
 * Each portal is a real photo of the spa; the camera pauses in front of it, then walks through.
 */
export const DOOR_Z = 0;
export const CAMERA_START_Z = 5.5;

export const PORTALS = [
  { image: "reception-front", z: -7 },
  { image: "corridor-neon", z: -16 },
  { image: "lounge-mural", z: -25 },
  { image: "art-wall", z: -34 },
  { image: "room-magenta", z: -43 },
] as const;

export const WALL_FRAMES = [
  { image: "reception-desk", side: -1, z: -10.5 },
  { image: "entry-blossom", side: 1, z: -12 },
  { image: "lounge-horses", side: 1, z: -20 },
  { image: "corridor-jaali", side: -1, z: -21 },
  { image: "room-chevron", side: -1, z: -29 },
  { image: "lounge-butterfly", side: 1, z: -30 },
  { image: "room-stripes", side: 1, z: -38.5 },
  { image: "room-chevron-2", side: -1, z: -39 },
] as const;

const DWELL = 3.4; // how far in front of a portal the camera rests

// [progress, z]
const KEYS: [number, number][] = [
  [0, CAMERA_START_Z],
  [0.1, 2.7],
  [0.17, -1],
  [0.24, PORTALS[0].z + DWELL],
  [0.3, PORTALS[0].z + DWELL - 0.6],
  [0.38, PORTALS[1].z + DWELL],
  [0.44, PORTALS[1].z + DWELL - 0.6],
  [0.52, PORTALS[2].z + DWELL],
  [0.58, PORTALS[2].z + DWELL - 0.6],
  [0.66, PORTALS[3].z + DWELL],
  [0.72, PORTALS[3].z + DWELL - 0.6],
  [0.86, PORTALS[4].z + DWELL],
  [1, PORTALS[4].z + 2.3],
];

export const CAMERA_END_Z = KEYS[KEYS.length - 1][1];

const smooth = (t: number) => t * t * (3 - 2 * t);

export function cameraZ(p: number) {
  const x = Math.min(1, Math.max(0, p));
  for (let i = 1; i < KEYS.length; i++) {
    const [p1, z1] = KEYS[i];
    if (x <= p1) {
      const [p0, z0] = KEYS[i - 1];
      return z0 + (z1 - z0) * smooth((x - p0) / (p1 - p0));
    }
  }
  return CAMERA_END_Z;
}

/** 0 = doors shut, 1 = fully open, driven by how close the camera is to the door. */
export function doorOpen(camZ: number) {
  const t = (2.9 - camZ) / (2.9 - 0.6);
  return smooth(Math.min(1, Math.max(0, t)));
}

/** Progress windows for the text chapters overlaid on the scene. */
export const CHAPTER_WINDOWS: [number, number][] = [
  [0.0, 0.14],
  [0.2, 0.33],
  [0.34, 0.47],
  [0.48, 0.61],
  [0.62, 0.75],
  [0.8, 0.92],
];
export const FINAL_WINDOW: [number, number] = [0.92, 1];
