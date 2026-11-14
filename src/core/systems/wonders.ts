// ============================================================
// 超级工程（Wonder）—— 主控提示词第九节：15 奇观
// 分回合砸财政，建成给永久全局 Buff + 地图剧变。
// 因果律：开工前有条件闸（竞标/险境触发）；争议类建成后吸血。
// ============================================================
import type { GameState, WonderBonusKind } from '../types';
import { config } from '../../config';
import type { TurnCtx } from './context';
import { canInvestWonder, checkUnlockConditions } from './unlockEngine';

/** 已建成奇观中某种 Buff 值的总和 */
export function wonderSum(state: GameState, kind: WonderBonusKind): number {
  let sum = 0;
  for (const w of state.wonders) {
    if (!w.built) continue;
    const spec = config.wonders.find((x) => x.id === w.id);
    if (spec && spec.bonus.kind === kind) sum += spec.bonus.value;
  }
  return sum;
}

/** 奇观是否建成 */
export function wonderBuilt(state: GameState, wonderId: string): boolean {
  return state.wonders.some((w) => w.id === wonderId && w.built);
}

/** 结算本回合投入：条件闸 → 扣财政 → 进度累加 → 建成触发事件 + 星级 + 入账 */
export function settleWonderInvest(
  state: GameState,
  invests: { wonderId: string; amount: number }[] | undefined,
  ctx: TurnCtx,
): void {
  const c = state.county;
  for (const inv of invests ?? []) {
    if (inv.amount <= 0) continue;
    const progress = state.wonders.find((w) => w.id === inv.wonderId);
    const spec = config.wonders.find((x) => x.id === inv.wonderId);
    if (!progress || !spec || progress.built) continue;
    // 因果律闸：条件不满足不接工程（邻县竞标没赢，钱花不出去）
    if (!canInvestWonder(state, spec)) continue;
    // 只花得起的部分投入（不透支财政）
    const spend = Math.max(0, Math.min(inv.amount, c.fiscalFund, spec.totalCost - progress.invested));
    if (spend <= 0) continue;
    c.fiscalFund -= spend;
    progress.invested += spend;
    ctx.pushLedger('transition', `wonder_${inv.wonderId}`, Math.round(spend / 10), `${spec.name}工程投入`);
    if (progress.invested >= spec.totalCost && !progress.built) {
      progress.built = true;
      ctx.pushEvent({ type: 'wonderCompleted', round: ctx.round, wonderId: inv.wonderId });
      ctx.pushLedger('transition', `wonder_done_${inv.wonderId}`, 15, `${spec.name}落成：${spec.bonus.desc}`);
      ctx.addStars(30);
      ctx.pushFeedback('mf_clean_desk', 'wonder_done_text');
    }
  }
}

/** 奇观维护费：已建成且有 upkeep 的奇观每回合吸血（财政不足 → 债务风险 +） */
export function settleWonderUpkeep(state: GameState, ctx: TurnCtx): void {
  const c = state.county;
  for (const w of state.wonders) {
    if (!w.built) continue;
    const spec = config.wonders.find((x) => x.id === w.id);
    if (!spec || !spec.upkeep) continue;
    const pay = Math.min(spec.upkeep, c.fiscalFund);
    c.fiscalFund -= pay;
    if (pay < spec.upkeep) {
      c.debtRisk = Math.min(100, c.debtRisk + (spec.upkeep - pay) / 20);
      ctx.pushLedger('cost', `wonder_upkeep_${w.id}`, -4, `${spec.name}维护费无力支付`);
    }
  }
}

/** 奇观开工条件是否满足（UI 用；返回未满足中文清单） */
export function wonderMissingReasons(state: GameState, wonderId: string): string[] {
  const spec = config.wonders.find((x) => x.id === wonderId);
  if (!spec) return ['不存在'];
  const prog = state.wonders.find((w) => w.id === wonderId);
  if (prog?.built) return ['已落成'];
  return checkUnlockConditions(state, spec.conditions).missing;
}
