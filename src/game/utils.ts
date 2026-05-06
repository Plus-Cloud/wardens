export class Vector2 {
  constructor(public x: number, public y: number) {}
  
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }
  
  normalize() {
    const len = this.length();
    if (len > 0) {
      this.x /= len;
      this.y /= len;
    }
    return this;
  }
  
  distanceTo(other: Vector2) {
    return Math.sqrt(Math.pow(this.x - other.x, 2) + Math.pow(this.y - other.y, 2));
  }
}

import { TILE_SIZE } from './constants';

export function worldToGrid(x: number, y: number) {
  return {
    gx: Math.floor(x / TILE_SIZE),
    gy: Math.floor(y / TILE_SIZE)
  };
}
