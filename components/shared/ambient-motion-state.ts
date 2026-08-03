export function ambientMotionEnabled(active: boolean, reduceMotion: boolean): boolean {
  return active && !reduceMotion;
}
