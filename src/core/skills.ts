import type { GameState } from './types';
import { config } from '../config';

// ============================================================
// G3 干部技能树：查询工具
// 技能效果以 effect.kind 为键分散落在各系统中结算，
// 这里提供统一的「已解锁技能某类效果求和」查询。
// ============================================================

/** 求和：玩家已解锁技能中 effect.kind === kind 的效果值 */
export function skillSum(state: GameState, kind: string): number {
  return config.skills
    .filter((s) => state.unlocked.skills.includes(s.id) && s.effect.kind === kind)
    .reduce((sum, s) => sum + s.effect.value, 0);
}

/** 某条技能线（massWork/projectOps/orgBuilding）已解锁的最高等级 */
export function skillLineLevel(state: GameState, line: string): number {
  let max = 0;
  for (const s of config.skills) {
    if (s.line === line && state.unlocked.skills.includes(s.id)) max = Math.max(max, s.level);
  }
  return max;
}
