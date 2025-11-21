export interface Point {
  id: string;
  x: number;
  y: number;
  vx: number; // velocity x
  vy: number; // velocity y
  mass: number;
  color: string;
  path: { x: number; y: number }[]; // for trails
}
