// ============================================================
// 系统：村庄治理（第十一节 · 组织度公式重构）
// 1. 治理护盾 governanceShield：按驻村干部数每回合生成；
//    项目烂尾/灾情等负面事件先扣护盾，穿透部分才扣内生治理。
// 2. 挤出效应削弱：有驻村队时村两委自然增长=0、每回合仅 −1；
//    玩家打出「传帮带」才恢复增长。
// 纯函数，core 内零 UI 依赖。
// ============================================================
import type { GameState, VillageState } from '../types';
import { config } from '../../config';
import type { TurnCtx } from './context';
import { heroSum } from './heroes';

/** 治理护盾生成（每回合，按驻村工作队人数） */
export function regenerateShield(state: GameState, v: VillageState): number {
  const g = config.balance.governanceShield;
  const cadreCount = state.cadres.filter((c) => c.villageId === v.id).length;
  v.governanceShield = Math.min(g.max, v.governanceShield + cadreCount * g.perCadrePerRound);
  return v.governanceShield;
}

/**
 * 治理护盾吸收负面事件伤害：
 *   shieldLoss = Math.min(currentShield, penalty)
 *   currentShield -= shieldLoss
 *   actualGovernanceLoss = penalty - shieldLoss
 * 返回穿透护盾的真实内生治理伤害，由调用方真扣。
 */
export function shieldDamage(
  state: GameState,
  villageId: string,
  penalty: number,
  ctx: TurnCtx
): number {
  const v = state.villages.find((x) => x.id === villageId);
  if (!v) return penalty;
  if (penalty <= 0) return 0;
  const shieldLoss = Math.min(v.governanceShield, penalty);
  v.governanceShield = Math.max(0, v.governanceShield - shieldLoss);
  const actual = penalty - shieldLoss;
  if (shieldLoss > 0) {
    ctx.pushEvent({
      type: 'governanceShieldAbsorbed',
      round: ctx.round,
      villageId,
      amount: shieldLoss,
    });
  }
  return actual;
}

export interface GovernanceDecayResult {
  growth: number; // 内生治理自然增长（有队=0，传帮带=+1，无队=+0.8）
  extrusion: number; // 挤出效应扣减（有队未传帮带=−1，老支书减半；其余 0）
}

/**
 * 村两委内生治理的单回合结算（§11 重构）。
 * - 有驻村队：自然增长率 0；未指派传帮带 → 挤出效应每回合仅扣 1 点
 *   （老支书等 orgSlow 人才派驻本村时再减半）；
 * - 指派传帮带：恢复增长 +1（产业产出 ×0.7 由 settleEmbedding 处理）；
 * - 无驻村队：自然增长 +0.8（村两委自己干）。
 */
export function calculateGovernanceDecay(
  state: GameState,
  v: VillageState,
  hasMentorship: boolean
): GovernanceDecayResult {
  const hasTeam = v.dispatchedUnitId != null;
  const growth = hasTeam ? (hasMentorship ? 1 : 0) : 0.8;
  let extrusion = 0;
  if (hasTeam && !hasMentorship) {
    const slow = Math.min(1, heroSum(state, v.id, 'orgSlow')); // 老支书：下降速度减半
    extrusion = Math.round((1 - slow) * 1 * 10) / 10;
  }
  return { growth, extrusion };
}
