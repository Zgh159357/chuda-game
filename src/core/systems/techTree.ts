// ============================================================
// 机制树（Tech Tree）—— 主控提示词第九节：因果律解锁
// 解锁 = 治理状态条件 + 事件链 + 政治资本，三重闸门。
// 禁忌节点连环隐式解锁：连续敷衍满 3 回合自动解锁「台账美化」。
// ============================================================
import type { GameState, TechEffectKind, TechPenaltyKind } from '../types';
import { config } from '../../config';
import type { TurnCtx } from './context';
import { checkUnlockConditions, isTechUnlocked } from './unlockEngine';

/** 已解锁节点中某种效果值的总和（供各系统读取） */
export function techSum(state: GameState, kind: TechEffectKind): number {
  let sum = 0;
  for (const id of state.techUnlocked) {
    const node = config.techTree.find((t) => t.id === id);
    if (!node) continue;
    for (const e of node.effects) if (e.kind === kind) sum += e.value;
  }
  return sum;
}

/** 已解锁节点中某种代价值的总和（供各系统读取） */
export function techPenaltySum(state: GameState, kind: TechPenaltyKind): number {
  let sum = 0;
  for (const id of state.techUnlocked) {
    const node = config.techTree.find((t) => t.id === id);
    if (!node || !node.penalty) continue;
    if (node.penalty.kind === kind) sum += node.penalty.value;
  }
  return sum;
}

/** 节点是否可解锁：未解锁 + 显现 + 条件满足 + 前置满足 + 政治资本够 */
export function canUnlockTech(state: GameState, nodeId: string): boolean {
  const node = config.techTree.find((t) => t.id === nodeId);
  if (!node || isTechUnlocked(state, nodeId)) return false;
  if (node.hidden && !checkUnlockConditions(state, node.conditions).ok) return false;
  if (node.requires?.some((r) => !isTechUnlocked(state, r))) return false;
  if (state.county.politicalCapital < node.politicalCapitalCost) return false;
  return checkUnlockConditions(state, node.conditions).ok;
}

/**
 * 结算本回合解锁申请：条件闸 + 政治资本闸 → 入 techUnlocked → 事件 + 星级。
 * 隐式解锁（hidden 且政治资本成本为 0 的走这里）：条件满足直接解锁不扣费。
 */
export function settleTechUnlocks(state: GameState, nodeIds: string[] | undefined, ctx: TurnCtx): void {
  for (const nodeId of nodeIds ?? []) {
    const node = config.techTree.find((t) => t.id === nodeId);
    if (!node) continue;
    if (isTechUnlocked(state, nodeId)) continue;
    if (node.requires?.some((r) => !isTechUnlocked(state, r))) continue;
    if (!checkUnlockConditions(state, node.conditions).ok) continue;
    if (state.county.politicalCapital < node.politicalCapitalCost) continue;
    state.county.politicalCapital -= node.politicalCapitalCost;
    state.techUnlocked.push(nodeId);
    ctx.pushEvent({ type: 'techUnlock', round: ctx.round, nodeId });
    ctx.pushLedger('transition', `tech_${nodeId}`, 8, `机制解锁：${node.name}`);
    ctx.addStars(15);
    ctx.pushFeedback('mf_clean_desk', 'tech_unlock_text');
  }
}

/** 禁忌隐式解锁：连续敷衍满 3 回合自动解锁「台账美化」（免费，且不可逆） */
export function settleImplicitTech(state: GameState, ctx: TurnCtx): void {
  if (state.streaks.cutCorners < 3) return;
  const taboo = config.techTree.find((t) => t.id === 'tech_beautify_org');
  if (!taboo || isTechUnlocked(state, 'tech_beautify_org')) return;
  state.techUnlocked.push(taboo.id);
  ctx.pushEvent({ type: 'techUnlock', round: ctx.round, nodeId: taboo.id });
  ctx.pushLedger('cost', 'tech_implicit_beautify', -6, '禁忌隐式解锁：台账美化');
  ctx.pushFeedback('mf_clean_desk', 'tech_unlock_text');
}
