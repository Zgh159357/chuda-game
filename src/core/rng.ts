import type { Rng } from './types';

// ============================================================
// 种子化 PRNG（mulberry32）：测试可复现、存档可回放
// ============================================================
export function seedRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: Rng, arr: T[]): T {
  return arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];
}

export function chance(rng: Rng, p: number): boolean {
  return rng() < p;
}

export function randInt(rng: Rng, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}
