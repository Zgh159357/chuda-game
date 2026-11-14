// ============================================================
// 系统：组织韧性（第十节）
// 组织度（内生治理/组织密度）的伤害缓冲池：
// 1. 所有「组织度扣减」先扣 organizationalResilience，归零才真扣。
// 2. 每回合基础恢复 +5；本回合有入户走访/摸排 → 额外 +5。
// 3. 韧性只缓冲「非自愿伤害」，不缓冲政策性退坡（D 阶段密度 −5 等）。
// 4. 挤出效应新公式：未指派传帮带 → 驻村队每回合 −2 内生治理；
//    指派传帮带 → +1 内生治理，但该村当回合产业产出 ×0.7。
// 5. 底线防御（科技）：村内生治理将跌破阈值时自动拨财政锁底。
// ============================================================
import type { GameState } from '../types';
import { config } from '../../config';
import type { TurnCtx } from './context';
import { techSum } from './techTree';
import { heroSum, heroSumAll } from './heroes';

/** 组织韧性比例（0–1，UI 韧性条/护盾强度用；核心层纯函数） */
export function resilienceRatio(state: GameState): number {
  const c = state.county;
  if (c.maxResilience <= 0) return 0;
  return Math.max(0, Math.min(1, c.organizationalResilience / c.maxResilience));
}

/** 组织度伤害缓冲：先扣韧性，返回真实伤害（real 部分由调用方真扣） */
export function applyOrgDamage(state: GameState, amount: number, ctx: TurnCtx): { absorbed: number; real: number } {
  const c = state.county;
  const available = Math.max(0, c.organizationalResilience);
  const absorbed = Math.min(available, amount);
  const real = amount - absorbed;
  c.organizationalResilience = Math.max(0, c.organizationalResilience - absorbed);
  if (absorbed > 0) {
    ctx.pushEvent({ type: 'resilienceAbsorbed', round: ctx.round, amount: absorbed, textId: 'resilience_absorb_text' });
  }
  return { absorbed, real };
}

/** 韧性结算（每回合末）：恢复 + 人才上限加成 */
export function settleResilience(state: GameState, ctx: TurnCtx, hadVisit: boolean): void {
  const c = state.county;
  const r = config.balance.resilience;
  // 上限：基础 50 + 老支书等 resilienceMax 人才（全局，不驻派也生效）
  c.maxResilience = r.initialMax + heroSumAll(state, 'resilienceMax');
  let v = c.organizationalResilience + r.regenPerRound;
  if (hadVisit) v += r.visitBonus;
  c.organizationalResilience = Math.max(0, Math.min(c.maxResilience, v));
}

/**
 * 挤出效应新公式（替换原「外部嵌入挤出内生」段）：
 * - 无驻村队：不动（原 externalEmbed −1 / 内生 +0.8 由 organization.ts 保留）。
 * - 有驻村队且未指派传帮带：applyOrgDamage(2)，real 部分扣该村内生治理。
 * - 有驻村队且指派传帮带：内生治理 +1，但该村本回合产业产出 ×0.7。
 */
export function settleEmbedding(
  state: GameState,
  villageId: string,
  mentorship: string[],
  ctx: TurnCtx
): void {
  const v = state.villages.find((x) => x.id === villageId);
  if (!v || !v.dispatchedUnitId) return;
  const isMentor = mentorship.includes(villageId);
  if (isMentor) {
    v.internalGovernance = Math.min(100, v.internalGovernance + 1);
    v.industryOutputMul = 0.7; // 传帮带占人：当回合产业产出 −30%
    ctx.pushFeedback('mf_scheduler', 'mentorship_on_text');
  } else {
    // 组织度下降减速（老支书等 orgSlow 人才派驻本村）
    const slow = Math.min(1, heroSum(state, villageId, 'orgSlow'));
    const amount = Math.round(2 * (1 - slow));
    const { real } = applyOrgDamage(state, amount, ctx);
    v.internalGovernance = Math.max(0, v.internalGovernance - real);
  }
}

/** 底线防御（科技）：村内生治理将跌破阈值时自动拨财政锁底；每回合至多 1 次 */
export function settleFloorDefense(state: GameState, ctx: TurnCtx): void {
  if (techSum(state, 'floorDefense') <= 0) return;
  const r = config.balance.resilience;
  const candidates = state.villages.filter((v) => v.internalGovernance < r.floorDefenseThreshold);
  if (candidates.length === 0) return;
  const v = candidates.reduce((a, b) => (a.internalGovernance < b.internalGovernance ? a : b));
  if (state.county.fiscalFund >= r.floorDefenseCost) {
    state.county.fiscalFund -= r.floorDefenseCost;
    v.internalGovernance = Math.max(v.internalGovernance, r.floorDefenseThreshold);
    ctx.pushEvent({ type: 'floorDefense', round: ctx.round, villageId: v.id, textId: 'floor_defense_text' });
    ctx.pushLedger('org', 'floorDefense', -8, `${v.name} 底线防御：财政锁底`);
    ctx.addStars(-5); // 花钱保底不是胜利
  } else {
    ctx.pushEvent({ type: 'floorDefense', round: ctx.round, villageId: v.id, textId: 'floor_defense_fail_text' });
  }
}
