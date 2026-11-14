import type { GameState, TargetingLevel } from '../types';
import { config } from '../../config';
import type { TurnCtx } from './context';

// ============================================================
// 系统：瞄准单位压缩（县/村/户/人四级）
// 精度越高，行政成本越高：基础 × 倍率 × (1 + 信息精度/200)
// ============================================================

export function settleTargeting(state: GameState, ctx: TurnCtx): void {
  const level: TargetingLevel = state.county.lastTargeting ?? 'village';
  const multiplier = config.formulas.adminCost.targetingMultiplier[level];
  const infoFactor = 1 + state.county.infoAccuracy / config.formulas.adminCost.infoFactorDiv;
  const cost = 4 * multiplier * infoFactor;
  state.county.adminBurden = Math.max(0, state.county.adminBurden + cost);
  ctx.pushLedger('org', 'targetingCost', -Math.round(cost), `瞄准精度成本（${level}）`);
}

/** 瞄准等级越高，施策更精准：错配概率下降（由行动层用标签匹配模拟） */
export function targetingPrecisionBonus(level: TargetingLevel): number {
  return { county: 0, village: 1, household: 2, person: 3 }[level];
}
