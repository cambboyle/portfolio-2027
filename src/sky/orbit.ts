/**
 * Where the Earth's axis points, for a given date.
 *
 * The axis is tipped 23.44° from the normal to the plane of the Earth's orbit, and it keeps pointing the same way
 * in space all year. So what we see depends on the season: at the June solstice the north pole leans towards the
 * sun, at the December solstice away from it, and at the equinoxes it leans sideways, across the sun's direction.
 * Equivalently, the sun's latitude (its declination) swings between +23.44° and -23.44° over the year.
 *
 * Screen coordinates throughout: x right, y up, z towards the viewer. The orbit plane is drawn horizontal, seen from
 * a little above, with the sun off to the left.
 */

export const OBLIQUITY = (23.44 * Math.PI) / 180;
/** How far above the orbit plane we look from. */
export const PITCH = 0.2;

export interface Pose {
  /** Unit vector from the Earth to the sun, in screen coordinates. */
  sun: number[];
  /** Screen → globe rotation (3×3, row-major): rows are the globe's east, north and prime-meridian directions. */
  orient: number[];
  /** The sun's latitude in radians: how far north (+) or south (-) of the equator it is overhead. */
  declination: number;
}

const cross = (a: number[], b: number[]) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: number[]) => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return a.map((x) => x / l);
};

export function skyPose(date: Date): Pose {
  // the sun's longitude along the ecliptic: 0 at the March equinox, 90° at the June solstice. The Earth moves faster
  // in January than in July, so the seasons are not equal; the standard low-precision formula allows for it.
  const days = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 86400000; // since 1 January 2000, noon
  const rad = Math.PI / 180;
  const anomaly = (357.529 + 0.98560028 * days) * rad;
  const lambda = (280.459 + 0.98564736 * days + 1.915 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly)) * rad;
  const up = [0, 1, 0]; // the normal to the orbit plane
  const toSun = unit([-0.95, 0, 0.32]); // in the orbit plane, off to the left and a little towards us
  const side = cross(up, toSun); // in the orbit plane, perpendicular to the sun's direction
  const [s, c] = [Math.sin(OBLIQUITY), Math.cos(OBLIQUITY)];
  const axis = [0, 1, 2].map(
    (i) => c * up[i] + s * (Math.sin(lambda) * toSun[i] + Math.cos(lambda) * side[i]),
  );
  // look down on the orbit plane from a little above it
  const [cp, sp] = [Math.cos(PITCH), Math.sin(PITCH)];
  const pitch = (v: number[]) => [v[0], cp * v[1] - sp * v[2], sp * v[1] + cp * v[2]];
  const sun = pitch(toSun);
  const north = pitch(axis);
  return {
    sun,
    orient: orientFromNorth(north),
    declination: Math.asin(Math.max(-1, Math.min(1, dot(north, sun)))),
  };
}

/** The screen → globe rotation for a body whose north pole points along `north` (screen coordinates): the rows are east, north and the meridian facing us. */
export function orientFromNorth(north: number[]): number[] {
  const view = [0, 0, 1];
  const k = dot(view, north);
  const meridian = unit([view[0] - k * north[0], view[1] - k * north[1], view[2] - k * north[2]]);
  return [...cross(north, meridian), ...north, ...meridian];
}

/**
 * The pose of a body with a fixed axial tilt (Mars 25°, Saturn 27°): the north pole leaning to the right by `tilt`
 * and tipped towards us by `pitch`, both in radians.
 */
export function fixedPose(tilt: number, pitch: number): number[] {
  const [cp, sp] = [Math.cos(pitch), Math.sin(pitch)];
  const lean = [Math.sin(tilt), Math.cos(tilt), 0];
  return orientFromNorth([lean[0], cp * lean[1] - sp * lean[2], sp * lean[1] + cp * lean[2]]);
}
