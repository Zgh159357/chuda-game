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

/** 从回合号确定性派生 rng 种子（同 seed+round 永远同结果） */
export function hashSeed(seed: number, round: number): number {
  let h = seed >>> 0;
  h = (h ^ Math.imul(round, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  return h;
}

/** 回合 rng（reducer 与 UI 展示共用，保证「本回合商机」显示与结算一致） */
export function roundRng(seed: number, round: number): Rng {
  return seedRng(hashSeed(seed, round));
}
